// Sentence-level chunking with overlap
export function chunkText(text: string, chunkSize: number = 500, overlap: number = 0.2): string[] {
  // Clean and normalize text
  const cleanedText = text
    .replace(/\s+/g, ' ')
    .trim();

  // Split into sentences (basic implementation)
  const sentences = cleanedText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const chunks: string[] = [];
  let currentChunk = '';
  let wordCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceWordCount = sentence.split(' ').length;

    // If adding this sentence would exceed chunk size
    if (wordCount + sentenceWordCount > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Calculate overlap
      const overlapWords = Math.floor(chunkSize * overlap);
      const words = currentChunk.split(' ');
      const overlapText = words.slice(-overlapWords).join(' ');
      
      currentChunk = overlapText + ' ' + sentence;
      wordCount = overlapWords + sentenceWordCount;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      wordCount += sentenceWordCount;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
}

// Extract sections from proposal text
export function extractProposalSections(text: string): {
  understanding?: string;
  approach?: string;
  timeline?: string;
  problem?: string;
} {
  const sections: any = {};
  
  // Simple section extraction based on common headers
  const sectionPatterns = [
    { key: 'understanding', patterns: [/our understanding/i, /understanding/i, /background/i] },
    { key: 'approach', patterns: [/proposed approach/i, /approach/i, /methodology/i, /solution/i] },
    { key: 'timeline', patterns: [/timeline/i, /workplan/i, /schedule/i, /phases/i] },
    { key: 'problem', patterns: [/problem/i, /challenge/i, /issue/i, /objective/i] }
  ];

  const lines = text.split('\n');
  let currentSection = '';
  let currentContent = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line is a section header
    let foundSection = false;
    for (const section of sectionPatterns) {
      if (section.patterns.some(pattern => pattern.test(trimmedLine))) {
        // Save previous section
        if (currentSection && currentContent.trim()) {
          sections[currentSection] = currentContent.trim();
        }
        
        currentSection = section.key;
        currentContent = '';
        foundSection = true;
        break;
      }
    }
    
    if (!foundSection && currentSection) {
      currentContent += (currentContent ? '\n' : '') + line;
    }
  }

  // Save the last section
  if (currentSection && currentContent.trim()) {
    sections[currentSection] = currentContent.trim();
  }

  return sections;
}

// Combine text processing functions
export function processProposalText(text: string): {
  chunks: string[];
  sections: {
    understanding?: string;
    approach?: string;
    timeline?: string;
    problem?: string;
  };
} {
  const sections = extractProposalSections(text);
  const chunks = chunkText(text);
  
  return { chunks, sections };
} 