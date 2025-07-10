// Simple test for word-overlap similarity
function calculateWordOverlapSimilarity(name1, name2) {
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

// Test cases
const testCases = [
  ['MGT', 'MGT Consulting'],
  ['PowerParts', 'PowerParts Group'],
  ['Crux', 'Crux Capital'],
  ['Texas Mutual', 'Texas Mutual Insurance Company'],
  ['R&R', 'R&R Partners'],
  ['MGT', 'PowerParts Group'], // Should be low similarity
  ['Crux Capital', 'Trive Capital'] // Should be moderate similarity
];

console.log('🔍 Testing word-overlap similarity:');
testCases.forEach(([name1, name2]) => {
  const similarity = calculateWordOverlapSimilarity(name1, name2);
  const match = similarity >= 0.4 ? '✅' : '❌';
  console.log(`${match} "${name1}" vs "${name2}" = ${similarity.toFixed(3)}`);
}); 