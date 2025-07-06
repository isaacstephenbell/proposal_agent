import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// POST - Update block usage statistics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blockId, blockIds } = body;

    if (!blockId && !blockIds) {
      return NextResponse.json({ error: 'Block ID or IDs are required' }, { status: 400 });
    }

    // Handle single block update
    if (blockId) {
      const { error } = await supabaseAdmin
        .rpc('update_block_usage', { block_id: blockId });

      if (error) {
        console.error('Error updating block usage:', error);
        return NextResponse.json({ error: 'Failed to update block usage' }, { status: 500 });
      }
    }

    // Handle multiple block updates
    if (blockIds && Array.isArray(blockIds)) {
      const promises = blockIds.map(id => 
        supabaseAdmin.rpc('update_block_usage', { block_id: id })
      );

      const results = await Promise.allSettled(promises);
      const errors = results.filter(result => result.status === 'rejected');

      if (errors.length > 0) {
        console.error('Error updating multiple block usage:', errors);
        return NextResponse.json({ 
          error: 'Failed to update some block usage statistics',
          details: errors 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Block usage updated successfully' });
  } catch (error) {
    console.error('Error in POST /api/blocks/usage:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 