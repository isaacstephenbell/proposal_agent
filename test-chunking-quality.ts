#!/usr/bin/env tsx

// Chunking Quality Evaluation Framework
require('dotenv').config({ path: '.env.local' });

import { supabaseAdmin } from './src/lib/supabase';
import { chunkText, extractProposalSections, createMultiGranularityChunks } from './src/lib/chunker';
import { generateEmbedding } from './src/lib/openai';

interface ChunkingMetrics {
  totalChunks: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  sizeStdDev: number;
  overlapEffectiveness: number;
  sectionPreservation: number;
  retrievalAccuracy: number;
  coherenceScore: number;
}

interface TestQuery {
  query: string;
  expectedKeywords: string[];
  expectedClient?: string;
  expectedSection?: string;
}

class ChunkingEvaluator {
  private testQueries: TestQuery[] = [
    {
      query: "What was MGT's approach to workforce planning?",
      expectedKeywords: ["workforce", "planning", "approach", "methodology"],
      expectedClient: "MGT",
      expectedSection: "approach"
    },
    {
      query: "What timeline was proposed for the PowerParts market study?",
      expectedKeywords: ["timeline", "schedule", "phases", "PowerParts"],
      expectedClient: "PowerParts",
      expectedSection: "timeline"
    },
    {
      query: "What team members were assigned to the Crux Capital project?",
      expectedKeywords: ["team", "staff", "personnel", "Crux"],
      expectedClient: "Crux Capital",
      expectedSection: "team"
    },
    {
      query: "What deliverables were promised in social impact projects?",
      expectedKeywords: ["deliverables", "outcomes", "results", "social"],
      expectedSection: "deliverables"
    },
    {
      query: "How does the company understand client needs assessment?",
      expectedKeywords: ["understanding", "assessment", "needs", "client"],
      expectedSection: "understanding"
    }
  ];

  async evaluateChunkingStrategy(): Promise<ChunkingMetrics> {
    console.log('🔬 Starting Comprehensive Chunking Quality Evaluation...\n');

    // Test 1: Size Distribution Analysis
    console.log('📊 Test 1: Analyzing chunk size distribution...');
    const sizeMetrics = await this.analyzeSizeDistribution();
    
    // Test 2: Overlap Effectiveness
    console.log('🔗 Test 2: Evaluating overlap effectiveness...');
    const overlapScore = await this.testOverlapEffectiveness();
    
    // Test 3: Section Preservation
    console.log('📋 Test 3: Testing section preservation...');
    const sectionScore = await this.testSectionPreservation();
    
    // Test 4: Retrieval Accuracy
    console.log('🎯 Test 4: Measuring retrieval accuracy...');
    const retrievalScore = await this.testRetrievalAccuracy();
    
    // Test 5: Semantic Coherence
    console.log('🧠 Test 5: Evaluating semantic coherence...');
    const coherenceScore = await this.testSemanticCoherence();

    const metrics: ChunkingMetrics = {
      totalChunks: sizeMetrics.totalChunks || 0,
      avgChunkSize: sizeMetrics.avgChunkSize || 0,
      minChunkSize: sizeMetrics.minChunkSize || 0,
      maxChunkSize: sizeMetrics.maxChunkSize || 0,
      sizeStdDev: sizeMetrics.sizeStdDev || 0,
      overlapEffectiveness: overlapScore,
      sectionPreservation: sectionScore,
      retrievalAccuracy: retrievalScore,
      coherenceScore: coherenceScore
    };

    this.printDetailedReport(metrics);
    return metrics;
  }

