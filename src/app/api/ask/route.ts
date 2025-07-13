import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarProposals, hybridSearchProposals, supabaseAdmin } from '@/lib/supabase';
import { generateEmbedding, answerQuestion, detectConsultantQueryType } from '@/lib/openai';
import { AskRequest, AskResponse, ConversationContext, AppliedFilters, DuplicateInfo } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';

// Get ALL proposals for a specific client (comprehensive search with intelligent matching)
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

    // Use intelligent client matching with multiple strategies
    const matchingProposals = data.filter(proposal => {
      const proposalClient = proposal.metadata?.client || proposal.client || '';
      return isClientMatch(proposalClient, clientName);
    });

    console.log(`Found ${matchingProposals.length} total proposals for ${clientName}`);
    return matchingProposals;
  } catch (error) {
    console.error('Error in getAllProposalsForClient:', error);
    return [];
  }
}

// Intelligent client matching using multiple strategies
// Generic word-overlap similarity for client matching
function calculateWordOverlapSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  // Normalize: lowercase, remove common words, split into words
  const stopWords = new Set(['inc', 'corp', 'llc', 'ltd', 'company', 'group', 'consulting', 'partners']);
  
  const words1 = name1.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word));
    
  const words2 = name2.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1 && !stopWords.has(word));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Calculate overlap using Jaccard similarity
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set(Array.from(set1).concat(Array.from(set2)));
  
  return intersection.size / union.size;
}

// Simple client matching using word overlap
function isClientMatch(storedClient: string, searchClient: string): boolean {
  if (!storedClient || !searchClient) return false;
  
  // Use word overlap similarity with threshold 0.4
  return calculateWordOverlapSimilarity(storedClient, searchClient) >= 0.4;
}

// Intelligent filtering for when client has many proposals
function shouldRequestClarification(chunks: any[], query: string): boolean {
  if (chunks.length === 0) return false;
  
  // Count unique proposals/files
  const uniqueProposals = new Set(chunks.map(chunk => chunk.metadata?.filename || chunk.filename));
  
  // Only request clarification for very large result sets with vague queries
  const isVagueQuery = !query.toLowerCase().includes('recent') && 
                      !query.toLowerCase().includes('latest') &&
                      !query.toLowerCase().includes('chronological') &&
                      !query.toLowerCase().includes('specific') &&
                      !query.toLowerCase().match(/\d{4}/) && // No year mentioned
                      !query.toLowerCase().includes('project') && // Not asking about specific project
                      !query.toLowerCase().includes('approach') &&
                      !query.toLowerCase().includes('methodology') &&
                      !query.toLowerCase().includes('timeline') &&
                      !query.toLowerCase().includes('deliverable') &&
                      !query.toLowerCase().includes('team') &&
                      !query.toLowerCase().includes('outcome') &&
                      !query.toLowerCase().includes('result');
  
  // More reasonable threshold - trigger for large result sets (8+ unique files OR 50+ chunks)
  const hasTooManyResults = uniqueProposals.size >= 8 || chunks.length >= 50;
  
  // Check if query is extremely vague (less than 3 meaningful words)
  const meaningfulWords = query.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !['what', 'when', 'where', 'which', 'have', 'does', 'been', 'work', 'done'].includes(word));
  
  const isExtremelyVague = meaningfulWords.length < 3;
  
  return hasTooManyResults && isVagueQuery && isExtremelyVague;
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
  // First check if this is a methodology/approach query - these should NOT have client filters
  const isMethodologyQuery = /how (do )?(we|you) (typically|usually|normally|approach|handle|conduct|structure)/i.test(query) ||
                            /what is (our|your) (typical|usual|standard|normal) approach/i.test(query) ||
                            /what is (our|your) methodology/i.test(query) ||
                            /best practices/i.test(query) ||
                            /how (do|should) (we|you) approach/i.test(query);
  
  if (isMethodologyQuery) {
    return null; // Don't extract client for methodology queries
  }
  
  // Look for explicit client mentions with specific patterns (more conservative)
  // Only match known client names or clear organizational patterns
  const knownClients = ['MGT', 'PowerParts', 'Crux', 'Chamber', 'Baton Rouge', 'STARC', 'Trive', 'R&R Partners', 'Texas Mutual', 'wear blue'];
  
  // Check for known clients first
  for (const client of knownClients) {
    if (new RegExp(`\\b${client}\\b`, 'i').test(query)) {
      console.log('🔍 Known client found:', client);
      return client;
    }
  }
  
  // More specific patterns that avoid common false positives
  const clientPatterns = [
    /\bfor ([A-Z][A-Za-z\s&\.]{3,20}(?:\s+(?:Inc|Corp|LLC|Ltd|Group|Company|Partners)\b)?)/i, // "for ClientName" with optional legal entity
    /\b([A-Z]{2,}(?:\s+[A-Z]{2,})?)\b/, // All caps acronyms like MGT, IBM, etc. (NO case-insensitive flag to avoid false positives)
    /\bwith ([A-Z][A-Za-z\s&\.]{3,20}(?:\s+(?:Inc|Corp|LLC|Ltd|Group|Company|Partners)\b)?)/i, // "with ClientName"
    /\bat ([A-Z][A-Za-z\s&\.]{3,20}(?:\s+(?:Inc|Corp|LLC|Ltd|Group|Company|Partners)\b)?)/i // "at ClientName"
  ];
  
  for (const pattern of clientPatterns) {
    const match = query.match(pattern);
    if (match) {
      const client = match[1].trim();
      // Exclude common false positives and industry terms
      const excludeWords = ['You', 'The', 'This', 'That', 'Those', 'These', 'What', 'When', 'Where', 'How', 'Why', 'Have', 'Done', 'Work', 'Been', 'Will', 'Can', 'Should', 'Could', 'Would', 'Doing', 'Getting', 'Making', 'Taking', 'Going', 'Coming', 'Being', 'Having', 'About', 'Pricing', 'Studies', 'Tell', 'Show', 'Give', 'Find', 'Get', 'restaurants', 'healthcare', 'technology', 'manufacturing', 'retail', 'education', 'government', 'nonprofit', 'finance', 'banking'];
      
      if (client.length >= 3 && !excludeWords.some(word => word.toLowerCase() === client.toLowerCase())) {
        console.log('🔍 Client extraction attempting:', client);
        return client;
      }
    }
  }
  
  return null;
}

