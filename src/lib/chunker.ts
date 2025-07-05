// Enhanced semantic chunking with token-based overlap
export function chunkText(text: string, chunkSize: number = 500, tokenOverlap: number = 25): string[] {
  // Clean and normalize text
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim();

  // Split into sentences (enhanced implementation)
  const sentences = cleanedText
    .split(/[.!?]+/)
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
      chunks.push(currentChunk.trim());
      
      // Calculate token-based overlap (20-30 tokens)
      const overlapCharacters = Math.max(80, Math.min(120, tokenOverlap * 4)); // Approximate 4 chars per token
      const overlapText = extractOverlapText(currentChunk, overlapCharacters);
      
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
} {
  const sections = extractProposalSections(text);
  const chunks = chunkText(text, 500, 25); // Default: 500 words with 25-token overlap
  
  return { chunks, sections };
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