// Enhanced semantic chunking with token-based overlap and boundary detection
export function chunkText(text: string, chunkSize: number = 500, tokenOverlap: number = 25): string[] {
  // Clean and normalize text
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim();

  // Split into sentences with better boundary detection
  const sentences = cleanedText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokenCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokenCount = estimateTokenCount(sentence);

    // If adding this sentence would exceed chunk size
    if (currentTokenCount + sentenceTokenCount > chunkSize && currentChunk.length > 0) {
      // Find semantic boundary for better chunk ending
      const semanticChunk = findSemanticBoundary(currentChunk, chunkSize);
      chunks.push(semanticChunk.trim());
      
      // Calculate token-based overlap with semantic awareness
      const overlapCharacters = Math.max(80, Math.min(120, tokenOverlap * 4));
      const overlapText = extractSemanticOverlap(semanticChunk, overlapCharacters);
      
      currentChunk = overlapText + (overlapText ? ' ' : '') + sentence;
      currentTokenCount = estimateTokenCount(currentChunk);
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokenCount += sentenceTokenCount;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Filter out very short chunks and ensure minimum quality
  return chunks.filter(chunk => chunk.length > 100 && estimateTokenCount(chunk) > 20);
}

// Find semantic boundary for better chunk endings
function findSemanticBoundary(chunk: string, maxSize: number): string {
  const tokens = estimateTokenCount(chunk);
  if (tokens <= maxSize) return chunk;
  
  // Look for natural break points in order of preference
  const breakPoints = [
    /\n\n/g,           // Paragraph breaks
    /\.\s+(?=[A-Z])/g, // Sentence endings before capital letters
    /;\s+/g,           // Semicolons
    /,\s+(?=and|but|or|however|therefore|moreover)/g, // Conjunctions
    /\s+(?=\b(?:First|Second|Third|Additionally|Furthermore|Moreover|However|Therefore|In conclusion)\b)/gi
  ];
  
  for (const breakPattern of breakPoints) {
    const matches: RegExpExecArray[] = [];
    let match;
    while ((match = breakPattern.exec(chunk)) !== null) {
      matches.push(match);
      if (!breakPattern.global) break;
    }
    
    if (matches.length > 0) {
      // Find the best break point close to the target size
      const targetChar = (maxSize / tokens) * chunk.length;
      const bestMatch = matches.reduce((best, match) => {
        const distance = Math.abs(match.index! - targetChar);
        return distance < Math.abs(best.index! - targetChar) ? match : best;
      });
      
      if (bestMatch.index! > chunk.length * 0.3) { // Don't break too early
        return chunk.substring(0, bestMatch.index! + bestMatch[0].length);
      }
    }
  }
  
  return chunk; // Return original if no good break point found
}

// Extract semantic overlap that preserves context
function extractSemanticOverlap(chunk: string, overlapCharacters: number): string {
  if (chunk.length <= overlapCharacters) {
    return chunk;
  }
  
  const overlapStart = chunk.length - overlapCharacters;
  const overlapSection = chunk.substring(overlapStart);
  
  // Look for semantic boundaries within the overlap section
  const semanticBoundaries = [
    /\n\n/g,           // Paragraph breaks
    /\.\s+(?=[A-Z])/g, // Sentence boundaries
    /;\s+/g,           // Semicolons
    /:\s+/g,           // Colons
    /,\s+(?=and|but|or|however|therefore|moreover)/g // Conjunctions
  ];
  
  for (const boundary of semanticBoundaries) {
    const matches: RegExpExecArray[] = [];
    let match;
    while ((match = boundary.exec(overlapSection)) !== null) {
      matches.push(match);
      if (!boundary.global) break;
    }
    
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const boundaryEnd = lastMatch.index! + lastMatch[0].length;
      return overlapSection.substring(boundaryEnd);
    }
  }
  
  // If no semantic boundary found, use character-based overlap
  return overlapSection;
}

// Estimate token count (approximation: 1 token ≈ 4 characters for English)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Extract overlap text based on character count from end of chunk
function extractOverlapText(chunk: string, overlapCharacters: number): string {
  if (chunk.length <= overlapCharacters) {
    return chunk;
  }
  
  // Try to find a natural break point (sentence or clause boundary)
  const overlapStart = chunk.length - overlapCharacters;
  const overlapSection = chunk.substring(overlapStart);
  
  // Look for sentence boundaries within the overlap section
  const sentenceBoundaries = ['. ', '! ', '? ', '; ', ', '];
  for (const boundary of sentenceBoundaries) {
    const boundaryIndex = overlapSection.indexOf(boundary);
    if (boundaryIndex > 0) {
      return chunk.substring(overlapStart + boundaryIndex + boundary.length);
    }
  }
  
  // If no natural boundary found, use character-based overlap
  return chunk.substring(overlapStart);
}