function hasSemanticTopicShift(currentQuery: string, previousQuery: string): boolean {
  // Simple semantic shift detection based on keyword overlap
  const getCurrentKeyWords = (query: string) => {
    return query.toLowerCase()
      .replace(/\b(what|how|when|where|which|who|why|give|me|show|tell|about|work|projects|proposals|consulting|have|we|did|for|our|your|approach|methodology|is|are|the|and|or|in|on|at|with|can|you|do|does|been|will|should|could|would|typically|usually|normally|handle|conduct|structure)\b/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5); // Get top 5 meaningful words
  };
  
  const currentKeywords = getCurrentKeyWords(currentQuery);
  const previousKeywords = getCurrentKeyWords(previousQuery);
  
  // Calculate word overlap
  const commonWords = currentKeywords.filter(word => previousKeywords.includes(word));
  const overlapRatio = commonWords.length / Math.max(currentKeywords.length, previousKeywords.length);
  
  // If less than 20% overlap, it's likely a topic shift
  return overlapRatio < 0.2;
}

function isFollowUpQuery(query: string, context?: any): boolean {
  const queryLower = query.toLowerCase().trim();
  
  // If query has specific client names, it's likely a new topic
  const hasExplicitClient = /\b(MGT|PowerParts|Crux|Chamber|Baton Rouge|STARC|Trive|R&R Partners|Texas Mutual|wear blue)\b/i.test(query);
  
  if (hasExplicitClient) {
    return false;
  }
  
  // If we have context (lastClient, lastQuery, or lastSuccessfulResults) and the query doesn't start a new topic, treat as follow-up
  const hasContext = context && (context.lastClient || context.lastQuery || context.lastSuccessfulResults);
  
  // Enhanced new topic detection - recognize when switching to completely different domains
  const startsNewTopic = (
    // Direct questions about new clients/topics
    /^(what|how|when|where|which|who|why|give me|show me|tell me about)\s+(work|projects|proposals|consulting)\s+(have we|did we|for)\s/i.test(queryLower) ||
    // General methodology questions
    /^(what|how)\s+(is|are)\s+(our|your)\s+(approach|methodology)/i.test(queryLower) ||
    // Sector/industry keywords that clearly indicate new topics
    /\b(restaurants?|retail|healthcare|manufacturing|technology|education|finance|banking|insurance|government|nonprofit|energy|automotive|real estate|hospitality|construction|logistics|pharma|biotech|agriculture|media|entertainment|sports|travel|tourism|legal|advertising|marketing|private equity|venture capital|investment|asset management|hedge fund|pension|endowment|foundation|charity|NGO|startup|supply chain|procurement|HR|recruiting|training|leadership|governance|compliance|risk|audit|tax|accounting|data|analytics|AI|machine learning|blockchain|crypto|cloud|cybersecurity|digital|mobile|app|platform|marketplace|network|infrastructure|branding|content|research|market research|due diligence|valuation|sales|business development|pricing|campaign|social impact|environmental|climate|sustainability|ESG|carbon|renewable|solar|wind|fintech|saas|software|hardware|telecommunications|aerospace|defense|mining|oil|gas|ecommerce|B2B|B2C|enterprise|global|international|domestic|regional)\b/i.test(queryLower) ||
    // Semantic relatedness check - if we have previous context, check if current query is related
    (context?.lastQuery && hasSemanticTopicShift(queryLower, context.lastQuery))
  ) && !/(more|additional|else|other|similar|about|recent|latest)/i.test(queryLower);
  
  if (hasContext && !startsNewTopic) {
    console.log('🔄 Treating as follow-up due to context and non-new-topic pattern');
    return true;
  }
  
  // Specific follow-up indicators
  const followUpIndicators = [
    // Demonstrative pronouns
    /^(the|that|this|those|these)\s/i,
    
    // Continuation/expansion requests
    /\b(more|additional|other|similar|else)\b/i,
    /\b(details?|information|specifics)\b/i,
    
    // Ordering/formatting requests
    /\b(in order|by date|chronological|sorted|organized)\b/i,
    
    // Follow-up question words
    /^(any|anything|can you|do we|did we|have we)\b/i,
    
    // Continuation conjunctions
    /^(also|additionally|furthermore|moreover|and|but|however|although)\b/i,
    
    // Short queries (often follow-ups) - but not questions that clearly start new topics
    queryLower.length < 20 && !/^(what|how|when|where|which|who|why)\b/i.test(queryLower),
    
    // Questions about "them" or "it" (referring to previous results)
    /\b(them|it|they)\b/i,
    
    // Ambiguity resolution responses (single word answers to clarification questions)
    /^(external|internal|client|project management|change management|executive management|business development|software development|talent development|oem clients|oem parts|oem vendors)$/i
  ];
  
  return followUpIndicators.some(indicator => 
    typeof indicator === 'boolean' ? indicator : indicator.test(queryLower)
  );
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
    // REMOVED: consulting ambiguity - too aggressive and unhelpful
    // { 
    //   term: 'consulting', 
    //   clarification: 'Are you looking for internal consulting work or external client consulting?',
    //   clarifiedTerms: ['internal consulting', 'external consulting', 'client consulting'] 
    // },
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
      const union = new Set(Array.from(words1).concat(Array.from(words2)));
  
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

// Simply return the client name as-is (no hardcoded mappings)
function normalizeClientName(clientName: string | undefined): string {
  if (!clientName) return 'Unknown Client';
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

// Enhanced context retention functions
function extractEntitiesFromResponse(response: string, chunks: any[]): string[] {
  const entities = [];
  
  // Extract client names from chunks
  const clients = chunks.map(c => c.client || c.metadata?.client).filter(Boolean);
  entities.push(...clients);
  
  // Extract project names from response
  const projectMatches = response.match(/Project Name?:\s*([^\n]+)/gi);
  if (projectMatches) {
    entities.push(...projectMatches.map(m => m.split(':')[1].trim()));
  }
  
  // Extract company names from response (look for capitalized phrases)
  const companyMatches = response.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Corp|LLC|Ltd|Company|Group|Partners))?/g);
  if (companyMatches) {
    // Filter out common words and keep only likely company names
    const filteredCompanies = companyMatches.filter(match => 
      !['The', 'This', 'That', 'These', 'Those', 'Project', 'Client', 'Company', 'Team', 'Work', 'Phase', 'Stage'].includes(match) &&
      match.length > 3
    );
    entities.push(...filteredCompanies.slice(0, 5)); // Limit to avoid noise
  }
  
  // Remove duplicates manually
  const uniqueEntities: string[] = [];
  for (const entity of entities) {
    if (!uniqueEntities.includes(entity)) {
      uniqueEntities.push(entity);
    }
  }
  
  return uniqueEntities;
}

