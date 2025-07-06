#!/usr/bin/env tsx

require('dotenv').config({ path: '.env.local' });
import { supabaseAdmin } from './src/lib/supabase';
import { generateEmbedding } from './src/lib/openai';

async function testDatabaseSearch() {
  console.log('🔍 Testing Database Search Functionality...\n');

  // Test 1: Check if we have data
  console.log('📊 Test 1: Checking database content...');
  const { data: allProposals, error: countError } = await supabaseAdmin
    .from('proposals')
    .select('id, client, filename, content')
    .limit(5);

  if (countError) {
    console.error('❌ Database error:', countError);
    return;
  }

  if (!allProposals || allProposals.length === 0) {
    console.log('❌ No proposals found in database!');
    return;
  }

  console.log(`✅ Found ${allProposals.length} proposals in database`);
  console.log('📋 Sample data:');
  allProposals.forEach((p, i) => {
    console.log(`  ${i+1}. ${p.client} - ${p.filename} (${p.content.length} chars)`);
  });

  // Test 2: Check if embeddings exist
  console.log('\n📊 Test 2: Checking embeddings...');
  const { data: withEmbeddings, error: embeddingError } = await supabaseAdmin
    .from('proposals')
    .select('id, embedding')
    .not('embedding', 'is', null)
    .limit(5);

  if (embeddingError) {
    console.error('❌ Embedding check error:', embeddingError);
    return;
  }

  console.log(`✅ Found ${withEmbeddings?.length || 0} proposals with embeddings`);

  // Test 3: Test match_proposals function
  console.log('\n📊 Test 3: Testing match_proposals function...');
  
  try {
    const testQuery = "MGT workforce planning";
    console.log(`🎯 Testing query: "${testQuery}"`);
    
    const queryEmbedding = await generateEmbedding(testQuery);
    console.log(`✅ Generated embedding (${queryEmbedding.length} dimensions)`);
    
    const { data: searchResults, error: searchError } = await supabaseAdmin
      .rpc('match_proposals', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Lower threshold for testing
        match_count: 5,
        filter_author: null,
        filter_sector: null,
        filter_client: null,
        filter_tags: null
      });

    if (searchError) {
      console.error('❌ Search error:', searchError);
      return;
    }

    console.log(`✅ Search completed, found ${searchResults?.length || 0} results`);
    
    if (searchResults && searchResults.length > 0) {
      console.log('📋 Top results:');
      searchResults.slice(0, 3).forEach((result: any, i: number) => {
        console.log(`  ${i+1}. ${result.client} - ${result.filename}`);
        console.log(`     Similarity: ${result.similarity?.toFixed(3)}`);
        console.log(`     Content: ${result.content.substring(0, 100)}...`);
      });
    } else {
      console.log('❌ No search results found');
    }

    // Test 4: Try simple text search
    console.log('\n📊 Test 4: Testing simple text search...');
    const { data: textResults, error: textError } = await supabaseAdmin
      .from('proposals')
      .select('id, client, filename, content')
      .ilike('content', '%MGT%')
      .limit(3);

    if (textError) {
      console.error('❌ Text search error:', textError);
      return;
    }

    console.log(`✅ Text search found ${textResults?.length || 0} results with "MGT"`);
    if (textResults && textResults.length > 0) {
      textResults.forEach((result: any, i: number) => {
        console.log(`  ${i+1}. ${result.client} - ${result.filename}`);
      });
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testDatabaseSearch().catch(console.error); 