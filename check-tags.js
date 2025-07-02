require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTags() {
  console.log('🔍 Checking tags consistency across chunks...\n');

  try {
    // Get all proposals grouped by filename
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('id, filename, tags, sector, created_at')
      .order('filename')
      .order('created_at');

    if (error) {
      console.error('❌ Error fetching proposals:', error);
      return;
    }

    // Group by filename
    const files = {};
    proposals.forEach(proposal => {
      if (!files[proposal.filename]) {
        files[proposal.filename] = [];
      }
      files[proposal.filename].push(proposal);
    });

    // Check each file
    Object.keys(files).forEach(filename => {
      const chunks = files[filename];
      console.log(`📄 File: ${filename} (${chunks.length} chunks)`);
      
      // Check if all chunks have the same tags
      const firstChunk = chunks[0];
      const allSameTags = chunks.every(chunk => 
        JSON.stringify(chunk.tags) === JSON.stringify(firstChunk.tags)
      );
      const allSameSector = chunks.every(chunk => 
        chunk.sector === firstChunk.sector
      );

      console.log(`   Sector: ${firstChunk.sector}`);
      console.log(`   Tags: ${firstChunk.tags ? firstChunk.tags.join(', ') : 'None'}`);
      console.log(`   Tags consistent: ${allSameTags ? '✅' : '❌'}`);
      console.log(`   Sector consistent: ${allSameSector ? '✅' : '❌'}`);

      if (!allSameTags) {
        console.log('   ❌ Inconsistent tags found:');
        chunks.forEach((chunk, index) => {
          console.log(`     Chunk ${index + 1}: ${chunk.tags ? chunk.tags.join(', ') : 'None'}`);
        });
      }

      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTags(); 