  private async analyzeSizeDistribution(): Promise<Partial<ChunkingMetrics>> {
    const { data: chunks } = await supabaseAdmin
      .from('proposals')
      .select('content')
      .limit(100);

    if (!chunks) return { totalChunks: 0, avgChunkSize: 0, minChunkSize: 0, maxChunkSize: 0, sizeStdDev: 0 };

    const sizes = chunks.map(c => c.content.length);
    const totalChunks = sizes.length;
    const avgChunkSize = sizes.reduce((a, b) => a + b, 0) / totalChunks;
    const minChunkSize = Math.min(...sizes);
    const maxChunkSize = Math.max(...sizes);
    
    // Calculate standard deviation
    const variance = sizes.reduce((acc, size) => acc + Math.pow(size - avgChunkSize, 2), 0) / totalChunks;
    const sizeStdDev = Math.sqrt(variance);

    console.log(`  📏 Analyzed ${totalChunks} chunks`);
    console.log(`  📊 Size range: ${minChunkSize} - ${maxChunkSize} characters`);
    console.log(`  📈 Average: ${Math.round(avgChunkSize)} ± ${Math.round(sizeStdDev)} characters`);
    
    // Evaluate size distribution quality
    const idealAvg = 2000; // ~500 tokens * 4 chars/token
    const idealStdDev = 800; // Good consistency
    const sizeQuality = this.calculateSizeQuality(avgChunkSize, sizeStdDev, idealAvg, idealStdDev);
    console.log(`  ⭐ Size quality: ${(sizeQuality * 100).toFixed(1)}%\n`);

    return { totalChunks, avgChunkSize, minChunkSize, maxChunkSize, sizeStdDev };
  }

  private async testOverlapEffectiveness(): Promise<number> {
    // Test chunking with and without overlap on sample documents
    const testTexts = await this.getSampleDocuments(3);
    let overlapBenefit = 0;
    let tests = 0;

    for (const text of testTexts) {
      // Chunk with current strategy (25-token overlap)
      const chunksWithOverlap = chunkText(text, 500, 25);
      
      // Chunk without overlap
      const chunksNoOverlap = chunkText(text, 500, 0);
      
      // Test retrieval quality for each approach
      for (const query of this.testQueries.slice(0, 3)) {
        const scoreWithOverlap = this.calculateRetrievalScore(query, chunksWithOverlap);
        const scoreNoOverlap = this.calculateRetrievalScore(query, chunksNoOverlap);
        
        if (scoreWithOverlap > scoreNoOverlap) {
          overlapBenefit += (scoreWithOverlap - scoreNoOverlap);
        }
        tests++;
      }
    }

    const overlapEffectiveness = tests > 0 ? overlapBenefit / tests : 0;
    console.log(`  🔗 Overlap provides ${(overlapEffectiveness * 100).toFixed(1)}% improvement`);
    console.log(`  📊 Tested on ${tests} query-document pairs\n`);
    
    return Math.max(0, Math.min(1, overlapEffectiveness));
  }

  private async testSectionPreservation(): Promise<number> {
    const testTexts = await this.getSampleDocuments(5);
    let preservationScores: number[] = [];

    for (const text of testTexts) {
      // Extract sections before chunking
      const sections = extractProposalSections(text);
      const chunks = chunkText(text, 500, 25);
      
      // Check how well sections are preserved in chunks
      const sectionCount = Object.keys(sections).length;
      let preservedSections = 0;
      
      if (sectionCount > 0) {
        for (const [sectionType, sectionContent] of Object.entries(sections)) {
          // Check if section content is well-represented in chunks
          const bestChunk = this.findBestChunkForContent(sectionContent, chunks);
          const preservation = this.calculateContentPreservation(sectionContent, bestChunk);
          
          if (preservation > 0.7) { // 70% threshold for "preserved"
            preservedSections++;
          }
        }
        
        const preservationRatio = preservedSections / sectionCount;
        preservationScores.push(preservationRatio);
      }
    }

    const avgPreservation = preservationScores.length > 0 
      ? preservationScores.reduce((a, b) => a + b, 0) / preservationScores.length 
      : 0;

    console.log(`  📋 Section preservation: ${(avgPreservation * 100).toFixed(1)}%`);
    console.log(`  📊 Tested ${preservationScores.length} documents\n`);
    
    return avgPreservation;
  }

