import { createHash } from 'crypto';
import { supabaseAdmin } from './supabase';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateFile?: string;
  similarity?: number;
  reason?: string;
  shouldProceed?: boolean;
}

export function calculateFileHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

export function calculateContentSimilarity(content1: string, content2: string): number {
  // Normalize content by removing whitespace and converting to lowercase
  const normalized1 = content1.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalized2 = content2.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // If texts are identical after normalization, return 100% similarity
  if (normalized1 === normalized2) {
    return 1.0;
  }
  
  // Calculate word-based similarity
  const words1 = new Set(normalized1.split(/\s+/));
  const words2 = new Set(normalized2.split(/\s+/));
  
  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set([...Array.from(words1), ...Array.from(words2)]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

export async function checkForDuplicates(
  filename: string,
  content: string,
  fileHash: string
): Promise<DuplicateCheckResult> {
  try {
    // First check for exact file hash matches
    const { data: exactMatches } = await supabaseAdmin
      .from('proposals')
      .select('filename, file_hash')
      .eq('file_hash', fileHash)
      .neq('filename', filename);
    
    if (exactMatches && exactMatches.length > 0) {
      return {
        isDuplicate: true,
        duplicateFile: exactMatches[0].filename,
        similarity: 1.0,
        reason: 'Identical file content (same hash)',
        shouldProceed: false
      };
    }
    
    // Then check for content similarity
    const { data: allProposals } = await supabaseAdmin
      .from('proposals')
      .select('filename, content, file_hash')
      .neq('filename', filename)
      .limit(100); // Limit to avoid performance issues
    
    if (allProposals) {
      for (const proposal of allProposals) {
        const similarity = calculateContentSimilarity(content, proposal.content);
        
        if (similarity > 0.95) {
          return {
            isDuplicate: true,
            duplicateFile: proposal.filename,
            similarity,
            reason: 'Nearly identical content',
            shouldProceed: false
          };
        } else if (similarity > 0.85) {
          return {
            isDuplicate: true,
            duplicateFile: proposal.filename,
            similarity,
            reason: 'Very similar content - may be a revision',
            shouldProceed: true // Let user decide
          };
        }
      }
    }
    
    return {
      isDuplicate: false
    };
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    return {
      isDuplicate: false
    };
  }
}

export function formatDuplicateWarning(result: DuplicateCheckResult): string {
  if (!result.isDuplicate) return '';
  
  const similarityPercent = Math.round((result.similarity || 0) * 100);
  
  return `⚠️ Potential duplicate detected: ${result.duplicateFile} (${similarityPercent}% similar) - ${result.reason}`;
} 