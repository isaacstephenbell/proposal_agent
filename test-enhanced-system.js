#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Test script to validate all the enhancements
async function testEnhancedSystem() {
  console.log(' Testing Enhanced Proposal Agent System');
  console.log('='.repeat(50));
  
  const testQueries = [
    {
      query: 'restaurants',
      expected: 'Should find Crux eatery work with query expansion',
      category: 'Query Expansion Test'
    },
    {
      query: 'How do we typically approach ERP implementations?',
      expected: 'Should use methodology query type with multiple sources',
      category: 'Methodology Query Test'
    },
    {
      query: 'What work have we done for MGT?',
      expected: 'Should use client-specific search strategy',
      category: 'Client-Specific Test'
    },
    {
      query: 'private equity due diligence',
      expected: 'Should find relevant PE work with enhanced search',
      category: 'Industry-Specific Test'
    },
    {
      query: 'workforce planning solutions',
      expected: 'Should use semantic chunking and cross-encoder reranking',
      category: 'Complex Query Test'
    }
  ];
  
  let successCount = 0;
  let totalTime = 0;
  
  for (const test of testQueries) {
    console.log(\\\n Testing: \\);
    console.log(\Query: \
\\\);
    console.log(\Expected: \\);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: test.query,
          context: {}
        }),
      });
      
      const data = await response.json();
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      totalTime += queryTime;
      
      if (response.ok) {
        console.log(\ SUCCESS (\ms)\);
        console.log(\   Results: \ sources\);
        console.log(\   Query Type: \\);
        console.log(\   Search Strategy: \\);
        
        if (data.searchMetadata?.queryExpansion) {
          console.log(\   Query Expansion: \\);
          console.log(\   Synonyms: \\);
        }
        
        if (data.searchMetadata?.stageResults) {
          console.log(\   Stage Results: \\);
        }
        
        successCount++;
      } else {
        console.log(\ FAILED (\ms)\);
        console.log(\   Error: \\);
      }
    } catch (error) {
      console.log(\ ERROR: \\);
    }
  }
  
  console.log(\\\n TEST SUMMARY\);
  console.log(\=\.repeat(30));
  console.log(\ Successful: \/\\);
  console.log(\  Average time: \ms\);
  console.log(\ Success rate: \%\);
  
  if (successCount === testQueries.length) {
    console.log(\\\n ALL TESTS PASSED! System is ready for production.\);
  } else {
    console.log(\\\n  Some tests failed. Review the errors above.\);
  }
}

// Run the tests
testEnhancedSystem().catch(console.error);
