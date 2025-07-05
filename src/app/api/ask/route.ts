import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals } from '@/lib/supabase';
import { generateEmbedding, answerQuestion } from '@/lib/openai';
import { AskRequest, AskResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    console.log('=== ASK API START ===');
    const { query }: AskRequest = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('Query:', query);

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    console.log('Generated embedding, length:', embedding.length);

    // Search for similar proposals
    const similarChunks = await searchSimilarProposals(embedding, 5);
    console.log('Found chunks:', similarChunks.length);

    if (similarChunks.length === 0) {
      console.log('No chunks found, returning empty response');
      return NextResponse.json({
        answer: "I don't have any historical proposals that match your question. Please try rephrasing or ask about a different topic.",
        sources: []
      });
    }

    // Generate answer based on retrieved chunks
    const answer = await answerQuestion(query, similarChunks);
    console.log('Generated answer length:', answer.length);

    // Format sources for response
    const sources = similarChunks.map(chunk => ({
      client: chunk.metadata.client,
      filename: chunk.metadata.filename,
      content: chunk.content
    }));

    console.log('Sources count:', sources.length);

    const response: AskResponse = {
      answer,
      sources
    };

    console.log('=== ASK API SUCCESS ===');
    return NextResponse.json(response);
  } catch (error) {
    console.error('=== ASK API ERROR ===', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
} 