  private async testRetrievalAccuracy(): Promise<number> {
    let accuracyScores: number[] = [];

    for (const testQuery of this.testQueries) {
      console.log(`  🎯 Testing: "${testQuery.query}"`);
      
      try {
        // Generate embedding for test query
        const queryEmbedding = await generateEmbedding(testQuery.query);
        
        // Search for relevant chunks
        const { data: results } = await supabaseAdmin
          .rpc('match_proposals', {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5,
            filter_author: null,
            filter_sector: null,
            filter_client: null,
            filter_tags: null
          });

        if (results && results.length > 0) {
          // Calculate relevance score for top results
          const relevanceScore = this.calculateQueryRelevance(testQuery, results);
          accuracyScores.push(relevanceScore);
          console.log(`    ✅ Relevance: ${(relevanceScore * 100).toFixed(1)}%`);
        } else {
          console.log(`    ❌ No results found`);
          accuracyScores.push(0);
        }
      } catch (error) {
        console.log(`    ❌ Error: ${error}`);
        accuracyScores.push(0);
      }
    }

    const avgAccuracy = accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length;
    console.log(`  📊 Overall retrieval accuracy: ${(avgAccuracy * 100).toFixed(1)}%\n`);
    
    return avgAccuracy;
  }

  private async testSemanticCoherence(): Promise<number> {
    // Sample random chunks and evaluate semantic coherence
    const { data: randomChunks } = await supabaseAdmin
      .from('proposals')
      .select('content')
      .limit(20);

    if (!randomChunks) return 0;

    let coherenceScores: number[] = [];

    for (const chunk of randomChunks) {
      const coherence = this.evaluateChunkCoherence(chunk.content);
      coherenceScores.push(coherence);
    }

    const avgCoherence = coherenceScores.reduce((a, b) => a + b, 0) / coherenceScores.length;
    console.log(`  🧠 Semantic coherence: ${(avgCoherence * 100).toFixed(1)}%`);
    console.log(`  📊 Tested ${coherenceScores.length} random chunks\n`);
    
    return avgCoherence;
  }

  // Helper methods
  private async getSampleDocuments(count: number): Promise<string[]> {
    const { data: chunks } = await supabaseAdmin
      .from('proposals')
      .select('content')
      .limit(count * 5); // Get more chunks to reconstruct documents

    if (!chunks) return [];

    // Group chunks by filename and reconstruct documents
    const documents: string[] = [];
    let currentDoc = '';
    let chunkCount = 0;

    for (const chunk of chunks) {
      currentDoc += chunk.content + '\n\n';
      chunkCount++;
      
      if (chunkCount >= 5) { // Approximate document length
        documents.push(currentDoc);
        currentDoc = '';
        chunkCount = 0;
        
        if (documents.length >= count) break;
      }
    }

    return documents;
  }

  private calculateSizeQuality(actual: number, stdDev: number, ideal: number, idealStdDev: number): number {
    const sizeScore = Math.max(0, 1 - Math.abs(actual - ideal) / ideal);
    const consistencyScore = Math.max(0, 1 - Math.abs(stdDev - idealStdDev) / idealStdDev);
    return (sizeScore + consistencyScore) / 2;
  }

