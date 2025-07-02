import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals } from '@/lib/supabase';
import { generateEmbedding, answerQuestion } from '@/lib/openai';
import { AskRequest, AskResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { query }: AskRequest = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Search for similar proposals
    const similarChunks = await searchSimilarProposals(embedding, 5);

    if (similarChunks.length === 0) {
      return NextResponse.json({
        answer: "I don't have any historical proposals that match your question. Please try rephrasing or ask about a different topic.",
        sources: []
      });
    }

    // Generate answer based on retrieved chunks
    const answer = await answerQuestion(query, similarChunks);

    // Format sources for response
    const sources = similarChunks.map(chunk => ({
      client: chunk.metadata.client,
      filename: chunk.metadata.filename,
      content: chunk.content
    }));

    const response: AskResponse = {
      answer,
      sources
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in ask API:', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
} 