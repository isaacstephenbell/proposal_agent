#!/usr/bin/env tsx

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { insertProposalChunk, supabaseAdmin } from './src/lib/supabase';
import { generateEmbedding } from './src/lib/openai';
import { chunkText, extractProposalSections } from './src/lib/chunker';
import { extractMetadataFromDocument } from './src/lib/extractMetadata';
import mammoth from 'mammoth';
import crypto from 'crypto';

interface UploadOptions {
  folderPath: string;
  client: string;
  date?: string;
  tags?: string[];
  author?: string;
  sector?: string;
}

async function uploadProposals(options: UploadOptions) {
  const { folderPath, client, date, tags } = options;

  try {
    console.log(`📁 Reading proposals from: ${folderPath}`);
    
    // Read all files in the folder
    const files = readdirSync(folderPath, { withFileTypes: true })
      .filter(dirent => dirent.isFile())
      .filter(dirent => /\.(txt|md|docx|pdf)$/i.test(dirent.name));

    if (files.length === 0) {
      console.log('❌ No supported files found. Supported formats: .txt, .md, .docx, .pdf');
      return;
    }

    console.log(`📄 Found ${files.length} files to process`);

    let totalChunks = 0;
    let successfulChunks = 0;
    let failedChunks = 0;

    for (const file of files) {
      const filePath = join(folderPath, file.name);
      console.log(`\n📖 Processing: ${file.name}`);

      try {
        // Read file content
        let content: string;
        
        if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
          content = readFileSync(filePath, 'utf-8');
        } else if (file.name.endsWith('.docx')) {
          try {
            const buffer = readFileSync(filePath);
            const result = await mammoth.extractRawText({ buffer });
            content = result.value;
            if (result.messages.length > 0) {
              console.log(`  ⚠️  DOCX parsing warnings:`, result.messages);
            }
          } catch (error) {
            console.log(`❌ Error reading DOCX file ${file.name}:`, error);
            continue;
          }
        } else {
          console.log(`⚠️  Skipping ${file.name} - .pdf support not implemented yet`);
          continue;
        }

        // Calculate file hash (SHA-256)
        const fileHash = crypto.createHash('sha256').update(content).digest('hex');

        // Check for duplicate by file_hash
        const { data: existing, error: checkError } = await supabaseAdmin
          .from('proposals')
          .select('id')
          .eq('file_hash', fileHash)
          .limit(1);
        if (checkError) {
          console.error('❌ Error checking for duplicate:', checkError);
          continue;
        }
        if (existing && existing.length > 0) {
          console.log(`⚠️  Duplicate detected (file_hash: ${fileHash}). Skipping upload for this file.`);
          continue;
        }

        // Extract metadata from full document BEFORE chunking
        const extractedMetadata = await extractMetadataFromDocument(content);
        
        // Merge CLI-provided tags with extracted tags
        const allTags = Array.from(new Set([
          ...(tags || []),
          ...extractedMetadata.tags
        ]));

        // Use LLM-extracted values as priority, fallback to CLI values
        const finalSector = extractedMetadata.sector || options.sector;
        const finalAuthor = extractedMetadata.author || options.author;
        const finalDate = extractedMetadata.date || date;

        console.log(`  📊 Extracted Metadata:`);
        console.log(`    Sector: ${finalSector}`);
        console.log(`    Author: ${finalAuthor}`);
        console.log(`    Date: ${finalDate || 'Not found'}`);
        console.log(`    Tags: ${allTags.join(', ')}`);

        // Process the text into chunks
        const chunks = chunkText(content);
        const sections = extractProposalSections(content);

        console.log(`  📝 Extracted ${chunks.length} chunks`);

        // Embed and store each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          try {
            // Generate embedding
            const embedding = await generateEmbedding(chunk);

            // Insert into database with document-level metadata applied to all chunks
            const result = await insertProposalChunk(chunk, embedding, {
              filename: file.name,
              client,
              date: finalDate,
              tags: allTags,
              author: finalAuthor,
              sector: finalSector,
              file_hash: fileHash
            });

            if (result.success) {
              successfulChunks++;
              process.stdout.write('.');
            } else {
              failedChunks++;
              console.log(`\n❌ Failed to insert chunk ${i} from ${file.name}:`, result.error);
            }

            totalChunks++;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            failedChunks++;
            console.log(`\n❌ Error processing chunk ${i} from ${file.name}:`, error);
          }
        }

        console.log(`\n✅ Completed: ${file.name}`);

      } catch (error) {
        console.log(`❌ Error reading file ${file.name}:`, error);
      }
    }

    console.log(`\n\n📊 Upload Summary:`);
    console.log(`  Total chunks processed: ${totalChunks}`);
    console.log(`  Successful: ${successfulChunks}`);
    console.log(`  Failed: ${failedChunks}`);
    console.log(`  Success rate: ${((successfulChunks / totalChunks) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Error uploading proposals:', error);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
📋 Usage: npx tsx upload_proposals.ts <folder-path> <client-name> [date] [author] [sector] [tags...]

Examples:
  npx tsx upload_proposals.ts ./proposals "Acme Corp"
  npx tsx upload_proposals.ts ./proposals "Tech Startup" "2024-01-15" "John Smith" "Sales" "crm" "enterprise"
  npx tsx upload_proposals.ts ./proposals "PowerParts Group" "2024-12-19" "Jane Doe" "Marketing" "market-study" "cicero"
    `);
    process.exit(1);
  }

  const [folderPath, client, date, author, sector, ...tags] = args;

  // Validate folder exists
  try {
    readdirSync(folderPath);
  } catch (error) {
    console.error(`❌ Folder not found: ${folderPath}`);
    process.exit(1);
  }

  console.log(`
🚀 Starting proposal upload...
📁 Folder: ${folderPath}
👤 Client: ${client}
📅 Date: ${date || 'Will be extracted from document'}
👨‍💼 Author: ${author || 'Will be extracted from document'}
🏢 Sector: ${sector || 'Will be auto-detected'}
🏷️  Tags: ${tags.length > 0 ? tags.join(', ') : 'Will be auto-generated'}
  `);

  await uploadProposals({
    folderPath,
    client,
    date,
    author,
    sector,
    tags: tags.length > 0 ? tags : undefined
  });
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { uploadProposals }; 