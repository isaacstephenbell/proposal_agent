import OpenAI from 'openai';

// Load environment variables if running in Node.js (not browser)
if (typeof window === 'undefined') {
  require('dotenv').config({ path: '.env.local' });
}

// Lazy initialize OpenAI to avoid early environment issues
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

// Canonical author list from specification
const CANONICAL_AUTHORS = [
  'Aaron Andersen',
  'Jacob Allen',
  'James Shirey',
  'Jason Richards',
  'Miguel Howe',
  'Dan Case',
  'Douglas Hervey',
  'George Durham',
  'Michael Jensen',
  'Mike Jensen', // Alternative name for Michael Jensen
  'Rory Brosius',
  'Aaron Jorgensen',
  'Benjamin Aplanalp',
  'George Wong',
  'Michael Jenson'
];

// Default author from existing codebase
const DEFAULT_AUTHOR = 'Unknown';

// Sector classification from specification
const VALID_SECTORS = [
  'social-impact',
  'private-equity-due-diligence',
  'corporate',
  'higher-education',
  'other'
];

export interface DocumentMetadata {
  sector: string;
  tags: string[];
  author: string;
  date?: string;
  client?: string;
}

export async function extractMetadataFromDocument(content: string): Promise<DocumentMetadata> {
  try {
    console.log('  🔍 Extracting metadata from full document...');
    
    // Extract author using fuzzy matching
    const author = extractAuthorWithFuzzyMatching(content);
    
    // Extract date using enhanced regex patterns
    const date = extractProposalDate(content);
    
    // Extract client information
    const client = extractClient(content);
    
    // Use LLM for sector classification and tag generation
    const llmAnalysis = await analyzeWithLLM(content);
    
    return {
      sector: llmAnalysis.sector,
      tags: llmAnalysis.tags,
      author,
      date,
      client
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      sector: 'other',
      tags: [],
      author: DEFAULT_AUTHOR,
      date: undefined,
      client: undefined
    };
  }
}

