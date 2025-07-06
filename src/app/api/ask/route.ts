import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals, hybridSearchProposals, supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding, answerQuestion } from '@/lib/openai';
import { AskRequest, AskResponse, ConversationContext, AppliedFilters, DuplicateInfo } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';

// Get ALL proposals for a specific client (comprehensive search)
async function getAllProposalsForClient(clientName: string): Promise<any[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .order('proposal_date', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching all proposals:', error);
      return [];
    }

    if (!data) return [];

    // Filter by client using similarity matching
    const matchingProposals = data.filter(proposal => {
      const proposalClient = proposal.metadata?.client || proposal.client || '';
      return areClientsSimilar(proposalClient, clientName, 0.85);
    });

    console.log(`Found ${matchingProposals.length} total proposals for ${clientName}`);
    return matchingProposals;
  } catch (error) {
    console.error('Error in getAllProposalsForClient:', error);
    return [];
  }
}

// Intelligent filtering for when client has many proposals
function shouldRequestClarification(chunks: any[], query: string): boolean {
  if (chunks.length === 0) return false;
  
  // Count unique proposals/files
  const uniqueProposals = new Set(chunks.map(chunk => chunk.metadata?.filename || chunk.filename));
  
  // If more than 5 unique proposals and query is general, ask for clarification
  const isGeneralQuery = !query.toLowerCase().includes('recent') && 
                        !query.toLowerCase().includes('latest') &&
                        !query.toLowerCase().includes('chronological') &&
                        !query.toLowerCase().includes('specific') &&
                        !query.toLowerCase().match(/\d{4}/) && // No year mentioned
                        !query.toLowerCase().includes('project') && // Not asking about specific project
                        uniqueProposals.size > 5;
  
  return isGeneralQuery;
}

// Generate clarifying questions for clients with many proposals
function generateClarificationResponse(chunks: any[], client: string): string {
  const uniqueProposals = new Map();
  const totalChunks = chunks.length;
  
  // Extract unique proposals with meaningful project names and descriptions
  chunks.forEach(chunk => {
    const filename = chunk.filename;
    if (!uniqueProposals.has(filename)) {
      // Extract project name from filename
      let projectName = filename
        .replace('.pdf', '')
        .replace('.docx', '')
        .replace(/MGT\s*-?\s*/i, '')
        .replace(/Cicero\s*-?\s*/i, '')
        .replace(/\([^)]*\)/g, '') // Remove version numbers in parentheses
        .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove date patterns
        .replace(/-\s*$/, '') // Remove trailing dashes
        .trim();
      
      // Generate meaningful description from content
      let description = '';
      const content = chunk.content || '';
      
      // Look for key phrases that describe the work
      if (content.toLowerCase().includes('discovery')) {
        description = 'Process and technology discovery engagement';
      } else if (content.toLowerCase().includes('migration')) {
        description = 'System migration planning and implementation';
      } else if (content.toLowerCase().includes('talent') || content.toLowerCase().includes('workforce')) {
        description = 'Talent development and workforce planning initiative';
      } else if (content.toLowerCase().includes('revenue') || content.toLowerCase().includes('sales')) {
        description = 'Revenue optimization and sales planning project';
      } else if (content.toLowerCase().includes('integration')) {
        description = 'Technology integration and project management';
      } else if (content.toLowerCase().includes('assessment')) {
        description = 'Market assessment and analysis engagement';
      } else if (content.toLowerCase().includes('strategy')) {
        description = 'Strategic planning and advisory services';
      } else if (content.toLowerCase().includes('support')) {
        description = 'Operational support and consulting services';
      } else if (content.toLowerCase().includes('planning')) {
        description = 'Strategic planning and implementation support';
      } else {
        // Extract first meaningful sentence as fallback
        const sentences = content.split(/[.!?]+/).filter((s: string) => s.trim().length > 20);
        if (sentences.length > 0) {
          description = sentences[0].trim().substring(0, 80) + (sentences[0].length > 80 ? '...' : '');
        } else {
          description = 'Consulting engagement';
        }
      }
      
      uniqueProposals.set(filename, {
        projectName,
        date: chunk.metadata?.proposal_date || chunk.proposal_date || '1900-01-01',
        description
      });
    }
  });
  
  // Sort by date (most recent first)
  const sortedProposals = Array.from(uniqueProposals.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Generate the response with ALL projects listed
  const projectsList = sortedProposals
    .map((project, i) => `${i + 1}. **${project.projectName}** (${project.date}) - ${project.description}`)
    .join('\n');
  
  return `I found **${uniqueProposals.size} different proposals** for **${client}** (${totalChunks} total sections):

${projectsList}

**Which project interests you most, or would you like me to:**
• Show recent ${client} work in detail
• Focus on a specific year (2024, 2023, etc.)  
• Show projects by type (ERP, consulting, etc.)
• Display in chronological order
• Get details about a specific project

What would be most helpful?`;
}

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
  const queryLower = query.toLowerCase().trim();
  
  // If query explicitly mentions a client name, it's NOT a follow-up (it's a new topic)
  const clientMentions = [
    /\b(mgt|powerparts|crux|baton rouge|chamber|texas mutual|r&r|starc|trive|wear blue)\b/i
  ];
  
  if (clientMentions.some(pattern => pattern.test(queryLower))) {
    return false;
  }
  
  const followUpIndicators = [
    // Demonstrative pronouns (referring to previous results)
    /^(the|that|this|those|these)\s/i,
    
    // Continuation phrases that don't start new topics
    /(more|additional|other|similar)/i,
    /(details?|information|specifics)/i,
    
    // Ordering/formatting requests (likely follow-ups)
    /in order/i,
    /by date/i,
    /chronological/i,
    
    // Clear follow-up phrases
    /^(any|anything)\s+(else|more|other)/i,
    /^can you/i,
    /^do we have/i,
    /^did we/i,
    /^have we/i,
    
    // Continuation words that suggest building on previous context
    /^(also|additionally|furthermore|moreover)/i,
    /^(and|but|however|although)/i,
    
    // Questions that build on context (without client names)
    /^tell me more/i,
    /^give me more/i,
    /^show me more/i
  ];
  
  return followUpIndicators.some(pattern => pattern.test(queryLower));
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

