require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runSchemaUpdate() {
  try {
    console.log('Reading schema update SQL...');
    const sql = fs.readFileSync('update-schema.sql', 'utf8');
    
    console.log('Running schema update...');
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error running schema update:', error);
      console.log('\nPlease run the SQL manually in your Supabase SQL Editor:');
      console.log('1. Go to your Supabase dashboard → SQL Editor');
      console.log('2. Copy and paste the contents of update-schema.sql');
      console.log('3. Run the SQL');
    } else {
      console.log('✅ Schema update completed successfully!');
    }
    
  } catch (error) {
    console.error('Error:', error);
    console.log('\nPlease run the SQL manually in your Supabase SQL Editor:');
    console.log('1. Go to your Supabase dashboard → SQL Editor');
    console.log('2. Copy and paste the contents of update-schema.sql');
    console.log('3. Run the SQL');
  }
}

runSchemaUpdate(); 