function extractAuthorWithFuzzyMatching(content: string): string {
  const foundAuthors: string[] = [];
  
  // Check for each canonical author in the document
  for (const authorName of CANONICAL_AUTHORS) {
    // Look for the author name in the content (case insensitive)
    const regex = new RegExp(`\\b${authorName.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (regex.test(content)) {
      if (!foundAuthors.includes(authorName)) {
        foundAuthors.push(authorName);
      }
    }
  }
  
  if (foundAuthors.length > 0) {
    return foundAuthors.join(', ');
  } else {
    return 'not found';
  }
}

function extractPotentialAuthors(content: string): string[] {
  const authors: string[] = [];
  
  // Priority 1: "Accepted and Agreed to" section with Cicero
  const acceptedPattern = /Accepted and Agreed to[:\s]*\n.*?Cicero[:\s]*\n.*?By:\s*([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const acceptedMatch = acceptedPattern.exec(content);
  if (acceptedMatch) {
    authors.push(acceptedMatch[1]);
  }
  
  // Priority 2: "Cicero" section with "By:" pattern
  const ciceroPattern = /Cicero[:\s]*\n.*?By:\s*([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const ciceroMatch = ciceroPattern.exec(content);
  if (ciceroMatch) {
    authors.push(ciceroMatch[1]);
  }
  
  // Priority 3: "Cicero" or "Consulting Team" sections
  const consultingPattern = /(?:Cicero|Consulting Team)[:\s]*\n.*?([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const consultingMatch = consultingPattern.exec(content);
  if (consultingMatch) {
    authors.push(consultingMatch[1]);
  }
  
  // Priority 4: Common signature patterns
  const signaturePatterns = [
    /(?:Prepared by|Author|Contact)[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+)[\s]*\n.*?(?:Partner|Principal|Director|Manager)/gi,
    /(?:Best regards|Sincerely)[,\s]*\n([A-Z][a-z]+ [A-Z][a-z]+)/gi
  ];
  
  for (const pattern of signaturePatterns) {
    const match = pattern.exec(content);
    if (match) {
      authors.push(match[1]);
    }
  }
  
  // Priority 5: Look for canonical author names directly in text (broader search)
  for (const canonicalAuthor of CANONICAL_AUTHORS) {
    // Simple contains check for exact matches
    if (content.includes(canonicalAuthor)) {
      authors.push(canonicalAuthor);
    }
  }
  
  // Priority 6: Extract all potential name patterns and let fuzzy matching decide
  const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
  let match;
  while ((match = namePattern.exec(content)) !== null) {
    const name = match[1];
    // Skip common false positives
    if (!['United States', 'New York', 'Los Angeles', 'San Francisco', 'North America', 'South America'].includes(name)) {
      authors.push(name);
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(authors));
}

function findBestAuthorMatch(potentialAuthor: string, canonicalAuthors: string[]): { author: string; similarity: number } {
  let bestMatch = { author: DEFAULT_AUTHOR, similarity: 0 };
  
  for (const canonicalAuthor of canonicalAuthors) {
    const similarity = calculateStringSimilarity(potentialAuthor.toLowerCase(), canonicalAuthor.toLowerCase());
    if (similarity > bestMatch.similarity) {
      bestMatch = { author: canonicalAuthor, similarity };
    }
  }
  
  return bestMatch;
}

function calculateStringSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance implementation
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const maxLength = Math.max(len1, len2);
  return 1 - (matrix[len2][len1] / maxLength);
}

function extractProposalDate(content: string): string | undefined {
  // Enhanced date extraction patterns focusing on proposal dates
  const datePatterns = [
    // Header/footer date patterns
    /(?:Date|Dated|Submitted|Prepared)[:\s]*([A-Z][a-z]+ \d{1,2},? \d{4})/gi,
    /(?:Proposal Date|Date of Proposal)[:\s]*([A-Z][a-z]+ \d{1,2},? \d{4})/gi,
    // General date patterns in first few paragraphs
    /([A-Z][a-z]+ \d{1,2},? \d{4})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    /(\d{4}-\d{2}-\d{2})/g
  ];
  
  // Focus on first 2000 characters for proposal date
  const contentPreview = content.substring(0, 2000);
  
  for (const pattern of datePatterns) {
    const match = pattern.exec(contentPreview);
    if (match) {
      const dateStr = match[1];
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  return undefined;
}

function extractClient(content: string): string | undefined {
  // Look for client patterns in the document structure and context
  const contentPreview = content.substring(0, 2000);
  
  // Priority 1: Look for "Company:" labels at the top of the document
  const companyLabelPatterns = [
    /(?:Company|Client|Organization)[:\s]+([A-Z][A-Za-z\s&.-]+?)(?:\s|$|\.|\,|;|\n)/gi,
    /(?:^|\n)\s*Company[:\s]+([A-Z][A-Za-z\s&.-]+?)(?:\s|$|\.|\,|;|\n)/gim,
    /(?:^|\n)\s*Client[:\s]+([A-Z][A-Za-z\s&.-]+?)(?:\s|$|\.|\,|;|\n)/gim
  ];
  
  for (const pattern of companyLabelPatterns) {
    let match;
    while ((match = pattern.exec(contentPreview.substring(0, 800))) !== null) {
      const client = match[1].trim();
      if (isValidClient(client)) {
        console.log(`    🎯 Found client from company label: ${client}`);
        return client;
      }
    }
  }
  
  // Priority 2: Extract from document title context (filename patterns)
  const titleMatches = [
    // Pattern: "ClientName - Something" or "ClientName -- Something" 
    /^([A-Z][A-Za-z\s&.-]+?)\s*[-–—]+\s*(?:[A-Z][a-z]*\s*)*(?:Proposal|Study|Analysis|Report|Engagement|Market|Due|Diligence)/mi,
    // Pattern: "Something - ClientName" or "Something -- ClientName"
    /(?:Proposal|Study|Analysis|Report|Engagement|Market|Due|Diligence)\s*[-–—]+\s*([A-Z][A-Za-z\s&.-]+?)(?:\s|$)/mi,
    // Pattern: "ClientName Proposal" or "ClientName Study"
    /^([A-Z][A-Za-z\s&.-]+?)\s+(?:Proposal|Study|Analysis|Report|Engagement|Market|Due|Diligence)/mi
  ];
  
  for (const pattern of titleMatches) {
    const match = pattern.exec(contentPreview);
    if (match) {
      const client = match[1].trim();
      if (isValidClient(client)) {
        console.log(`    🎯 Found client in title: ${client}`);
        return client;
      }
    }
  }
  
  // Priority 3: Look for explicit client context in proposal structure
  const proposalContextPatterns = [
    // Look for "prepared for", "submitted to", etc.
    /(?:This\s+proposal\s+is\s+prepared\s+for|Prepared\s+for|Submitted\s+to|Proposal\s+for)\s+(?:the\s+)?([A-Z][A-Za-z\s&.-]+?)(?:\s+(?:regarding|for|to|on|in|engagement|project|study|analysis|\.|\,|;|$))/gi,
    // Look for "working with", "engagement with", etc.
    /(?:working\s+with|engagement\s+with|on\s+behalf\s+of)\s+(?:the\s+)?([A-Z][A-Za-z\s&.-]+?)(?:\s+(?:to|regarding|for|on|in|\.|\,|;))/gi
  ];
  
  for (const pattern of proposalContextPatterns) {
    let match;
    while ((match = pattern.exec(contentPreview)) !== null) {
      const client = match[1].trim();
      if (isValidClient(client)) {
        console.log(`    🎯 Found client in proposal context: ${client}`);
        return client;
      }
    }
  }
  
  // Priority 4: Look for company patterns in document header/beginning (first 500 chars)
  const headerText = contentPreview.substring(0, 500);
  const headerPatterns = [
    // Look for company suffixes that indicate business names
    /\b([A-Z][A-Za-z\s&.-]*(?:Corporation|Company|Corp|Inc|Incorporated|LLC|Ltd|Limited|Group|Organization|Foundation|Association|Institute|Society|Union|Council|Alliance|Network|Coalition|Initiative|Partners|Ventures|Industries|Solutions|Systems|Technologies|Advisory|Capital|Holdings|Enterprises|International|Services|Cross)\b)/gi,
    // Look for "Group" patterns specifically
    /\b([A-Z][A-Za-z\s&.-]+\s+Group)\b/gi,
    // Look for patterns like "The [Company Name]"
    /\bThe\s+([A-Z][A-Za-z\s&.-]+(?:Corporation|Company|Corp|Inc|Group|Organization|Foundation|Association|Institute|Society|Union|Council|Alliance|Network|Coalition|Initiative|Partners|Ventures|Industries|Solutions|Systems|Technologies|Advisory|Capital|Holdings|Enterprises|International|Services|Cross))\b/gi
  ];
  
  for (const pattern of headerPatterns) {
    let match;
    while ((match = pattern.exec(headerText)) !== null) {
      const client = match[1].trim();
      if (isValidClient(client)) {
        console.log(`    🎯 Found client in header: ${client}`);
        return client;
      }
    }
  }
  
  console.log(`    ❌ No client found after all attempts`);
  return undefined;
}

function hasCompanyIndicators(text: string): boolean {
  const textLower = text.toLowerCase();
  
  // Check for company-like words or patterns
  const companyIndicators = [
    'group', 'corp', 'corporation', 'inc', 'incorporated', 'llc', 'ltd', 'limited', 
    'company', 'co', 'partners', 'ventures', 'industries', 'solutions', 'systems', 
    'technologies', 'advisory', 'capital', 'holdings', 'enterprises', 'international',
    'foundation', 'association', 'institute', 'society', 'union', 'council', 
    'alliance', 'network', 'coalition', 'initiative', 'cross', 'services',
    'american', 'national', 'global', 'united', 'power', 'energy', 'tech',
    'media', 'financial', 'investment', 'management', 'consulting', 'development'
  ];
  
  return companyIndicators.some(indicator => textLower.includes(indicator));
}

function isValidClient(client: string): boolean {
  if (!client || client.length < 3 || client.length > 50) return false;
  
  const clientLower = client.toLowerCase();
  
  // Exclude Cicero-related entities (consulting company)
  if (clientLower.includes('cicero') || 
      clientLower.includes('consulting group') || 
      clientLower.includes('cicerogroup')) {
    return false;
  }
  
  // Exclude person names (common first names)
  const personNames = [
    'james', 'alex', 'alexandra', 'alexander', 'michael', 'dan', 'daniel', 'douglas', 'doug',
    'george', 'rory', 'aaron', 'benjamin', 'jacob', 'miguel', 'jason', 'mike', 'jennica',
    'tyler', 'chris', 'andres', 'allison', 'sam', 'mahesh', 'nerissa', 'jaime', 'lisa',
    'katie', 'stacy', 'halley', 'craig', 'ralph', 'josh', 'jack', 'trey', 'lara'
  ];
  
  for (const name of personNames) {
    if (clientLower === name || clientLower.startsWith(name + ' ')) {
      return false;
    }
  }
  
  // Exclude common false positives
  const excludePatterns = [
    'the following', 'united states', 'new york', 'los angeles', 'san francisco',
    'executive summary', 'project title', 'business background', 'recommended approach',
    'salt lake', 'rio grande', 'harvard business', 'brigham young', 'northwestern university',
    'solution family', 'group client', 'operating group', 'market group', 'project team',
    'engagement team', 'consulting team', 'prior experience', 'private equity', 'unique value',
    'value proposition', 'professional arrangements', 'professional fees', 'hard costs',
    'travel expenses', 'project fees', 'total project', 'estimated project', 'business model',
    'market study', 'market size', 'market trends', 'competitive landscape', 'growth drivers',
    'key deliverables', 'focus group', 'competitive analysis', 'market segmentation',
    'business analysts', 'social impact', 'engagement manager', 'senior director',
    'research associate', 'customer strategy', 'legal analyst', 'project manager'
  ];
  
  for (const exclude of excludePatterns) {
    if (clientLower.includes(exclude)) {
      return false;
    }
  }
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(client)) return false;
  
  // Additional validation - avoid generic business terms
  const genericTerms = ['business', 'project', 'proposal', 'study', 'analysis', 'report', 
                       'engagement', 'market', 'due', 'diligence', 'professional', 'service'];
  
  for (const term of genericTerms) {
    if (clientLower === term) {
      return false;
    }
  }
  
  return true;
}

async function analyzeWithLLM(content: string): Promise<{ sector: string; tags: string[] }> {
  try {
    // Take first 4000 characters for analysis
    const contentPreview = content.substring(0, 4000);
    
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a proposal analysis expert. Analyze the proposal content and provide:

1. SECTOR CLASSIFICATION: Classify the document into ONE of these exact sectors:
- social-impact
- private-equity-due-diligence
- corporate
- higher-education
- other

2. TAGS: Generate up to 8 high-quality metadata tags that describe the proposal's key topics, keywords, and subjects. Focus on nouns and adjectives only. Tags should be specific and relevant to the proposal content.

Guidelines:
- Use lowercase, kebab-case format
- Focus on business functions, methodologies, industries, and project types
- Avoid generic terms like "business" or "project"
- Deduplicate similar tags

Return your response in this exact JSON format:
{
  "sector": "sector-name",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}`
        },
        {
          role: "user",
          content: `Analyze this proposal content and classify it:\n\n${contentPreview}`
        }
      ],
      temperature: 0.2,
      max_tokens: 300
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      return { sector: 'other', tags: [] };
    }

    try {
      const analysis = JSON.parse(responseText);
      
      // Validate sector
      const sector = VALID_SECTORS.includes(analysis.sector) ? analysis.sector : 'other';
      
      // Validate and clean tags
      const tags = Array.isArray(analysis.tags) 
        ? analysis.tags
            .map((tag: any) => String(tag).trim().toLowerCase().replace(/\s+/g, '-'))
            .filter((tag: string) => tag.length > 0 && tag.length <= 50)
            .slice(0, 8) // Limit to 8 tags
        : [];

      return { sector, tags };
    } catch (parseError) {
      console.error('Error parsing LLM response:', parseError);
      return { sector: 'other', tags: [] };
    }
  } catch (error) {
    console.error('Error in LLM analysis:', error);
    return { sector: 'other', tags: [] };
  }
} 