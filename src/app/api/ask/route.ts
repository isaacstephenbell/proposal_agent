import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals } from '@/lib/supabase';
import { generateEmbedding, answerQuestion } from '@/lib/openai';
import { AskRequest, AskResponse, ConversationContext, AppliedFilters, DuplicateInfo } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';

function extractClientFromQuery(query: string): string | null {
  // Look for explicit client mentions
  const clientPatterns = [
    /\b(MGT|PowerParts|Crux|Baton Rouge Youth Coalition|U\.S\. Chamber)/i,
    /for ([\w\s]+?)(?:\s|$|,|\?)/i,
    /about ([\w\s]+?)(?:\s|$|,|\?)/i
  ];
  
  for (const pattern of clientPatterns) {
    const match = query.match(pattern);
    if (match) {
      const client = match[1].trim();
      // Map common variations
      if (client.toLowerCase().includes('mgt')) return 'MGT';
      if (client.toLowerCase().includes('powerparts')) return 'PowerParts Group';
      if (client.toLowerCase().includes('crux')) return 'Crux Capital';
      if (client.toLowerCase().includes('baton rouge')) return 'Baton Rouge Youth Coalition';
      if (client.toLowerCase().includes('chamber')) return 'U.S. Chamber of Commerce Foundation';
      return client;
    }
  }
  
  return null;
}

function isFollowUpQuery(query: string): boolean {
  const followUpIndicators = [
    /^(the|that|this|those|these)\s/i,
    /^(give me|show me|tell me|list|order)/i,
    /^(when|where|how|what|why)/i,
    /in order/i,
    /by date/i,
    /chronological/i
  ];
  
  return followUpIndicators.some(pattern => pattern.test(query.trim()));
}

function generateProactiveFollowups(query: string, context: ConversationContext, chunks: any[]): string[] {
  const suggestions: string[] = [];
  
  // Context-aware suggestions based on query type and results
  if (context.lastClient) {
    if (query.includes('order') || query.includes('date') || query.includes('chronological')) {
      suggestions.push(`Show ${context.lastClient} work by deliverable type`);
      suggestions.push(`What was our most recent ${context.lastClient} project?`);
    } else {
      suggestions.push(`Show ${context.lastClient} projects in chronological order`);
      suggestions.push(`What deliverables did we create for ${context.lastClient}?`);
    }
  }
  
  // Sector-based suggestions
  const sectors = Array.from(new Set(chunks.map(c => c.metadata?.sector || c.sector).filter(Boolean)));
  if (sectors.length > 0) {
    suggestions.push(`Show similar work in ${sectors[0]} sector`);
  }
  
  // Author-based suggestions
  const authors = Array.from(new Set(chunks.map(c => c.metadata?.author || c.author).filter(Boolean)));
  if (authors.length > 0) {
    suggestions.push(`What else did ${authors[0]} work on?`);
  }
  
  // General exploration suggestions
  if (chunks.length > 0) {
    suggestions.push('What was the timeline for these projects?');
    suggestions.push('Show me the key deliverables from these proposals');
  }
  
  return suggestions.slice(0, 3); // Limit to 3 suggestions
}

function calculateMetadataConfidence(chunk: any): any {
  // Calculate confidence scores based on extraction patterns
  const confidence = {
    client: 0.8, // Default confidence
    author: 0.8,
    sector: 0.8,
    date: 0.8
  };
  
  // Higher confidence for exact matches or well-formatted data
  if (chunk.metadata?.client && chunk.metadata.client.length > 2) {
    confidence.client = 0.9;
  }
  
  if (chunk.metadata?.author && chunk.metadata.author.includes(' ')) {
    confidence.author = 0.9;
  }
  
  if (chunk.metadata?.sector && ['consulting', 'private-equity', 'social-impact', 'government'].includes(chunk.metadata.sector)) {
    confidence.sector = 0.95;
  }
  
  if (chunk.metadata?.proposal_date || chunk.proposal_date) {
    const dateString = chunk.metadata?.proposal_date || chunk.proposal_date;
    const date = new Date(dateString);
    confidence.date = !isNaN(date.getTime()) ? 0.95 : 0.5;
  }
  
  return confidence;
}

function generateSnippet(content: string, query: string): string {
  // Extract relevant snippet from content based on query
  const words = content.toLowerCase().split(/\s+/);
  const queryWords = query.toLowerCase().split(/\s+/);
  
  // Find the best matching sentence or paragraph
  const sentences = content.split(/[.!?]+/);
  let bestMatch = '';
  let bestScore = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    const score = queryWords.reduce((acc, word) => {
      return acc + (sentenceWords.includes(word) ? 1 : 0);
    }, 0);
    
    if (score > bestScore && sentence.length > 50) {
      bestScore = score;
      bestMatch = sentence.trim();
    }
  }
  
  return bestMatch || content.substring(0, 200) + '...';
}

