require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch() {
  console.log('🔍 Testing search with new separate columns...\n');

  try {
    // Test 1: Check if proposals have the new columns populated
    console.log('📊 Checking proposal data structure...');
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('id, author, sector, client, filename, tags, created_at')
      .limit(3);

    if (error) {
      console.error('❌ Error fetching proposals:', error);
      return;
    }

    console.log(`✅ Found ${proposals.length} proposals`);
    proposals.forEach((proposal, index) => {
      console.log(`\n📄 Proposal ${index + 1}:`);
      console.log(`   ID: ${proposal.id}`);
      console.log(`   Author: ${proposal.author || 'Not set'}`);
      console.log(`   Sector: ${proposal.sector || 'Not set'}`);
      console.log(`   Client: ${proposal.client || 'Not set'}`);
      console.log(`   Filename: ${proposal.filename || 'Not set'}`);
      console.log(`   Tags: ${proposal.tags ? proposal.tags.join(', ') : 'Not set'}`);
      console.log(`   Created: ${proposal.created_at}`);
    });

    // Test 2: Test filtering by author
    console.log('\n🔍 Testing filter by author...');
    const { data: authorResults, error: authorError } = await supabase
      .rpc('match_proposals', {
        query_embedding: new Array(1536).fill(0.1), // Dummy embedding
        match_threshold: 0.1,
        match_count: 5,
        filter_author: 'Jane Doe'
      });

    if (authorError) {
      console.error('❌ Error filtering by author:', authorError);
    } else {
      console.log(`✅ Found ${authorResults.length} proposals by Jane Doe`);
    }

    // Test 3: Test filtering by sector
    console.log('\n🔍 Testing filter by sector...');
    const { data: sectorResults, error: sectorError } = await supabase
      .rpc('match_proposals', {
        query_embedding: new Array(1536).fill(0.1), // Dummy embedding
        match_threshold: 0.1,
        match_count: 5,
        filter_sector: 'Marketing'
      });

    if (sectorError) {
      console.error('❌ Error filtering by sector:', sectorError);
    } else {
      console.log(`✅ Found ${sectorResults.length} proposals in Marketing sector`);
    }

    // Test 4: Test filtering by client
    console.log('\n🔍 Testing filter by client...');
    const { data: clientResults, error: clientError } = await supabase
      .rpc('match_proposals', {
        query_embedding: new Array(1536).fill(0.1), // Dummy embedding
        match_threshold: 0.1,
        match_count: 5,
        filter_client: 'PowerParts Group'
      });

    if (clientError) {
      console.error('❌ Error filtering by client:', clientError);
    } else {
      console.log(`✅ Found ${clientResults.length} proposals for PowerParts Group`);
    }

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testSearch(); 