#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { createClient } from '@supabase/supabase-js';
import { generateAutoTags } from '../src/lib/generateAutoTags';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function updateMetadataForExisting() {
  try {
    console.log('🔍 Fetching existing proposals...');
    
    // Get all proposals that don't have file_hash
    const { data: proposals, error } = await supabaseAdmin
      .from('proposals')
      .select('*')
      .is('metadata->file_hash', null)
      .limit(10); // Process in batches
    
    if (error) {
      console.error('Error fetching proposals:', error);
      return;
    }
    
    console.log(`Found ${proposals.length} proposals to enrich`);
    
    for (const proposal of proposals) {
      try {
        console.log(`\n📝 Processing: ${proposal.metadata.filename}`);
        
        // Generate file hash from content
        const file_hash = crypto.createHash('sha256').update(proposal.content).digest('hex');
        
        // Generate auto-tags
        let autoTags: string[] = [];
        try {
          autoTags = await generateAutoTags(proposal.content);
          console.log(`🏷️  Auto-tags: ${autoTags.join(', ')}`);
        } catch (e) {
          console.warn('⚠️  Failed to auto-tag:', e);
        }
        
        // Merge existing tags with auto-tags
        const existingTags = proposal.metadata.tags || [];
        const allTags = Array.from(new Set([...existingTags, ...autoTags]));
        
        // Update the proposal
        const { error: updateError } = await supabaseAdmin
          .from('proposals')
          .update({
            metadata: {
              ...proposal.metadata,
              file_hash,
              tags: allTags,
              sector: proposal.metadata.sector || proposal.metadata.department // migrate old field
            }
          })
          .eq('id', proposal.id);
        
        if (updateError) {
          console.error(`❌ Failed to update ${proposal.metadata.filename}:`, updateError);
        } else {
          console.log(`✅ Updated ${proposal.metadata.filename}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing ${proposal.metadata.filename}:`, error);
      }
    }
    
    console.log('\n🎉 Metadata enrichment completed!');
    
  } catch (error) {
    console.error('Error in metadata enrichment:', error);
  }
}

// Run if called directly
if (require.main === module) {
  updateMetadataForExisting().catch(console.error);
}

export { updateMetadataForExisting }; 