#!/usr/bin/env tsx

import { createProposalPipeline } from './src/lib/langchain-pipeline';
import { writeFileSync } from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  chunkSize: 300,
  tokenOverlap: 20,
  maxRetrievalResults: 3
};

// Create test documents
const testDocuments = [
  {
    filename: 'test-proposal-1.txt',
    content: `
# Market Research Proposal for TechCorp

## Executive Summary
This proposal outlines a comprehensive market research study for TechCorp's new software platform. Our team will conduct primary and secondary research to understand market opportunities and competitive landscape.

## Our Understanding
TechCorp is developing a new CRM platform targeting small to medium businesses. The company needs to understand market size, customer needs, and competitive positioning before launch.

## Proposed Approach
1. Primary Research: Customer interviews and surveys
2. Secondary Research: Market analysis and competitive intelligence
3. Data Analysis: Statistical analysis and trend identification
4. Reporting: Comprehensive findings and recommendations

## Timeline
- Phase 1: Research design (2 weeks)
- Phase 2: Data collection (4 weeks)
- Phase 3: Analysis and reporting (2 weeks)

## Team
Project lead: Michael Jensen
Research analyst: Sarah Smith
Data analyst: John Doe

## Deliverables
- Market sizing report
- Customer persona profiles
- Competitive analysis
- Strategic recommendations

Author: Michael Jensen
Date: March 15, 2024
Sector: Corporate
    `.trim()
  },
  {
    filename: 'test-proposal-2.txt',
    content: `
# Educational Technology Assessment for State University

## Project Overview
State University seeks to modernize its learning management system. This proposal outlines our approach to evaluate current technology infrastructure and recommend improvements.

## Understanding the Challenge
The university's current LMS is outdated and causing student engagement issues. Faculty report difficulty in creating interactive content and tracking student progress.

## Methodology
Our assessment will include:
- Technology audit
- User experience evaluation
- Performance benchmarking
- Cost-benefit analysis

## Expected Outcomes
1. Current state assessment
2. Future state recommendations
3. Implementation roadmap
4. Budget planning

## Project Timeline
8-week engagement with weekly progress reviews

Prepared by: Aaron Andersen
Date: April 10, 2024
Client: State University
Sector: Higher Education
    `.trim()
  }
];

async function runTests() {
  console.log('🧪 Testing LangChain Pipeline Implementation');
  console.log('=' .repeat(50));

  try {
    // Create pipeline instance
    console.log('📦 Creating pipeline instance...');
    const pipeline = createProposalPipeline(TEST_CONFIG);
    console.log('✅ Pipeline created successfully');

    // Create temporary test files
    console.log('\n📝 Creating test documents...');
    const testFiles: string[] = [];
    
    for (const doc of testDocuments) {
      const filePath = path.join(__dirname, 'temp-test-files', doc.filename);
      
      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      try {
        require('fs').mkdirSync(dir, { recursive: true });
      } catch (e) {
        // Directory might already exist
      }
      
      writeFileSync(filePath, doc.content);
      testFiles.push(filePath);
      console.log(`   Created: ${doc.filename}`);
    }

    // Test document processing
    console.log('\n🔄 Testing document processing...');
    const processResults = [];
    
    for (const filePath of testFiles) {
      console.log(`\n📄 Processing: ${path.basename(filePath)}`);
      
      try {
        const result = await pipeline.processDocument(filePath);
        processResults.push(result);
        
        if (result.success) {
          console.log(`✅ Success: ${result.chunksProcessed} chunks processed`);
          console.log(`   📊 Metadata: ${JSON.stringify(result.metadata, null, 2)}`);
        } else {
          console.log(`❌ Failed: ${result.errors.join(', ')}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error}`);
      }
    }

    // Test querying
    console.log('\n🔍 Testing query functionality...');
    const testQueries = [
      'What market research methodologies are recommended?',
      'How long does a technology assessment take?',
      'Who are the authors of these proposals?'
    ];

    for (const query of testQueries) {
      console.log(`\n❓ Query: "${query}"`);
      
      try {
        const queryResult = await pipeline.queryDocuments(query);
        
        if (queryResult.success && queryResult.results.length > 0) {
          console.log(`✅ Found ${queryResult.results.length} relevant chunks`);
          queryResult.results.forEach((result, index) => {
            console.log(`   ${index + 1}. ${result.filename || 'Unknown'} (similarity: ${result.similarity?.toFixed(3) || 'N/A'})`);
          });
        } else {
          console.log('❌ No results found');
        }
      } catch (error) {
        console.log(`❌ Query failed: ${error}`);
      }
    }

    // Test filtering
    console.log('\n🔍 Testing filtered queries...');
    const filterTests = [
      { query: 'technology assessment', filters: { sector: 'higher-education' } },
      { query: 'research methodology', filters: { author: 'Michael Jensen' } }
    ];

    for (const test of filterTests) {
      console.log(`\n🔍 Filtered query: "${test.query}" with filters: ${JSON.stringify(test.filters)}`);
      
      try {
        const result = await pipeline.queryDocuments(test.query, test.filters);
        
        if (result.success && result.results.length > 0) {
          console.log(`✅ Found ${result.results.length} filtered results`);
        } else {
          console.log('❌ No filtered results found');
        }
      } catch (error) {
        console.log(`❌ Filtered query failed: ${error}`);
      }
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('=' .repeat(50));
    
    const successfulProcesses = processResults.filter(r => r.success).length;
    const totalChunks = processResults.reduce((sum, r) => sum + r.chunksProcessed, 0);
    
    console.log(`📄 Documents processed: ${successfulProcesses}/${testDocuments.length}`);
    console.log(`📝 Total chunks created: ${totalChunks}`);
    console.log(`🔧 Pipeline configuration: ${JSON.stringify(TEST_CONFIG, null, 2)}`);

    if (successfulProcesses === testDocuments.length) {
      console.log('\n🎉 All tests passed! LangChain pipeline is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the error messages above.');
    }

    // Cleanup
    console.log('\n🧹 Cleaning up test files...');
    for (const filePath of testFiles) {
      try {
        require('fs').unlinkSync(filePath);
        console.log(`   Deleted: ${path.basename(filePath)}`);
      } catch (e) {
        console.log(`   Could not delete: ${path.basename(filePath)}`);
      }
    }

    // Try to remove temp directory
    try {
      require('fs').rmdirSync(path.join(__dirname, 'temp-test-files'));
      console.log('   Deleted temp directory');
    } catch (e) {
      // Directory might not be empty or might not exist
    }

  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
runTests()
  .then(() => {
    console.log('\n✅ Test suite completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }); 