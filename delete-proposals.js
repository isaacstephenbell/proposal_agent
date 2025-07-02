require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteProposals() {
  console.log('🗑️  Deleting all rows from proposals table...');
  
  try {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .gte('id', 0); // Delete all rows where id >= 0 (which is all rows)

    if (error) {
      console.error('❌ Error deleting proposals:', error);
      process.exit(1);
    } else {
      console.log('✅ All rows deleted from proposals table.');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteProposals(); 