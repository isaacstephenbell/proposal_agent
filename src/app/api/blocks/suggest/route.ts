import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/openai';
import { BlockSuggestionRequest } from '@/lib/types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// POST - Get suggested blocks based on context
export async function POST(request: NextRequest) {
  try {
    const body: BlockSuggestionRequest = await request.json();
    const { 
      context, 
      client, 
      sector, 
      tags, 
      excludeBlockIds = [], 
      limit = 5 
    } = body;

    if (!context) {
      return NextResponse.json({ error: 'Context is required' }, { status: 400 });
    }

    // Generate embedding for the context
    const contextEmbedding = await generateEmbedding(context);

    // Use the match_blocks function to find similar blocks
    const { data: similarBlocks, error: similarError } = await supabaseAdmin
      .rpc('match_blocks', {
        query_embedding: contextEmbedding,
        match_threshold: 0.3,
        match_count: limit * 2, // Get more than we need for filtering
        filter_tags: tags || null,
        exclude_block_ids: excludeBlockIds
      });

    if (similarError) {
      console.error('Error finding similar blocks:', similarError);
      return NextResponse.json({ error: 'Failed to find similar blocks' }, { status: 500 });
    }

    // Apply additional filtering and ranking
    let suggestedBlocks = similarBlocks || [];

    // Filter by client if specified
    if (client) {
      // Look for blocks that have been used for similar clients
      // or have tags that match the client type
      const clientKeywords = client.toLowerCase().split(' ');
      suggestedBlocks = suggestedBlocks.filter((block: any) => {
        const blockText = `${block.title} ${block.content} ${block.tags.join(' ')}`.toLowerCase();
        return clientKeywords.some(keyword => blockText.includes(keyword));
      });
    }

    // Filter by sector if specified
    if (sector) {
      suggestedBlocks = suggestedBlocks.filter((block: any) => {
        const blockText = `${block.title} ${block.content} ${block.tags.join(' ')}`.toLowerCase();
        return blockText.includes(sector.toLowerCase());
      });
    }

    // Rank blocks by a combination of similarity, usage, and recency
    suggestedBlocks = suggestedBlocks.map((block: any) => {
      // Calculate composite score
      const similarityScore = block.similarity || 0;
      const usageScore = Math.min(block.usage_count / 10, 1); // Normalize usage count
      const recencyScore = getRecencyScore(block.last_used_at);
      
      // Weighted combination
      const compositeScore = (similarityScore * 0.5) + (usageScore * 0.3) + (recencyScore * 0.2);
      
      return {
        ...block,
        compositeScore
      };
    });

    // Sort by composite score and limit results
    suggestedBlocks.sort((a: any, b: any) => b.compositeScore - a.compositeScore);
    suggestedBlocks = suggestedBlocks.slice(0, limit);

    // Get popular blocks as fallback if not enough similar blocks found
    if (suggestedBlocks.length < limit) {
      const { data: popularBlocks, error: popularError } = await supabaseAdmin
        .rpc('get_popular_blocks', {
          limit_count: limit - suggestedBlocks.length,
          filter_tags: tags || null
        });

      if (popularError) {
        console.error('Error getting popular blocks:', popularError);
      } else {
        // Add popular blocks that aren't already in suggestions
        const existingIds = new Set(suggestedBlocks.map((b: any) => b.id));
        const newPopularBlocks = (popularBlocks || []).filter((block: any) => 
          !existingIds.has(block.id) && !excludeBlockIds.includes(block.id)
        );
        
        suggestedBlocks = [...suggestedBlocks, ...newPopularBlocks];
      }
    }

    return NextResponse.json({ 
      suggestedBlocks: suggestedBlocks.slice(0, limit),
      totalFound: suggestedBlocks.length
    });

  } catch (error) {
    console.error('Error in POST /api/blocks/suggest:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to calculate recency score
function getRecencyScore(lastUsedAt: string): number {
  const now = new Date();
  const lastUsed = new Date(lastUsedAt);
  const daysDifference = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  
  // Score decreases with age, but slowly
  // Recent usage (0-7 days) = 1.0
  // 1 month = 0.8
  // 3 months = 0.6
  // 6 months = 0.4
  // 1 year+ = 0.2
  
  if (daysDifference <= 7) return 1.0;
  if (daysDifference <= 30) return 0.8;
  if (daysDifference <= 90) return 0.6;
  if (daysDifference <= 180) return 0.4;
  return 0.2;
} 