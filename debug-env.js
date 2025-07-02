const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

console.log('🔍 Testing environment variable loading...');
console.log('📁 Current working directory:', process.cwd());

const envPath = path.resolve(__dirname, '.env.local');
console.log('🎯 Looking for .env.local at:', envPath);

if (fs.existsSync(envPath)) {
  console.log('✅ .env.local file exists');
  
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.log('❌ Error loading .env.local:', result.error);
  } else {
    console.log('✅ .env.local loaded successfully');
    console.log('📊 Number of variables loaded:', Object.keys(result.parsed || {}).length);
    
    console.log('\n🔑 Environment variables found:');
    Object.keys(result.parsed || {}).forEach(key => {
      const value = result.parsed[key];
      const isPlaceholder = value.includes('your_') || value.includes('your-project');
      console.log(`  ${key}: ${isPlaceholder ? '❌ PLACEHOLDER' : '✅ REAL VALUE'}`);
    });
    
    console.log('\n🎯 Required variables check:');
    const required = [
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];
    
    required.forEach(key => {
      const value = process.env[key];
      if (value) {
        const isPlaceholder = value.includes('your_') || value.includes('your-project');
        console.log(`  ${key}: ${isPlaceholder ? '❌ PLACEHOLDER' : '✅ REAL VALUE'}`);
      } else {
        console.log(`  ${key}: ❌ NOT SET`);
      }
    });
  }
} else {
  console.log('❌ .env.local file not found');
} 