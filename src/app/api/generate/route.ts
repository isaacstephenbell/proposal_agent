import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals } from '@/lib/supabase';
import { generateEmbedding, generateProposal } from '@/lib/openai';
import { GenerateRequest, GeneratedProposal } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { problem, client }: GenerateRequest = await request.json();

    if (!problem) {
      return NextResponse.json(
        { error: 'Problem statement is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the problem statement
    const embedding = await generateEmbedding(problem);

    // Get similar historical proposals
    const similarChunks = await searchSimilarProposals(embedding, 5);

    if (similarChunks.length === 0) {
      return NextResponse.json({
        proposal: "I don't have enough historical data to generate a proposal for this problem. Please add some historical proposals first.",
        sources: []
      });
    }

    // Generate new proposal based on historical context
    const proposal = await generateProposal(problem, similarChunks, client);

    // Format sources for response
    const sources = similarChunks.map(chunk => ({
      client: chunk.metadata.client,
      filename: chunk.metadata.filename,
      content: chunk.content
    }));

    const response: GeneratedProposal = {
      proposal,
      sources
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in generate API:', error);
    return NextResponse.json(
      { error: 'Failed to generate proposal' },
      { status: 500 }
    );
  }
} 