  private calculateRetrievalScore(query: TestQuery, chunks: string[]): number {
    let score = 0;
    let maxScore = query.expectedKeywords.length;

    for (const chunk of chunks) {
      const chunkLower = chunk.toLowerCase();
      for (const keyword of query.expectedKeywords) {
        if (chunkLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
    }

    return maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  }

  private findBestChunkForContent(content: string, chunks: string[]): string {
    let bestChunk = '';
    let bestScore = 0;

    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    for (const chunk of chunks) {
      const chunkWords = new Set(chunk.toLowerCase().split(/\s+/));
      const intersection = new Set(Array.from(contentWords).filter(x => chunkWords.has(x)));
      const score = intersection.size / contentWords.size;

      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    }

    return bestChunk;
  }

  private calculateContentPreservation(original: string, chunk: string): number {
    const originalWords = new Set(original.toLowerCase().split(/\s+/));
    const chunkWords = new Set(chunk.toLowerCase().split(/\s+/));
    const intersection = new Set(Array.from(originalWords).filter(x => chunkWords.has(x)));
    
    return originalWords.size > 0 ? intersection.size / originalWords.size : 0;
  }

  private calculateQueryRelevance(query: TestQuery, results: any[]): number {
    let relevanceScore = 0;
    const maxPossibleScore = query.expectedKeywords.length;

    for (const result of results.slice(0, 3)) { // Top 3 results
      const content = result.content.toLowerCase();
      
      for (const keyword of query.expectedKeywords) {
        if (content.includes(keyword.toLowerCase())) {
          relevanceScore += 1;
        }
      }

      // Bonus for correct client
      if (query.expectedClient && result.client?.includes(query.expectedClient)) {
        relevanceScore += 0.5;
      }
    }

    return Math.min(1, relevanceScore / maxPossibleScore);
  }

  private evaluateChunkCoherence(content: string): number {
    // Simple coherence evaluation based on:
    // 1. Sentence completeness
    // 2. Topic consistency
    // 3. Reasonable length

    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check for complete sentences
    const completeSentences = sentences.filter(s => s.trim().length > 10).length;
    const completenessScore = sentences.length > 0 ? completeSentences / sentences.length : 0;
    
    // Check for reasonable length (not too short, not too long)
    const idealLength = 2000; // ~500 tokens
    const lengthScore = Math.max(0, 1 - Math.abs(content.length - idealLength) / idealLength);
    
    // Simple topic consistency (repeated keywords)
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      if (word.length > 4) { // Only count meaningful words
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }
    
    const repeatedWords = Array.from(wordFreq.values()).filter(count => count > 1).length;
    const consistencyScore = words.length > 0 ? Math.min(1, repeatedWords / (words.length * 0.1)) : 0;
    
    return (completenessScore + lengthScore + consistencyScore) / 3;
  }

  private printDetailedReport(metrics: ChunkingMetrics): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CHUNKING QUALITY EVALUATION REPORT');
    console.log('='.repeat(60));
    
    console.log('\n📏 SIZE DISTRIBUTION:');
    console.log(`  Total chunks analyzed: ${metrics.totalChunks}`);
    console.log(`  Average chunk size: ${Math.round(metrics.avgChunkSize)} characters`);
    console.log(`  Size range: ${metrics.minChunkSize} - ${metrics.maxChunkSize}`);
    console.log(`  Standard deviation: ${Math.round(metrics.sizeStdDev)}`);
    
    console.log('\n🔗 OVERLAP EFFECTIVENESS:');
    console.log(`  Improvement from overlap: ${(metrics.overlapEffectiveness * 100).toFixed(1)}%`);
    
    console.log('\n📋 SECTION PRESERVATION:');
    console.log(`  Section integrity: ${(metrics.sectionPreservation * 100).toFixed(1)}%`);
    
    console.log('\n🎯 RETRIEVAL ACCURACY:');
    console.log(`  Query relevance: ${(metrics.retrievalAccuracy * 100).toFixed(1)}%`);
    
    console.log('\n🧠 SEMANTIC COHERENCE:');
    console.log(`  Chunk coherence: ${(metrics.coherenceScore * 100).toFixed(1)}%`);
    
    console.log('\n⭐ OVERALL ASSESSMENT:');
    const overallScore = (
      metrics.overlapEffectiveness + 
      metrics.sectionPreservation + 
      metrics.retrievalAccuracy + 
      metrics.coherenceScore
    ) / 4;
    
    console.log(`  Overall chunking quality: ${(overallScore * 100).toFixed(1)}%`);
    
    if (overallScore >= 0.8) {
      console.log('  🟢 EXCELLENT - Chunking strategy is highly effective');
    } else if (overallScore >= 0.6) {
      console.log('  🟡 GOOD - Some optimization opportunities exist');
    } else {
      console.log('  🔴 NEEDS IMPROVEMENT - Consider chunking strategy adjustments');
    }
    
    console.log('\n📈 RECOMMENDATIONS:');
    if (metrics.overlapEffectiveness < 0.3) {
      console.log('  • Consider adjusting overlap size or strategy');
    }
    if (metrics.sectionPreservation < 0.7) {
      console.log('  • Improve section boundary detection');
    }
    if (metrics.retrievalAccuracy < 0.7) {
      console.log('  • Consider smaller chunk sizes or different chunking approach');
    }
    if (metrics.coherenceScore < 0.7) {
      console.log('  • Review sentence boundary detection and chunk completeness');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// CLI interface
async function main() {
  const evaluator = new ChunkingEvaluator();
  await evaluator.evaluateChunkingStrategy();
}

if (require.main === module) {
  main().catch(console.error);
} 