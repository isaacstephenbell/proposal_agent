import { createClient } from '@supabase/supabase-js';
import { ProposalChunk } from './types';

// Load environment variables if running in Node.js (not browser)
if (typeof window === 'undefined') {
  require('dotenv').config({ path: '.env.local' });
}

// Check for both CLI and Next.js environment variable formats
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Client-side Supabase client (for browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client (for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Vector search function using pgvector
export async function searchSimilarProposals(
  embedding: number[],
  limit: number = 5,
  filters?: {
    author?: string;
    sector?: string;
    client?: string;
    tags?: string[];
  },
  threshold: number = 0.2
): Promise<ProposalChunk[]> {
  try {
    const { data, error } = await supabaseAdmin
      .rpc('match_proposals', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        filter_author: filters?.author || null,
        filter_sector: filters?.sector || null,
        filter_client: filters?.client || null,
        filter_tags: filters?.tags || null
      });

    if (error) {
      console.error('Error searching proposals:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchSimilarProposals:', error);
    throw error;
  }
}

// Advanced multi-stage search with query expansion and reranking
export async function enhancedSearch(
  query: string,
  limit: number = 5,
  filters?: {
    author?: string;
    sector?: string;
    client?: string;
    tags?: string[];
  }
): Promise<{
  results: ProposalChunk[];
  searchMetadata: {
    queryExpansion: any;
    stageResults: {
      semantic: number;
      reranked: number;
      diversified: number;
    };
    processingTime: number;
  };
}> {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 ENHANCED SEARCH for query: "${query}"`);
    
    // Stage 1: Query expansion and multiple embeddings
    const { generateExpandedEmbeddings } = await import('./openai');
    const expansionData = await generateExpandedEmbeddings(query);
    
    console.log(`📈 Query expanded: "${expansionData.expansion.expandedQuery}"`);
    console.log(`🔍 Synonyms: ${expansionData.expansion.synonyms.join(', ')}`);
    
    // Stage 2: Multi-embedding semantic search (high recall, lower precision)
    const candidateResults = await Promise.all([
      searchSimilarProposals(expansionData.originalEmbedding, limit * 4, filters, 0.1),
      searchSimilarProposals(expansionData.expandedEmbedding, limit * 4, filters, 0.1),
      ...expansionData.synonymEmbeddings.map(embedding => 
        searchSimilarProposals(embedding, limit * 2, filters, 0.1)
      )
    ]);
    
    // Combine and deduplicate results
    const allCandidates = candidateResults.flat();
    const uniqueCandidates = Array.from(
      new Map(allCandidates.map(chunk => [chunk.id, chunk])).values()
    );
    
    console.log(`🧠 Stage 1 - Semantic search: ${uniqueCandidates.length} candidates`);
    
    // Stage 3: Cross-encoder reranking for precision
    const rerankedResults = await crossEncoderRerank(query, uniqueCandidates, limit * 2);
    
    console.log(`🎯 Stage 2 - Reranked: ${rerankedResults.length} results`);
    
    // Stage 4: Diversity filtering (avoid too many chunks from same document)
    const diversifiedResults = diversityFilter(rerankedResults, limit, 2);
    
    console.log(`🌈 Stage 3 - Diversified: ${diversifiedResults.length} final results`);
    
    const processingTime = Date.now() - startTime;
    
    return {
      results: diversifiedResults,
      searchMetadata: {
        queryExpansion: expansionData.expansion,
        stageResults: {
          semantic: uniqueCandidates.length,
          reranked: rerankedResults.length,
          diversified: diversifiedResults.length
        },
        processingTime
      }
    };
    
  } catch (error) {
    console.error('Error in enhancedSearch:', error);
    
    // Fallback to simple semantic search
    const { generateEmbedding } = await import('./openai');
    const embedding = await generateEmbedding(query);
    const fallbackResults = await searchSimilarProposals(embedding, limit, filters);
    
    return {
      results: fallbackResults,
      searchMetadata: {
        queryExpansion: { originalQuery: query, expandedQuery: query, synonyms: [], relatedTerms: [] },
        stageResults: { semantic: fallbackResults.length, reranked: 0, diversified: 0 },
        processingTime: Date.now() - startTime
      }
    };
  }
}

// Cross-encoder reranking for precise relevance scoring
async function crossEncoderRerank(query: string, candidates: ProposalChunk[], limit: number): Promise<ProposalChunk[]> {
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Use GPT-4 as a cross-encoder for precise relevance scoring
    const scoringPrompt = `
Rate the relevance of each text chunk to the query on a scale of 0-100.
Consider semantic meaning, context, and specific details.

Query: "${query}"

Chunks to score:
${candidates.map((chunk, index) => `
${index + 1}. Client: ${chunk.metadata?.client || 'Unknown'}
Content: ${chunk.content.substring(0, 300)}...
`).join('\n')}

Return only a JSON array of scores: [score1, score2, ...]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a precise relevance scorer for consulting document search.' },
        { role: 'user', content: scoringPrompt }
      ],
      temperature: 0.1,
      max_tokens: 200
    });
    
    const content = response.choices[0].message?.content || '[]';
    
    try {
      const scores = JSON.parse(content);
      
      // Combine chunks with scores and sort by relevance
      const scoredChunks = candidates.map((chunk, index) => ({
        ...chunk,
        crossEncoderScore: scores[index] || 0
      })).sort((a, b) => b.crossEncoderScore - a.crossEncoderScore);
      
      return scoredChunks.slice(0, limit);
    } catch (parseError) {
      console.warn('Failed to parse cross-encoder scores, using original order');
      return candidates.slice(0, limit);
    }
    
  } catch (error) {
    console.error('Error in cross-encoder reranking:', error);
    return candidates.slice(0, limit);
  }
}

