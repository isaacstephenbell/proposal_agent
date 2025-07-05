import { NextRequest, NextResponse } from 'next/server';
import { createProposalPipeline } from '@/lib/langchain-pipeline';
import { generateProposal } from '@/lib/openai';
import { GenerateRequest, GeneratedProposal } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { problem, client, filters }: GenerateRequest & { filters?: any } = await request.json();

    if (!problem) {
      return NextResponse.json(
        { error: 'Problem statement is required' },
        { status: 400 }
      );
    }

    // Create pipeline instance
    const pipeline = createProposalPipeline();

    // Use LangChain pipeline for retrieval
    const retrievalResult = await pipeline.queryDocuments(problem, filters);

    if (!retrievalResult.success) {
      return NextResponse.json(
        { error: 'Failed to retrieve similar proposals', details: retrievalResult.errors },
        { status: 500 }
      );
    }

    if (retrievalResult.results.length === 0) {
      return NextResponse.json({
        proposal: "I don't have enough historical data to generate a proposal for this problem. Please add some historical proposals first.",
        sources: []
      });
    }

    // Generate new proposal based on historical context
    const proposal = await generateProposal(problem, retrievalResult.results, client);

    // Format sources for response
    const sources = retrievalResult.results.map(chunk => ({
      client: chunk.metadata?.client || chunk.client,
      filename: chunk.metadata?.filename || chunk.filename,
      content: chunk.content,
      author: chunk.metadata?.author || chunk.author,
      sector: chunk.metadata?.sector || chunk.sector,
      tags: chunk.metadata?.tags || chunk.tags,
      similarity: chunk.similarity
    }));

    const response: GeneratedProposal = {
      proposal,
      sources
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in generate API:', error);
    return NextResponse.json(
      { error: 'Failed to generate proposal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 