function detectAmbiguity(query: string): { isAmbiguous: boolean; clarification?: string } {
  const queryLower = query.toLowerCase();
  
  // Check for common ambiguous terms, but exclude cases where clarification is already provided
  const ambiguousTerms = [
    { 
      term: 'OEM', 
      clarification: 'Do you mean work for OEM clients, or work related to OEM parts/vendors?',
      clarifiedTerms: ['oem clients', 'oem parts', 'oem vendors'] 
    },
    { 
      term: 'consulting', 
      clarification: 'Are you looking for internal consulting work or external client consulting?',
      clarifiedTerms: ['internal consulting', 'external consulting', 'client consulting'] 
    },
    { 
      term: 'management', 
      clarification: 'Do you mean project management, change management, or executive management?',
      clarifiedTerms: ['project management', 'change management', 'executive management'] 
    },
    { 
      term: 'development', 
      clarification: 'Are you looking for business development, software development, or talent development?',
      clarifiedTerms: ['business development', 'software development', 'talent development'] 
    }
  ];
  
  for (const { term, clarification, clarifiedTerms } of ambiguousTerms) {
    // Check if the ambiguous term exists in the query
    if (queryLower.includes(term.toLowerCase())) {
      // Check if any clarified terms are already present
      const isAlreadyClarified = clarifiedTerms.some(clarifiedTerm => 
        queryLower.includes(clarifiedTerm.toLowerCase())
      );
      
      // Only return ambiguous if clarification hasn't been provided
      if (!isAlreadyClarified) {
        return { isAmbiguous: true, clarification };
      }
    }
  }
  
  return { isAmbiguous: false };
}

