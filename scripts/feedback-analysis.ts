#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

class FeedbackAnalyzer {
  // Get overall feedback statistics
  async getFeedbackStats() {
    console.log(' Analyzing Feedback Statistics...\\n');
    
    const { data: allFeedback, error } = await supabaseAdmin
      .from('discovery_feedback')
      .select('*');
    
    if (error) {
      console.error('Error fetching feedback:', error);
      return;
    }

    const totalFeedback = allFeedback.length;
    const goodFeedback = allFeedback.filter(f => f.rating === 'good').length;
    const badFeedback = allFeedback.filter(f => f.rating === 'bad').length;
    
    console.log(\ OVERALL STATISTICS:\);
    console.log(\   Total feedback entries: \\);
    console.log(\   Good ratings: \ (\%)\);
    console.log(\   Bad ratings: \ (\%)\);
    
    return { totalFeedback, goodFeedback, badFeedback, allFeedback };
  }

  // Analyze feedback by query type
  async analyzeByQueryType() {
    console.log('\\n ANALYZING BY QUERY TYPE...\\n');
    
    const { data, error } = await supabaseAdmin
      .from('discovery_feedback')
      .select('query_type, rating, feedback_reason');
    
    if (error) {
      console.error('Error fetching query type data:', error);
      return;
    }

    const queryTypeStats: Record<string, { good: number; bad: number; reasons: string[] }> = {};
    
    data.forEach(feedback => {
      const queryType = feedback.query_type || 'unknown';
      if (!queryTypeStats[queryType]) {
        queryTypeStats[queryType] = { good: 0, bad: 0, reasons: [] };
      }
      
      queryTypeStats[queryType][feedback.rating]++;
      if (feedback.feedback_reason) {
        queryTypeStats[queryType].reasons.push(feedback.feedback_reason);
      }
    });

    console.log(' QUERY TYPE PERFORMANCE:');
    Object.entries(queryTypeStats).forEach(([queryType, stats]) => {
      const total = stats.good + stats.bad;
      const successRate = total > 0 ? ((stats.good / total) * 100).toFixed(1) : 0;
      
      console.log(\\\n   \:\);
      console.log(\     Total queries: \\);
      console.log(\     Success rate: \%\);
      console.log(\     Good: \, Bad: \\);
      
      if (stats.reasons.length > 0) {
        console.log(\     Recent feedback reasons:\);
        stats.reasons.slice(-3).forEach(reason => {
          console.log(\       - \...\);
        });
      }
    });

    return queryTypeStats;
  }

  // Find problematic chunks
  async findProblematicChunks() {
    console.log('\\n FINDING PROBLEMATIC CHUNKS...\\n');
    
    const { data: badFeedback, error } = await supabaseAdmin
      .from('discovery_feedback')
      .select('chunk_ids, question, answer, feedback_reason')
      .eq('rating', 'bad');
    
    if (error) {
      console.error('Error fetching bad feedback:', error);
      return;
    }

    const chunkProblemCount: Record<string, { count: number; questions: string[]; reasons: string[] }> = {};
    
    badFeedback.forEach(feedback => {
      const chunkIds = JSON.parse(feedback.chunk_ids);
      chunkIds.forEach((chunkId: string) => {
        if (!chunkProblemCount[chunkId]) {
          chunkProblemCount[chunkId] = {
            count: 0,
            questions: [],
            reasons: []
          };
        }
        chunkProblemCount[chunkId].count++;
        chunkProblemCount[chunkId].questions.push(feedback.question.substring(0, 50));
        if (feedback.feedback_reason) {
          chunkProblemCount[chunkId].reasons.push(feedback.feedback_reason);
        }
      });
    });

    const sortedChunks = Object.entries(chunkProblemCount)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 10);

    console.log(' TOP PROBLEMATIC CHUNKS:');
    sortedChunks.forEach(([chunkId, data]) => {
      console.log(\\\n   Chunk ID: \\);
      console.log(\   Bad ratings: \\);
      console.log(\   Sample questions that failed:\);
      data.questions.slice(0, 3).forEach(q => {
        console.log(\     - \
\...\\);
      });
      if (data.reasons.length > 0) {
        console.log(\   Recent feedback reasons:\);
        data.reasons.slice(0, 2).forEach(reason => {
          console.log(\     - \...\);
        });
      }
    });

    return chunkProblemCount;
  }

  // Generate improvement suggestions
  async generateImprovementSuggestions() {
    console.log('\\n GENERATING IMPROVEMENT SUGGESTIONS...\\n');
    
    const stats = await this.getFeedbackStats();
    const queryTypeStats = await this.analyzeByQueryType();
    const chunkProblems = await this.findProblematicChunks();

    console.log(' IMPROVEMENT RECOMMENDATIONS:\\n');

    // Overall system recommendations
    if (stats && stats.badFeedback > stats.goodFeedback) {
      console.log(' CRITICAL: System has more bad than good feedback!');
      console.log('    Immediate action needed on semantic search quality');
      console.log('    Consider lowering similarity threshold');
      console.log('    Review chunking strategy');
    }

    // Query type specific recommendations
    Object.entries(queryTypeStats || {}).forEach(([queryType, data]) => {
      const total = data.good + data.bad;
      const successRate = total > 0 ? (data.good / total) : 0;
      
      if (successRate < 0.5 && total >= 3) {
        console.log(\\\n \ needs improvement (\% success):\);
        console.log(\    Review prompts in src/lib/openai.ts\);
        console.log(\    Check if query type detection is accurate\);
        console.log(\    Consider adding more training data for this type\);
        
        if (data.reasons.length > 0) {
          console.log(\    Common issues: \\);
        }
      }
    });

    // Chunk quality recommendations
    const topProblemChunks = Object.entries(chunkProblems || {})
      .filter(([, data]) => data.count >= 2)
      .slice(0, 5);

    if (topProblemChunks.length > 0) {
      console.log('\\n CHUNK QUALITY ISSUES:');
      topProblemChunks.forEach(([chunkId, data]) => {
        console.log(\    Chunk \: \ bad ratings\);
        console.log(\     Consider: Rewriting, splitting, or removing this chunk\);
      });
    }

    // General recommendations
    console.log('\\n GENERAL RECOMMENDATIONS:');
    console.log('    Monitor feedback daily for trends');
    console.log('    Set up alerts for when bad feedback exceeds 40%');
    console.log('    Regularly review and update prompts');
    console.log('    Consider A/B testing different chunking strategies');
    console.log('    Implement automatic chunk quality scoring');
  }

  // Run comprehensive analysis
  async runFullAnalysis() {
    console.log(' STARTING COMPREHENSIVE FEEDBACK ANALYSIS');
    console.log('='.repeat(60));
    
    await this.getFeedbackStats();
    await this.analyzeByQueryType();
    await this.findProblematicChunks();
    await this.generateImprovementSuggestions();
    
    console.log('\\n ANALYSIS COMPLETE!');
  }
}

// CLI interface
async function main() {
  const analyzer = new FeedbackAnalyzer();
  
  const args = process.argv.slice(2);
  const command = args[0] || 'full';
  
  switch (command) {
    case 'stats':
      await analyzer.getFeedbackStats();
      break;
    case 'query-types':
      await analyzer.analyzeByQueryType();
      break;
    case 'chunks':
      await analyzer.findProblematicChunks();
      break;
    case 'suggestions':
      await analyzer.generateImprovementSuggestions();
      break;
    case 'full':
    default:
      await analyzer.runFullAnalysis();
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { FeedbackAnalyzer };