// Calculate string similarity optimized for client name matching
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Normalize strings (remove extra spaces, convert to lowercase)
  const norm1 = str1.trim().toLowerCase().replace(/\s+/g, ' ');
  const norm2 = str2.trim().toLowerCase().replace(/\s+/g, ' ');
  
  if (norm1 === norm2) return 1;

  // Special handling for substring matches (e.g., "MGT" vs "MGT Consulting")
  const shorter = norm1.length < norm2.length ? norm1 : norm2;
  const longer = norm1.length < norm2.length ? norm2 : norm1;
  
  // If shorter is contained in longer, boost similarity significantly
  if (longer.includes(shorter)) {
    const containmentBoost = shorter.length / longer.length * 0.6;
    return Math.min(1, 0.5 + containmentBoost);
  }
  
  // Calculate edit distance (Levenshtein)
  const editDistance = calculateEditDistance(norm1, norm2);
  const similarity = (longer.length - editDistance) / longer.length;
  
  // Boost similarity for exact word matches
  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word)).length;
  const wordBoost = commonWords / Math.max(words1.length, words2.length) * 0.3;
  
  return Math.min(1, similarity + wordBoost);
}

// Calculate Levenshtein edit distance
function calculateEditDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Check if two client names are similar enough to be considered the same
function areClientsSimilar(client1: string, client2: string, threshold: number = 0.85): boolean {
  if (!client1 || !client2) return false;
  return calculateStringSimilarity(client1, client2) >= threshold;
}

// Extract format instructions from user query
function extractFormatInstructions(query: string): string | undefined {
  const lowerQuery = query.toLowerCase();
  
  // Check for specific format requests
  if (lowerQuery.includes('bullet points') || lowerQuery.includes('bullet format')) {
    return 'Format all information using bullet points (•) with clear section headers';
  }
  
  if (lowerQuery.includes('numbered list') || lowerQuery.includes('numbered format')) {
    return 'Format all information using numbered lists (1. 2. 3.) with clear descriptions';
  }
  
  if (lowerQuery.includes('chronological') || lowerQuery.includes('timeline') || lowerQuery.includes('order by date')) {
    return 'Format projects in chronological order with dates prominently displayed';
  }
  
  if (lowerQuery.includes('summary') || lowerQuery.includes('brief') || lowerQuery.includes('concise')) {
    return 'Provide brief, concise summaries for each project without detailed activities';
  }
  
  if (lowerQuery.includes('detailed') || lowerQuery.includes('comprehensive') || lowerQuery.includes('in depth')) {
    return 'Provide comprehensive details including background, approach, activities, and outcomes for each project';
  }
  
  // Default: return undefined to use default format
  return undefined;
}