function extractProjectNameFromResponse(response: string): string | undefined {
  // Look for project name patterns in the response
  const projectPatterns = [
    /Project Name?:\s*([^\n]+)/i,
    /project called\s+([^\n,]+)/i,
    /project for\s+([^\n,]+)/i,
    /working on\s+([^\n,]+)/i
  ];
  
  for (const pattern of projectPatterns) {
    const match = response.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return undefined;
}

function resolveFollowUpReference(query: string, context: ConversationContext): { expandedQuery: string; shouldUseRecentChunks: boolean; targetEntities: string[] } {
  const pronounReferences = [
    'who was the project lead',
    'who was the author', 
    'who led this',
    'what was the timeline',
    'tell me more about this',
    'what was the outcome',
    'what were the deliverables',
    'how long did it take',
    'what was the approach',
    'who was involved',
    'what was the budget',
    'when did this happen'
  ];
  
  const hasPronouns = pronounReferences.some(ref => 
    query.toLowerCase().includes(ref.toLowerCase())
  );
  
  if (hasPronouns && context.conversationHistory && context.conversationHistory.length > 0) {
    // Get the most recent entities discussed
    const recentHistory = context.conversationHistory.slice(-3);
    const recentEntities = recentHistory.flatMap(h => h.entities);
    
    // Prioritize current active entities
    const targetEntities = [
      context.activeEntities?.currentProject,
      context.activeEntities?.currentClient,
      ...recentEntities
    ].filter((entity): entity is string => Boolean(entity));
    
    // Expand query with context
    return {
      expandedQuery: `${query} for ${targetEntities.slice(0, 2).join(' ')}`,
      shouldUseRecentChunks: true,
      targetEntities: targetEntities.slice(0, 3)
    };
  }
  
  return { expandedQuery: query, shouldUseRecentChunks: false, targetEntities: [] };
}

function resolvePronounsInQuery(query: string, context: ConversationContext): string {
  let resolvedQuery = query;
  
  // "who was the project lead?" → "who was the project lead for Mo'Bettahs?"
  if (query.match(/who was (the )?(project lead|author|lead)/i)) {
    const recentClient = context.activeEntities?.currentClient;
    const recentProject = context.activeEntities?.currentProject;
    
    if (recentClient || recentProject) {
      resolvedQuery += ` for ${recentProject || recentClient}`;
    }
  }
  
  // "what was the timeline?" → "what was the timeline for Mo'Bettahs project?"
  if (query.match(/what was (the )?(timeline|duration|schedule|approach|outcome|result)/i)) {
    const recentEntity = context.activeEntities?.currentClient || 
                        context.activeEntities?.currentProject;
    if (recentEntity) {
      resolvedQuery += ` for ${recentEntity}`;
    }
  }
  
  // "tell me more" → "tell me more about Mo'Bettahs"
  if (query.match(/tell me more|more details|more information|additional details/i)) {
    const recentEntity = context.activeEntities?.currentProject || 
                        context.activeEntities?.currentClient;
    if (recentEntity) {
      resolvedQuery = `tell me more about ${recentEntity}`;
    }
  }
  
  return resolvedQuery;
}

async function searchWithinChunks(query: string, chunkIds: string[], options: { fallbackToGlobal?: boolean } = {}): Promise<any[]> {
  try {
    // First, try to search within the specified chunks
    const { data: recentChunks, error: recentError } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .in('id', chunkIds)
      .limit(10);
    
    if (recentError) {
      console.error('Error fetching recent chunks:', recentError);
      if (options.fallbackToGlobal) {
        // Fallback to global search
        const embedding = await generateEmbedding(query);
        return await hybridSearchProposals(query, embedding, 10, {});
      }
      return [];
    }
    
    const chunks = recentChunks || [];
    
    // Rank by semantic similarity to the query
    if (chunks.length > 0) {
      const scoredChunks = chunks.map(chunk => ({
        ...chunk,
        similarity: calculateTextSimilarity(query, chunk.content)
      }));
      const sortedChunks = scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      
      // If we have good matches, return them
      if (sortedChunks.length > 0 && sortedChunks[0].similarity > 0.1) {
        return sortedChunks;
      }
    }
    
    // If no good matches and fallback is enabled, do global search
    if (options.fallbackToGlobal) {
      console.log('No good matches in recent chunks, falling back to global search');
      const embedding = await generateEmbedding(query);
      return await hybridSearchProposals(query, embedding, 10, {});
    }
    
    return chunks;
  } catch (error) {
    console.error('Error in searchWithinChunks:', error);
    return [];
  }
}

// Helper function to create default conversation context
function createDefaultContext(context?: ConversationContext): ConversationContext {
  return {
    conversationHistory: context?.conversationHistory || [],
    activeEntities: context?.activeEntities || {
      discussedClients: [],
      discussedProjects: []
    },
    conversationTurn: (context?.conversationTurn || 0) + 1,
    lastSuccessfulResults: context?.lastSuccessfulResults,
    // Legacy fields for backward compatibility
    lastClient: context?.lastClient,
    lastSector: context?.lastSector,
    lastQuery: context?.lastQuery
  };
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

    console.log('=== REQUEST DETAILS ===');
    console.log('Query:', query);
    console.log('Context received:', JSON.stringify(context, null, 2));

    // Create enhanced context with defaults
    const enhancedContext = createDefaultContext(context);
    console.log('Enhanced context created:', JSON.stringify(enhancedContext, null, 2));

    // Check for ambiguity first
    const ambiguityCheck = detectAmbiguity(query);
    if (ambiguityCheck.isAmbiguous) {
      return NextResponse.json({
        answer: `I need clarification: ${ambiguityCheck.clarification}`,
        sources: [],
        context: enhancedContext,
        appliedFilters: { contextSource: 'none' },
        chunk_ids: [],
        query_type: detectConsultantQueryType(query)
      });
    }

    // Smart context detection with enhanced follow-up resolution
    let searchFilters: any = {};
    let enhancedQuery = query;
    
    // Determine if this is a follow-up query
    const isFollowUp = isFollowUpQuery(query, enhancedContext);
    console.log('🔄 Follow-up Detection:', isFollowUp);
    
    // Apply pronoun resolution if this is a follow-up
    if (isFollowUp) {
      enhancedQuery = resolvePronounsInQuery(query, enhancedContext);
      console.log('🔧 Pronoun-resolved query:', enhancedQuery);
      
      // Try advanced follow-up reference resolution
      const followUpResolution = resolveFollowUpReference(query, enhancedContext);
      if (followUpResolution.shouldUseRecentChunks) {
        enhancedQuery = followUpResolution.expandedQuery;
        console.log('🎯 Follow-up resolved query:', enhancedQuery);
      }
    }
    
    // Extract explicit client only if not a follow-up
    const explicitClient = isFollowUp ? null : extractClientFromQuery(query);
    console.log('👤 Client Extraction:', explicitClient);
    
    // Track applied filters
    const appliedFilters: AppliedFilters = {
      contextSource: 'none'
    };
    
    // Apply context-aware filtering
    if (explicitClient) {
      searchFilters.client = explicitClient;
      appliedFilters.client = explicitClient;
      appliedFilters.contextSource = 'explicit';
    } else if (isFollowUp) {
      // Enhanced follow-up handling
      const followUpResolution = resolveFollowUpReference(query, enhancedContext);
      
      if (followUpResolution.shouldUseRecentChunks && enhancedContext.conversationHistory.length > 0) {
        // Use recent conversation context
        appliedFilters.contextSource = 'topic-followup';
        const recentChunkIds = enhancedContext.conversationHistory
          .slice(-3)
          .flatMap(h => h.resultChunks);
        searchFilters.previousResultIds = recentChunkIds;
        console.log('Using recent chunk IDs:', recentChunkIds.slice(0, 5));
      } else if (enhancedContext.activeEntities?.currentClient) {
        // Use current client context
        appliedFilters.contextSource = 'client-followup';
        searchFilters.client = enhancedContext.activeEntities.currentClient;
        console.log('Using current client context:', enhancedContext.activeEntities.currentClient);
      } else if (enhancedContext.lastClient) {
        // Fallback to legacy client context
        appliedFilters.contextSource = 'client-followup';
        searchFilters.client = enhancedContext.lastClient;
        console.log('Using legacy client context:', enhancedContext.lastClient);
      } else {
        appliedFilters.contextSource = 'followup-no-context';
      }
    }

    // Determine search strategy
    let similarChunks: any[] = [];
    let searchResult: any = null;
    
    if (searchFilters.previousResultIds && searchFilters.previousResultIds.length > 0) {
      // CONTEXTUAL FOLLOW-UP: Search within recent results
      console.log('Using contextual follow-up search');
      similarChunks = await searchWithinChunks(enhancedQuery, searchFilters.previousResultIds, { fallbackToGlobal: true });
    } else if (searchFilters.client) {
      // CLIENT-SPECIFIC QUERY
      console.log(`Using client-specific search for: ${searchFilters.client}`);
      similarChunks = await getAllProposalsForClient(searchFilters.client);
      
      if (similarChunks.length > 20) {
        const scoredChunks = similarChunks.map(chunk => ({
          ...chunk,
          similarity: calculateTextSimilarity(enhancedQuery, chunk.content)
        }));
        similarChunks = scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
      }
    } else {
      // Check for methodology query
      const isMethodologyQuery = /how (do )?(we|you) (typically|usually|normally|approach|handle|conduct|structure)/i.test(query) ||
                                /what is (our|your) (typical|usual|standard|normal) approach/i.test(query) ||
                                /what is (our|your) methodology/i.test(query) ||
                                /best practices/i.test(query) ||
                                /how (do|should) (we|you) approach/i.test(query);
      
      if (isMethodologyQuery) {
        // METHODOLOGY QUERY
        console.log('Using methodology search');
        const keyTerms = query.toLowerCase()
          .replace(/how (do )?(we|you) (typically|usually|normally|approach|handle|conduct|structure)/gi, '')
          .replace(/what is (our|your) (typical|usual|standard|normal) approach/gi, '')
          .replace(/\b(to|for|the|and|or|in|on|at|with|about)\b/g, '')
          .split(/\s+/)
          .filter(term => term.length > 3 && !['what', 'when', 'where', 'which', 'have', 'does', 'been', 'will', 'can', 'should', 'could', 'would', 'typically', 'usually', 'approach', 'methodology'].includes(term))
          .slice(0, 3);
        
        if (keyTerms.length > 0) {
          const textSearchConditions = keyTerms.map(term => `content.ilike.%${term}%`).join(',');
          const { data: methodologyResults, error: methodologyError } = await supabaseAdmin
            .from('proposals')
            .select('*')
            .or(textSearchConditions)
            .limit(50)
            .order('created_at', { ascending: false });
          
          if (methodologyError) {
            console.error('Error in methodology search:', methodologyError);
            similarChunks = [];
          } else {
            similarChunks = methodologyResults || [];
            if (similarChunks.length > 0) {
              const scoredChunks = similarChunks.map(chunk => ({
                ...chunk,
                similarity: calculateTextSimilarity(enhancedQuery, chunk.content)
              }));
              similarChunks = scoredChunks.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
            }
          }
        } else {
          const embedding = await generateEmbedding(enhancedQuery);
          similarChunks = await hybridSearchProposals(enhancedQuery, embedding, 20, searchFilters);
        }
      } else {
        // GENERAL QUERY: Use enhanced multi-stage search
        console.log('Using enhanced multi-stage search');
        const { enhancedSearch } = await import('@/lib/supabase');
        searchResult = await enhancedSearch(enhancedQuery, 10, searchFilters);
        similarChunks = searchResult.results;
      }
    }

    if (similarChunks.length === 0) {
      const emptyMessage = searchFilters.client 
        ? `I don't have any historical proposals for ${searchFilters.client} that match your question.`
        : "I don't have any historical proposals that match your question.";
      
      return NextResponse.json({
        answer: emptyMessage,
        sources: [],
        context: enhancedContext,
        appliedFilters,
        chunk_ids: [],
        query_type: detectConsultantQueryType(query)
      });
    }

    // Apply corrections and continue with existing logic
    const correctedChunks = await applyCorrections(similarChunks);

    // Check for clarification request
    if (searchFilters.client && shouldRequestClarification(correctedChunks, query)) {
      const clarificationResponse = generateClarificationResponse(correctedChunks, searchFilters.client);
      return NextResponse.json({
        answer: clarificationResponse,
        sources: [],
        context: enhancedContext,
        appliedFilters,
        suggestions: [],
        chunk_ids: correctedChunks.slice(0, 10).map(chunk => chunk.id),
        query_type: detectConsultantQueryType(query)
      });
    }

    // Generate answer
    const duplicateWarnings = detectDuplicates(correctedChunks);
    let contextualPrompt = '';
    if (searchFilters.client) {
      contextualPrompt = `Focus specifically on work done for ${searchFilters.client}. `;
    }
    if (query.includes('order') && query.includes('date')) {
      contextualPrompt += 'Present the information in chronological order by project date. ';
    }

    const formatInstructions = extractFormatInstructions(query);
    const isMethodologyQuery = /how (do )?(we|you) (typically|usually|normally|approach|handle|conduct|structure)/i.test(query) ||
                              /what is (our|your) (typical|usual|standard|normal) approach/i.test(query) ||
                              /what is (our|your) methodology/i.test(query) ||
                              /best practices/i.test(query) ||
                              /how (do|should) (we|you) approach/i.test(query);
    
    const chunksForAnswer = isMethodologyQuery ? correctedChunks.slice(0, 15) : correctedChunks.slice(0, 5);
    const usedChunkIds = chunksForAnswer.map(chunk => chunk.id);
    const queryType = detectConsultantQueryType(query);
    
    const answer = await answerQuestion(contextualPrompt + query, chunksForAnswer, formatInstructions);
    const formattedResponse = formatResponseForQuery(query, correctedChunks, answer);

    // Extract entities from the response for context tracking
    const responseEntities = extractEntitiesFromResponse(formattedResponse.answer, correctedChunks);
    const extractedProject = extractProjectNameFromResponse(formattedResponse.answer);

    // Build enhanced response context
    const conversationEntry = {
      query,
      response: formattedResponse.answer,
      entities: responseEntities,
      queryType,
      resultChunks: usedChunkIds,
      timestamp: new Date()
    };

    const updatedContext: ConversationContext = {
      conversationHistory: [
        ...(enhancedContext.conversationHistory || []),
        conversationEntry
      ].slice(-10), // Keep last 10 turns
      activeEntities: {
        currentClient: explicitClient || searchFilters.client || enhancedContext.activeEntities?.currentClient,
        currentProject: extractedProject || enhancedContext.activeEntities?.currentProject,
        currentSector: correctedChunks[0]?.sector || enhancedContext.activeEntities?.currentSector,
                 discussedClients: [
           ...(enhancedContext.activeEntities?.discussedClients || []),
           explicitClient || searchFilters.client
         ].filter((client): client is string => Boolean(client)).slice(-5),
         discussedProjects: [
           ...(enhancedContext.activeEntities?.discussedProjects || []),
           extractedProject
         ].filter((project): project is string => Boolean(project)).slice(-5)
      },
      conversationTurn: enhancedContext.conversationTurn,
      lastSuccessfulResults: correctedChunks.length > 0 ? correctedChunks.slice(0, 10).map(chunk => ({
        id: chunk.id,
        filename: chunk.filename,
        client: chunk.client || chunk.metadata?.client,
        content: chunk.content
      })) : enhancedContext.lastSuccessfulResults,
      // Legacy fields
      lastClient: explicitClient || searchFilters.client,
      lastQuery: query,
      lastSector: correctedChunks[0]?.sector
    };

    // Generate suggestions using enhanced context
    const suggestions = generateProactiveFollowups(query, updatedContext, correctedChunks);

    const response: AskResponse = {
      ...formattedResponse,
      context: updatedContext,
      appliedFilters,
      suggestions,
      duplicateWarnings: duplicateWarnings.length > 0 ? duplicateWarnings : undefined,
      chunk_ids: usedChunkIds,
      query_type: queryType,
      searchMetadata: {
        queryExpansion: searchResult?.searchMetadata?.queryExpansion,
        stageResults: searchResult?.searchMetadata?.stageResults,
        processingTime: searchResult?.searchMetadata?.processingTime,
        searchStrategy: searchFilters.client ? 'client-specific' : 
                       isMethodologyQuery ? 'methodology' : 'enhanced-semantic'
      }
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