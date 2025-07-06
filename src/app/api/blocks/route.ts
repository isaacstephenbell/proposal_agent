import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/openai';
import { ProposalBlock, CreateBlockRequest, BlockSearchRequest } from '@/lib/types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// GET - Search and list blocks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const tags = searchParams.get('tags');
    const author = searchParams.get('author');
    const limit = parseInt(searchParams.get('limit') || '10');
    const sort = searchParams.get('sort') || 'recent'; // recent, popular, relevance

    let supabaseQuery = supabaseAdmin
      .from('proposal_blocks')
      .select('*');

    // Apply filters
    if (author) {
      supabaseQuery = supabaseQuery.eq('author_id', author);
    }

    if (tags) {
      const tagArray = tags.split(',');
      supabaseQuery = supabaseQuery.overlaps('tags', tagArray);
    }

    // Apply sorting
    if (sort === 'popular') {
      supabaseQuery = supabaseQuery.order('usage_count', { ascending: false });
    } else if (sort === 'recent') {
      supabaseQuery = supabaseQuery.order('created_at', { ascending: false });
    } else if (sort === 'last_used') {
      supabaseQuery = supabaseQuery.order('last_used_at', { ascending: false });
    }

    // Apply text search if query provided
    if (query) {
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,content.ilike.%${query}%`);
    }

    supabaseQuery = supabaseQuery.limit(limit);

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Error fetching blocks:', error);
      return NextResponse.json({ error: 'Failed to fetch blocks' }, { status: 500 });
    }

    return NextResponse.json({ blocks: data || [] });
  } catch (error) {
    console.error('Error in GET /api/blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new block
export async function POST(request: NextRequest) {
  try {
    const body: CreateBlockRequest = await request.json();
    const { title, content, tags, author_id, notes } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    // Generate embedding for the block content
    const embedding = await generateEmbedding(content);

    // Insert the block into the database
    const { data, error } = await supabaseAdmin
      .from('proposal_blocks')
      .insert({
        title,
        content,
        tags: tags || [],
        author_id,
        notes,
        embedding
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating block:', error);
      return NextResponse.json({ error: 'Failed to create block' }, { status: 500 });
    }

    return NextResponse.json({ block: data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/blocks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 