// Normalize client names for consistent display
function normalizeClientName(clientName: string | undefined): string {
  if (!clientName) return 'Unknown Client';
  
  // Client name normalization mapping
  const clientMappings: { [key: string]: string } = {
    'MGT': 'MGT Consulting',
    'PowerParts': 'PowerParts Group',
    'Crux': 'Crux Capital',
    'Texas Mutual': 'Texas Mutual Insurance',
    'R&R': 'R&R Partners',
    'STARC': 'STARC Systems',
    'Trive': 'Trive Capital'
  };
  
  // Check for exact matches first
  if (clientMappings[clientName]) {
    return clientMappings[clientName];
  }
  
  // Check for partial matches using similarity
  for (const [stored, display] of Object.entries(clientMappings)) {
    if (areClientsSimilar(clientName, stored, 0.85)) {
      return display;
    }
  }
  
  // Return original if no normalization needed
  return clientName;
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
  
  // Enhanced source formatting with better metadata and client name normalization
  const sources = chunks.map(chunk => {
    const rawClient = chunk.metadata?.client || chunk.client;
    const normalizedClient = normalizeClientName(rawClient);
    
    return {
      client: normalizedClient,
      filename: chunk.metadata?.filename || chunk.filename,
      content: chunk.content,
      date: chunk.metadata?.proposal_date || chunk.metadata?.date || chunk.proposal_date,
      author: chunk.metadata?.author || chunk.author,
      sector: chunk.metadata?.sector || chunk.sector,
      snippet: generateSnippet(chunk.content, query),
      confidence: calculateMetadataConfidence(chunk)
    };
  });
  
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
    } else if (isFollowUp && context?.lastSuccessfulResults) {
      // Follow-up query - maintain previous topic/document context
      console.log('Follow-up query, maintaining topic context from previous results');
      appliedFilters.contextSource = 'topic-followup';
      
      // Use the same documents/chunks from the previous successful search
      const previousResultIds = context.lastSuccessfulResults.map((r: any) => r.id);
      console.log('Filtering to previous result IDs:', previousResultIds.slice(0, 5));
      
      // We'll filter the results later to match previous successful results
      searchFilters.previousResultIds = previousResultIds;
    }

    // Determine search strategy based on query type
    let similarChunks: any[] = [];
    
    if (searchFilters.previousResultIds) {
      // TOPIC FOLLOW-UP QUERY: Use previous successful results
      console.log('Using previous successful results for topic follow-up');
      const { data: previousResults, error: prevError } = await supabaseAdmin
        .from('proposals')
        .select('*')
        .in('id', searchFilters.previousResultIds)
        .limit(10);
      
      if (prevError) {
        console.error('Error fetching previous results:', prevError);
        similarChunks = [];
      } else {
        similarChunks = previousResults || [];
        console.log(`Found ${similarChunks.length} chunks from previous context`);
        
        // Optionally rank by semantic similarity to the new query
        if (similarChunks.length > 0) {
          const embedding = await generateEmbedding(enhancedQuery);
          const scoredChunks = similarChunks.map(chunk => ({
            ...chunk,
            similarity: calculateTextSimilarity(enhancedQuery, chunk.content)
          }));
          similarChunks = scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        }
      }
    } else if (searchFilters.client) {
      // CLIENT-SPECIFIC QUERY: Use comprehensive search to get ALL client work
      console.log(`Using comprehensive client search for: ${searchFilters.client}`);
      similarChunks = await getAllProposalsForClient(searchFilters.client);
      console.log(`Found ${similarChunks.length} total chunks for ${searchFilters.client}`);
      
      // If we have too many results, we can optionally rank by semantic similarity
      if (similarChunks.length > 20) {
        console.log('Many results found, ranking by semantic similarity...');
        const embedding = await generateEmbedding(enhancedQuery);
        // Keep all chunks but add similarity scores for ranking
        const scoredChunks = similarChunks.map(chunk => ({
          ...chunk,
          similarity: calculateTextSimilarity(enhancedQuery, chunk.content)
        }));
        // Sort by similarity but keep all chunks
        similarChunks = scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      }
    } else {
      // GENERAL QUERY: Use hybrid search (semantic + exact text matching)
      console.log('Using hybrid search for general query');
      const embedding = await generateEmbedding(enhancedQuery);
      console.log('Generated embedding, length:', embedding.length);
      similarChunks = await hybridSearchProposals(enhancedQuery, embedding, 10, searchFilters);
      console.log('Found chunks:', similarChunks.length);
    }
    
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

    // No additional filtering needed - comprehensive client search already filtered by client
    const chunksToUse = similarChunks;

    // Apply learned corrections
    const correctedChunks = await applyCorrections(chunksToUse);

    // Check if we should request clarification for client-specific queries with many results
    if (searchFilters.client && shouldRequestClarification(correctedChunks, query)) {
      const clarificationResponse = generateClarificationResponse(correctedChunks, searchFilters.client);
      return NextResponse.json({
        answer: clarificationResponse,
        sources: [],
        context: {
          lastClient: explicitClient || searchFilters.client || context?.lastClient,
          lastQuery: query
        },
        appliedFilters,
        suggestions: []
      });
    }

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

    // Detect format preferences from the query
    const formatInstructions = extractFormatInstructions(query);
    
    const answer = await answerQuestion(
      contextualPrompt + query, 
      correctedChunks.slice(0, 5), // Limit to top 5 for answer generation
      formatInstructions
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
        lastSector: correctedChunks[0]?.sector,
        lastSuccessfulResults: correctedChunks.length > 0 ? correctedChunks.slice(0, 10).map(chunk => ({
          id: chunk.id,
          filename: chunk.filename,
          client: chunk.client || chunk.metadata?.client,
          content: chunk.content
        })) : undefined
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