// Enhanced section extraction with better pattern matching
export function extractProposalSections(text: string): {
  understanding?: string;
  approach?: string;
  timeline?: string;
  problem?: string;
  executive_summary?: string;
  methodology?: string;
  deliverables?: string;
  team?: string;
} {
  const sections: any = {};
  
  // Enhanced section patterns with more comprehensive matching
  const sectionPatterns = [
    { 
      key: 'executive_summary', 
      patterns: [
        /(?:executive\s+summary|summary|overview)/i,
        /(?:project\s+overview|engagement\s+overview)/i
      ] 
    },
    { 
      key: 'understanding', 
      patterns: [
        /(?:our\s+understanding|understanding|background)/i,
        /(?:problem\s+understanding|situation\s+analysis)/i
      ] 
    },
    { 
      key: 'approach', 
      patterns: [
        /(?:proposed\s+approach|approach|methodology|solution)/i,
        /(?:our\s+approach|recommended\s+approach)/i
      ] 
    },
    { 
      key: 'methodology', 
      patterns: [
        /(?:methodology|methods|process|framework)/i,
        /(?:analytical\s+approach|research\s+methodology)/i
      ] 
    },
    { 
      key: 'timeline', 
      patterns: [
        /(?:timeline|workplan|schedule|phases)/i,
        /(?:project\s+timeline|delivery\s+schedule)/i
      ] 
    },
    { 
      key: 'deliverables', 
      patterns: [
        /(?:deliverables|outcomes|results)/i,
        /(?:expected\s+deliverables|project\s+deliverables)/i
      ] 
    },
    { 
      key: 'team', 
      patterns: [
        /(?:team|staff|personnel|resources)/i,
        /(?:project\s+team|consulting\s+team)/i
      ] 
    },
    { 
      key: 'problem', 
      patterns: [
        /(?:problem|challenge|issue|objective)/i,
        /(?:business\s+challenge|key\s+issues)/i
      ] 
    }
  ];

  const lines = text.split('\n');
  let currentSection = '';
  let currentContent = '';
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      if (inSection) {
        currentContent += '\n';
      }
      continue;
    }
    
    // Check if this line is a section header
    let foundSection = false;
    for (const section of sectionPatterns) {
      if (section.patterns.some(pattern => pattern.test(trimmedLine))) {
        // Save previous section if it exists
        if (currentSection && currentContent.trim()) {
          sections[currentSection] = currentContent.trim();
        }
        
        currentSection = section.key;
        currentContent = '';
        inSection = true;
        foundSection = true;
        break;
      }
    }
    
    // If not a section header and we're in a section, add to content
    if (!foundSection && inSection) {
      currentContent += (currentContent ? '\n' : '') + line;
    }
  }

  // Save the last section
  if (currentSection && currentContent.trim()) {
    sections[currentSection] = currentContent.trim();
  }

  return sections;
}

// Multi-granularity chunking for different use cases
export function createMultiGranularityChunks(text: string): {
  fine_chunks: string[];
  medium_chunks: string[];
  coarse_chunks: string[];
} {
  return {
    fine_chunks: chunkText(text, 300, 20),    // Small chunks with 20-token overlap
    medium_chunks: chunkText(text, 600, 25),  // Medium chunks with 25-token overlap  
    coarse_chunks: chunkText(text, 1000, 30)  // Large chunks with 30-token overlap
  };
}

// Enhanced hierarchical chunk structure
export interface HierarchicalChunk {
  id: string;
  content: string;
  tokens: number;
  level: 'document' | 'section' | 'subsection' | 'paragraph';
  parent?: string;
  children: string[];
  sectionType?: string;
  metadata: {
    startIndex: number;
    endIndex: number;
    semanticBoundary: boolean;
    qualityScore: number;
  };
}

// Section-aware chunking with hierarchical relationships
export function semanticChunkWithSections(text: string): {
  chunks: HierarchicalChunk[];
  sections: Record<string, string>;
} {
  const sections = extractProposalSections(text);
  const chunks: HierarchicalChunk[] = [];
  let chunkId = 0;
  
  // Create document-level chunk
  const documentChunk: HierarchicalChunk = {
    id: `doc-${chunkId++}`,
    content: text,
    tokens: estimateTokenCount(text),
    level: 'document',
    children: [],
    metadata: {
      startIndex: 0,
      endIndex: text.length,
      semanticBoundary: true,
      qualityScore: calculateChunkQuality(text)
    }
  };
  chunks.push(documentChunk);
  
  // Process each section
  Object.entries(sections).forEach(([sectionType, sectionContent]) => {
    const sectionChunk: HierarchicalChunk = {
      id: `sec-${chunkId++}`,
      content: sectionContent,
      tokens: estimateTokenCount(sectionContent),
      level: 'section',
      parent: documentChunk.id,
      children: [],
      sectionType,
      metadata: {
        startIndex: text.indexOf(sectionContent),
        endIndex: text.indexOf(sectionContent) + sectionContent.length,
        semanticBoundary: true,
        qualityScore: calculateChunkQuality(sectionContent)
      }
    };
    chunks.push(sectionChunk);
    documentChunk.children.push(sectionChunk.id);
    
    // Create subsection chunks for large sections
    if (sectionChunk.tokens > 600) {
      const subChunks = chunkText(sectionContent, 500, 25);
      subChunks.forEach((subContent, index) => {
        const subChunk: HierarchicalChunk = {
          id: `sub-${chunkId++}`,
          content: subContent,
          tokens: estimateTokenCount(subContent),
          level: 'subsection',
          parent: sectionChunk.id,
          children: [],
          sectionType,
          metadata: {
            startIndex: sectionContent.indexOf(subContent),
            endIndex: sectionContent.indexOf(subContent) + subContent.length,
            semanticBoundary: true,
            qualityScore: calculateChunkQuality(subContent)
          }
        };
        chunks.push(subChunk);
        sectionChunk.children.push(subChunk.id);
      });
    }
  });
  
  return { chunks, sections };
}