// Diversity filtering to avoid too many chunks from the same document
function diversityFilter(chunks: ProposalChunk[], limit: number, maxPerDocument: number = 2): ProposalChunk[] {
  const documentCounts = new Map<string, number>();
  const filteredChunks: ProposalChunk[] = [];
  
  for (const chunk of chunks) {
    const documentId = chunk.metadata?.filename || 'unknown';
    const currentCount = documentCounts.get(documentId) || 0;
    
    if (currentCount < maxPerDocument) {
      filteredChunks.push(chunk);
      documentCounts.set(documentId, currentCount + 1);
      
      if (filteredChunks.length >= limit) {
        break;
      }
    }
  }
  
  return filteredChunks;
}

// Legacy hybrid search function (kept for backward compatibility)
export async function hybridSearchProposals(
  query: string,
  embedding: number[],
  limit: number = 5,
  filters?: {
    author?: string;
    sector?: string;
    client?: string;
    tags?: string[];
  }
): Promise<ProposalChunk[]> {
  try {
    console.log(`🔍 LEGACY HYBRID SEARCH for query: "${query}"`);
    
    // Use enhanced search but return only results for compatibility
    const { results } = await enhancedSearch(query, limit, filters);
    return results;
    
  } catch (error) {
    console.error('Error in hybridSearchProposals:', error);
    return [];
  }
}

// Extract exact terms that should be searched literally
function extractExactTerms(query: string): string[] {
  const exactTerms: string[] = [];
  const queryLower = query.toLowerCase();
  
  // Common exact terms that should be searched literally
  const exactTermPatterns = [
    /covid[-\s]?19/i,
    /pandemic/i,
    /coronavirus/i,
    /sars[-\s]?cov[-\s]?2/i,
    /erp/i,
    /crm/i,
    /api/i,
    /gdpr/i,
    /hipaa/i,
    /sox/i,
    /iso[\s-]?\d+/i,
    /\b[A-Z]{2,}\b/g, // Acronyms
    // Industry/sector terms that should be searched exactly
    /restaurants?/i,
    /retail/i,
    /healthcare/i,
    /manufacturing/i,
    /technology/i,
    /education/i,
    /finance/i,
    /banking/i,
    /insurance/i,
    /government/i,
    /nonprofit/i,
    /energy/i,
    /automotive/i,
    /real\s+estate/i,
    /hospitality/i,
    /construction/i,
    /logistics/i,
    /pharma/i,
    /biotech/i,
    /agriculture/i,
    /media/i,
    /entertainment/i,
    /sports/i,
    /travel/i,
    /tourism/i,
    /legal/i,
    /consulting/i,
    /advertising/i,
    /marketing/i,
    /private\s+equity/i,
    /venture\s+capital/i,
    /investment/i,
    /asset\s+management/i,
    /hedge\s+fund/i,
    /pension/i,
    /endowment/i,
    /foundation/i,
    /charity/i,
    /startup/i
  ];
  
  for (const pattern of exactTermPatterns) {
    const matches = queryLower.match(pattern);
    if (matches) {
      exactTerms.push(...matches);
    }
  }
  
  return Array.from(new Set(exactTerms)); // Remove duplicates
}

// Insert proposal chunk with embedding
export async function insertProposalChunk(
  content: string,
  embedding: number[],
  metadata: {
    filename: string;
    client: string;
    date?: string;
    tags?: string[];
    author?: string;
    sector?: string;
    file_hash?: string;
  }
): Promise<{ success: boolean; error?: any }> {
  try {
    // Handle date conversion safely
    let proposalDate = null;
    if (metadata.date) {
      try {
        const date = new Date(metadata.date);
        if (!isNaN(date.getTime())) {
          proposalDate = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.warn(`Invalid date format: ${metadata.date}`);
      }
    }

    const { error } = await supabaseAdmin
      .from('proposals')
      .insert({
        content,
        embedding,
        metadata,
        author: metadata.author || null,
        sector: metadata.sector || null,
        proposal_date: proposalDate,
        filename: metadata.filename || null,
        client: metadata.client || null,
        file_hash: metadata.file_hash || null,
        tags: metadata.tags || null
      });

    if (error) {
      console.error('Error inserting proposal chunk:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in insertProposalChunk:', error);
    return { success: false, error };
  }
}

// Get all proposals (for debugging/testing)
export async function getAllProposals(): Promise<ProposalChunk[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching proposals:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllProposals:', error);
    throw error;
  }
} 