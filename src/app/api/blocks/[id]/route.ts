import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/openai';
import { UpdateBlockRequest } from '@/lib/types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// GET - Get a specific block by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { data, error } = await supabaseAdmin
      .from('proposal_blocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 });
      }
      console.error('Error fetching block:', error);
      return NextResponse.json({ error: 'Failed to fetch block' }, { status: 500 });
    }

    return NextResponse.json({ block: data });
  } catch (error) {
    console.error('Error in GET /api/blocks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a specific block
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body: UpdateBlockRequest = await request.json();
    const { title, content, tags, notes } = body;

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) {
      updateData.content = content;
      // Regenerate embedding if content changed
      updateData.embedding = await generateEmbedding(content);
    }
    if (tags !== undefined) updateData.tags = tags;
    if (notes !== undefined) updateData.notes = notes;

    // Update the block
    const { data, error } = await supabaseAdmin
      .from('proposal_blocks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Block not found' }, { status: 404 });
      }
      console.error('Error updating block:', error);
      return NextResponse.json({ error: 'Failed to update block' }, { status: 500 });
    }

    return NextResponse.json({ block: data });
  } catch (error) {
    console.error('Error in PUT /api/blocks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a specific block
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const { error } = await supabaseAdmin
      .from('proposal_blocks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting block:', error);
      return NextResponse.json({ error: 'Failed to delete block' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Block deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/blocks/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 