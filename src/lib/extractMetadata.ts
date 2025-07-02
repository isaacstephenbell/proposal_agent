import OpenAI from 'openai';

const openai = new OpenAI();

// Pre-defined allowed tags for controlled tagging
const ALLOWED_TAGS = [
  // Engagement types
  'due-diligence', 'market-study', 'strategy', 'implementation', 'assessment', 'audit',
  'feasibility-study', 'competitive-analysis', 'growth-strategy', 'operational-review',
  
  // Industries
  'healthcare', 'manufacturing', 'retail', 'technology', 'financial-services', 'education',
  'government', 'non-profit', 'real-estate', 'energy', 'transportation', 'consulting',
  
  // Approaches
  'voice-of-customer', 'data-analysis', 'process-optimization', 'digital-transformation',
  'change-management', 'risk-assessment', 'performance-improvement', 'cost-reduction',
  
  // Business functions
  'operations', 'marketing', 'finance', 'hr', 'it', 'sales', 'supply-chain', 'quality',
  
  // Project scope
  'strategy', 'execution', 'maintenance', 'support', 'training', 'integration'
];

export interface DocumentMetadata {
  sector: string;
  tags: string[];
  author?: string;
  date?: string;
}

export async function extractMetadataFromDocument(content: string): Promise<DocumentMetadata> {
  try {
    console.log('  🔍 Extracting metadata from full document...');
    
    // Extract author using RegEx patterns
    const author = extractAuthor(content);
    
    // Extract date using RegEx patterns
    const date = extractDate(content);
    
    // Use LLM for sector classification and tag generation
    const llmAnalysis = await analyzeWithLLM(content);
    
    // Filter and merge tags
    const filteredTags = filterAndMergeTags(llmAnalysis.tags);
    
    return {
      sector: llmAnalysis.sector,
      tags: filteredTags,
      author,
      date
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      sector: 'other',
      tags: [],
      author: 'NA',
      date: undefined
    };
  }
}

function extractAuthor(content: string): string {
  // Priority 1: Look for "Accepted and Agreed to" section with Cicero
  const acceptedAgreedPattern = /Accepted and Agreed to[:\s]*\n.*?Cicero[:\s]*\n.*?By:\s*([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const acceptedMatch = acceptedAgreedPattern.exec(content);
  if (acceptedMatch) {
    return acceptedMatch[1];
  }
  
  // Priority 2: Look for "Cicero" section with "By:" pattern
  const ciceroPattern = /Cicero[:\s]*\n.*?By:\s*([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const ciceroMatch = ciceroPattern.exec(content);
  if (ciceroMatch) {
    return ciceroMatch[1];
  }
  
  // Priority 3: Look for "Cicero" or "Consulting Team" sections
  const consultingPattern = /(?:Cicero|Consulting Team)[:\s]*\n.*?([A-Z][a-z]+ [A-Z][a-z]+)/gim;
  const consultingMatch = consultingPattern.exec(content);
  if (consultingMatch) {
    return consultingMatch[1];
  }
  
  // Priority 4: Look for common signature patterns
  const signaturePatterns = [
    /(?:Prepared by|Author|Contact)[:\s]*([A-Z][a-z]+ [A-Z][a-z]+)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+)[\s]*\n.*?(?:Partner|Principal|Director|Manager)/gi,
    /(?:Best regards|Sincerely)[,\s]*\n([A-Z][a-z]+ [A-Z][a-z]+)/gi
  ];
  
  for (const pattern of signaturePatterns) {
    const match = pattern.exec(content);
    if (match) {
      return match[1];
    }
  }
  
  return 'NA';
}

function extractDate(content: string): string | undefined {
  // Look for date patterns near headers or signature blocks
  const datePatterns = [
    /(?:Date|Dated|Submitted|Prepared)[:\s]*([A-Z][a-z]+ \d{1,2},? \d{4})/gi,
    /([A-Z][a-z]+ \d{1,2},? \d{4})/g,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    /(\d{4}-\d{2}-\d{2})/g
  ];
  
  for (const pattern of datePatterns) {
    const match = pattern.exec(content);
    if (match) {
      const dateStr = match[1];
      try {
        // Try to parse and normalize to ISO format
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]; // YYYY-MM-DD
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }
  
  return undefined;
}

async function analyzeWithLLM(content: string): Promise<{ sector: string; tags: string[] }> {
  try {
    // Take the first 4000 characters for analysis
    const contentPreview = content.substring(0, 4000);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using GPT-4o for better analysis
      messages: [
        {
          role: "system",
          content: `You are a proposal analysis expert. Analyze the proposal content and provide:

1. SECTOR CLASSIFICATION: Classify the document into a single sector from these options:
- private-equity
- foundations  
- corporate
- education
- healthcare
- manufacturing
- retail
- technology
- consulting
- government
- non-profit
- financial-services
- real-estate
- energy
- transportation
- other

2. TAGS: Generate 3-6 relevant tags that describe the engagement's topic, approach, and focus.

Focus on:
- Engagement type (e.g., due-diligence, market-study, strategy)
- Industry/sector focus
- Approach/methodology
- Business function
- Project scope

Return your response in this exact JSON format:
{
  "sector": "sector-name",
  "tags": ["tag1", "tag2", "tag3"]
}

Use lowercase, kebab-case format for both sector and tags.`
        },
        {
          role: "user",
          content: `Analyze this proposal content:\n\n${contentPreview}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      return { sector: 'other', tags: [] };
    }

    try {
      const analysis = JSON.parse(responseText);
      const sector = analysis.sector || 'other';
      const tags = Array.isArray(analysis.tags) 
        ? analysis.tags
            .map((tag: any) => tag.trim().toLowerCase().replace(/\s+/g, '-'))
            .filter((tag: string) => tag.length > 0)
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

function filterAndMergeTags(llmTags: string[]): string[] {
  // Filter LLM tags against allowed tags
  const filteredTags = llmTags.filter(tag => ALLOWED_TAGS.includes(tag));
  
  // If no tags match, use some default tags based on common patterns
  if (filteredTags.length === 0) {
    return ['consulting', 'strategy'];
  }
  
  return filteredTags;
} 