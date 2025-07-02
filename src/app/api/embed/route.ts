import { NextRequest, NextResponse } from 'next/server';
import { insertProposalChunk } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/openai';
import { chunkText, extractProposalSections } from '@/lib/chunker';

export async function POST(request: NextRequest) {
  try {
    const { text, metadata } = await request.json();

    if (!text || !metadata || !metadata.filename || !metadata.client) {
      return NextResponse.json(
        { error: 'Text, filename, and client are required' },
        { status: 400 }
      );
    }

    // Process the text into chunks
    const chunks = chunkText(text);
    const sections = extractProposalSections(text);

    const results = [];

    // Embed and store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for the chunk
      const embedding = await generateEmbedding(chunk);

      // Determine section type for this chunk
      let sectionType: 'understanding' | 'approach' | 'timeline' | 'problem' | undefined;
      if (sections.understanding && chunk.includes(sections.understanding.substring(0, 100))) {
        sectionType = 'understanding';
      } else if (sections.approach && chunk.includes(sections.approach.substring(0, 100))) {
        sectionType = 'approach';
      } else if (sections.timeline && chunk.includes(sections.timeline.substring(0, 100))) {
        sectionType = 'timeline';
      } else if (sections.problem && chunk.includes(sections.problem.substring(0, 100))) {
        sectionType = 'problem';
      }

      // Insert chunk into database
      const result = await insertProposalChunk(chunk, embedding, {
        filename: metadata.filename,
        client: metadata.client,
        date: metadata.date,
        tags: metadata.tags,
        section: sectionType
      });

      results.push({
        chunkIndex: i,
        success: result.success,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Processed ${chunks.length} chunks. ${successCount} successful, ${errorCount} failed.`,
      totalChunks: chunks.length,
      successfulChunks: successCount,
      failedChunks: errorCount,
      results
    });

  } catch (error) {
    console.error('Error in embed API:', error);
    return NextResponse.json(
      { error: 'Failed to embed proposal' },
      { status: 500 }
    );
  }
} 