async function loadCorrections(): Promise<Record<string, any>> {
  try {
    const correctionsPath = path.join(process.cwd(), 'corrections.json');
    const data = await fs.readFile(correctionsPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveCorrection(correction: any): Promise<void> {
  try {
    const correctionsPath = path.join(process.cwd(), 'corrections.json');
    let corrections: Record<string, any> = {};
    
    try {
      const data = await fs.readFile(correctionsPath, 'utf-8');
      corrections = JSON.parse(data);
    } catch (error) {
      // File doesn't exist, start with empty object
    }
    
    const key = `${correction.field}_${correction.context}`;
    corrections[key] = correction;
    
    await fs.writeFile(correctionsPath, JSON.stringify(corrections, null, 2));
  } catch (error) {
    console.error('Error saving correction:', error);
  }
}

function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple similarity calculation using word overlap
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  return intersection.size / union.size;
}

function detectDuplicates(chunks: any[]): DuplicateInfo[] {
  const duplicates: DuplicateInfo[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const similarity = calculateTextSimilarity(chunks[i].content, chunks[j].content);
      
      if (similarity > 0.85) {
        duplicates.push({
          filename: chunks[j].metadata?.filename || chunks[j].filename,
          similarity: Math.round(similarity * 100) / 100,
          reason: similarity > 0.95 ? 'Nearly identical content' : 'Very similar content'
        });
      }
    }
  }
  
  return duplicates;
}

async function applyCorrections(chunks: any[]): Promise<any[]> {
  const corrections = await loadCorrections();
  
  return chunks.map(chunk => {
    const correctedChunk = { ...chunk };
    
    // Apply known corrections based on patterns
    Object.entries(corrections).forEach(([key, correction]: [string, any]) => {
      if (key.includes('client') && chunk.metadata?.client) {
        const pattern = correction.context.toLowerCase();
        if (chunk.content.toLowerCase().includes(pattern)) {
          correctedChunk.metadata.client = correction.newValue;
        }
      }
      
      if (key.includes('author') && chunk.metadata?.author) {
        const pattern = correction.context.toLowerCase();
        if (chunk.content.toLowerCase().includes(pattern)) {
          correctedChunk.metadata.author = correction.newValue;
        }
      }
    });
    
    return correctedChunk;
  });
}

function formatResponseForQuery(query: string, chunks: any[], answer: string): { answer: string; sources: any[] } {
  // If asking for chronological order, sort sources by date
  if (query.includes('order') && (query.includes('date') || query.includes('chronological'))) {
    chunks.sort((a, b) => {
      const dateA = new Date(a.metadata?.proposal_date || a.metadata?.date || a.proposal_date || '1900-01-01');
      const dateB = new Date(b.metadata?.proposal_date || b.metadata?.date || b.proposal_date || '1900-01-01');
      return dateA.getTime() - dateB.getTime();
    });
  }
  
  // Enhanced source formatting with better metadata
  const sources = chunks.map(chunk => ({
    client: chunk.metadata?.client || chunk.client,
    filename: chunk.metadata?.filename || chunk.filename,
    content: chunk.content,
    date: chunk.metadata?.proposal_date || chunk.metadata?.date || chunk.proposal_date,
    author: chunk.metadata?.author || chunk.author,
    sector: chunk.metadata?.sector || chunk.sector,
    snippet: generateSnippet(chunk.content, query),
    confidence: calculateMetadataConfidence(chunk)
  }));
  
  return { answer, sources };
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== ASK API START ===');
    const { query, context }: AskRequest = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log('Query:', query);
    console.log('Context:', context);

    // Check for ambiguity first
    const ambiguityCheck = detectAmbiguity(query);
    if (ambiguityCheck.isAmbiguous) {
      return NextResponse.json({
        answer: `I need clarification: ${ambiguityCheck.clarification}`,
        sources: [],
        context: context || {},
        appliedFilters: { contextSource: 'none' }
      });
    }

    // Smart context detection
    let searchFilters: any = {};
    let enhancedQuery = query;
    
    // Extract explicit client from current query
    const explicitClient = extractClientFromQuery(query);
    
    // Determine if this is a follow-up query
    const isFollowUp = isFollowUpQuery(query);
    
    // Track applied filters for explainability
    const appliedFilters: AppliedFilters = {
      contextSource: 'none'
    };
    
    // Apply context-aware filtering
    if (explicitClient) {
      // Explicit client mentioned - use it and update context
      searchFilters.client = explicitClient;
      appliedFilters.client = explicitClient;
      appliedFilters.contextSource = 'explicit';
      console.log('Explicit client detected:', explicitClient);
    } else if (isFollowUp && context?.lastClient) {
      // Follow-up query - maintain previous client context
      searchFilters.client = context.lastClient;
      appliedFilters.client = context.lastClient;
      appliedFilters.contextSource = 'followup';
      enhancedQuery = `${query} for ${context.lastClient}`;
      appliedFilters.queryEnhancement = enhancedQuery;
      console.log('Follow-up query, maintaining client context:', context.lastClient);
    }

    // Generate embedding for the enhanced query
    const embedding = await generateEmbedding(enhancedQuery);
    console.log('Generated embedding, length:', embedding.length);

    // Search for similar proposals with smart filtering
    const similarChunks = await searchSimilarProposals(embedding, 10, searchFilters);
    console.log('Found chunks:', similarChunks.length);
    console.log('Applied filters:', searchFilters);

    if (similarChunks.length === 0) {
      console.log('No chunks found, returning empty response');
      const emptyMessage = searchFilters.client 
        ? `I don't have any historical proposals for ${searchFilters.client} that match your question. Please try rephrasing or ask about a different topic.`
        : "I don't have any historical proposals that match your question. Please try rephrasing or ask about a different topic.";
      
      return NextResponse.json({
        answer: emptyMessage,
        sources: [],
        context: {
          lastClient: explicitClient || context?.lastClient,
          lastQuery: query
        }
      });
    }

    // Filter chunks to only relevant client if context suggests it
    let filteredChunks = similarChunks;
    if (searchFilters.client) {
      const clientVariations = [searchFilters.client];
      if (searchFilters.client === 'MGT') {
        clientVariations.push('MGT Consulting');
      }
      
      filteredChunks = similarChunks.filter(chunk => 
        clientVariations.some(variation => 
          (chunk.metadata?.client && chunk.metadata.client.includes(variation))
        )
      );
      
      console.log(`Filtered to ${searchFilters.client}: ${filteredChunks.length} chunks`);
    }

    // Use filtered chunks if we have them, otherwise fall back to all
    const chunksToUse = filteredChunks.length > 0 ? filteredChunks : similarChunks;

    // Apply learned corrections
    const correctedChunks = await applyCorrections(chunksToUse);

    // Detect duplicates in results
    const duplicateWarnings = detectDuplicates(correctedChunks);

    // Generate enhanced answer with context awareness
    let contextualPrompt = '';
    if (searchFilters.client) {
      contextualPrompt = `Focus specifically on work done for ${searchFilters.client}. `;
    }
    if (query.includes('order') && query.includes('date')) {
      contextualPrompt += 'Present the information in chronological order by project date. ';
    }

    const answer = await answerQuestion(
      contextualPrompt + query, 
      correctedChunks.slice(0, 5) // Limit to top 5 for answer generation
    );
    console.log('Generated answer length:', answer.length);

    // Format response based on query type
    const formattedResponse = formatResponseForQuery(query, correctedChunks, answer);

    // Generate proactive suggestions
    const suggestions = generateProactiveFollowups(query, context || {}, correctedChunks);

    const response: AskResponse = {
      ...formattedResponse,
      context: {
        lastClient: explicitClient || searchFilters.client || context?.lastClient,
        lastQuery: query,
        lastSector: correctedChunks[0]?.sector
      },
      appliedFilters,
      suggestions,
      duplicateWarnings: duplicateWarnings.length > 0 ? duplicateWarnings : undefined
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