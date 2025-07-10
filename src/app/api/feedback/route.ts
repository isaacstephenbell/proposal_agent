import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { FeedbackRequest, FeedbackResponse } from '@/lib/types';

// POST - Submit feedback for a Discovery Chat response
export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json();
    const { 
      question, 
      answer, 
      rating, 
      feedback_reason,
      chunk_ids, 
      query_type, 
      applied_filters,
      session_id 
    } = body;

    // Validate required fields
    if (!question || !answer || !rating || !chunk_ids) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' }, 
        { status: 400 }
      );
    }

    // Validate rating
    if (!['good', 'bad'].includes(rating)) {
      return NextResponse.json(
        { success: false, error: 'Rating must be "good" or "bad"' }, 
        { status: 400 }
      );
    }

    console.log('📝 Submitting feedback:', {
      question: question.substring(0, 50) + '...',
      rating,
      chunk_count: chunk_ids.length,
      query_type,
      has_filters: !!applied_filters
    });

    // Insert feedback into database
    const { data, error } = await supabaseAdmin
      .from('discovery_feedback')
      .insert([{
        question,
        answer,
        rating,
        feedback_reason,
        chunk_ids: JSON.stringify(chunk_ids),
        query_type,
        applied_filters: applied_filters ? JSON.stringify(applied_filters) : null,
        session_id
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting feedback:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save feedback' }, 
        { status: 500 }
      );
    }

    console.log('✅ Feedback saved successfully:', data.id);

    const response: FeedbackResponse = {
      success: true,
      feedback_id: data.id
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// GET - Retrieve feedback analytics (optional, for admin use)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query_type = searchParams.get('query_type');
    const rating = searchParams.get('rating');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabaseAdmin
      .from('discovery_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (query_type) {
      query = query.eq('query_type', query_type);
    }

    if (rating) {
      query = query.eq('rating', rating);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching feedback:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ feedback: data || [] });

  } catch (error) {
    console.error('Error in feedback GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 