// Calculate chunk quality score based on multiple factors
function calculateChunkQuality(content: string): number {
  let score = 0;
  const length = content.length;
  const tokens = estimateTokenCount(content);
  
  // Content density (information per token)
  const wordCount = content.split(/\s+/).length;
  const avgWordLength = content.replace(/\s+/g, '').length / wordCount;
  score += Math.min(avgWordLength / 6, 1) * 0.3; // Longer words = more information
  
  // Semantic completeness (complete sentences and thoughts)
  const sentenceCount = content.split(/[.!?]+/).length - 1;
  const avgSentenceLength = wordCount / Math.max(sentenceCount, 1);
  score += Math.min(avgSentenceLength / 15, 1) * 0.3; // Reasonable sentence length
  
  // Structure indicators (lists, headers, formatting)
  const structurePatterns = [
    /^\s*\d+\./gm,           // Numbered lists
    /^\s*[•\-\*]/gm,         // Bullet points
    /^[A-Z][^.!?]*:$/gm,     // Headers ending with colon
    /\b(first|second|third|additionally|furthermore|however|therefore)\b/gi
  ];
  const structureScore = structurePatterns.reduce((acc, pattern) => {
    const matches = content.match(pattern);
    return acc + (matches ? matches.length * 0.1 : 0);
  }, 0);
  score += Math.min(structureScore, 1) * 0.2;
  
  // Length appropriateness (not too short, not too long)
  const optimalTokens = 400;
  const lengthScore = 1 - Math.abs(tokens - optimalTokens) / optimalTokens;
  score += Math.max(lengthScore, 0) * 0.2;
  
  return Math.min(score, 1);
}

// Main text processing function with all enhancements
export function processProposalText(text: string): {
  chunks: string[];
  sections: {
    understanding?: string;
    approach?: string;
    timeline?: string;
    problem?: string;
    executive_summary?: string;
    methodology?: string;
    deliverables?: string;
    team?: string;
  };
  multiGranularity?: {
    fine_chunks: string[];
    medium_chunks: string[];
    coarse_chunks: string[];
  };
  hierarchical?: {
    chunks: HierarchicalChunk[];
    sections: Record<string, string>;
  };
} {
  const sections = extractProposalSections(text);
  const chunks = chunkText(text, 500, 25); // Default: 500 words with 25-token overlap
  const hierarchical = semanticChunkWithSections(text);
  
  return { chunks, sections, hierarchical };
}

// Semantic chunking that preserves context boundaries
export function semanticChunkText(text: string, maxChunkSize: number = 500): string[] {
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokenCount = 0;
  
  for (const paragraph of paragraphs) {
    const paragraphTokenCount = estimateTokenCount(paragraph);
    
    // If paragraph alone is too big, split it by sentences
    if (paragraphTokenCount > maxChunkSize) {
      // Save current chunk if it exists
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokenCount = 0;
      }
      
      // Split large paragraph into sentences
      const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let tempChunk = '';
      let tempTokenCount = 0;
      
      for (const sentence of sentences) {
        const sentenceTokenCount = estimateTokenCount(sentence);
        
        if (tempTokenCount + sentenceTokenCount > maxChunkSize && tempChunk) {
          chunks.push(tempChunk.trim());
          tempChunk = sentence;
          tempTokenCount = sentenceTokenCount;
        } else {
          tempChunk += (tempChunk ? '. ' : '') + sentence;
          tempTokenCount += sentenceTokenCount;
        }
      }
      
      if (tempChunk.trim()) {
        chunks.push(tempChunk.trim());
      }
    } else {
      // Normal paragraph processing
      if (currentTokenCount + paragraphTokenCount > maxChunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
        currentTokenCount = paragraphTokenCount;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        currentTokenCount += paragraphTokenCount;
      }
    }
  }
  
  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 50);
} 