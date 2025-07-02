#!/usr/bin/env tsx

// 🚨 Must be first: Load env BEFORE any imports that use process.env
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

console.log('🧪 Env loaded before any Supabase/OpenAI code');

// ✅ Only after .env is loaded, import other modules
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { insertProposalChunk } from './src/lib/supabase';
import { generateEmbedding } from './src/lib/openai';
import { chunkText, extractProposalSections } from './src/lib/chunker';
import { generateAutoTags } from './src/lib/generateAutoTags';

interface UploadOptions {
  folderPath: string;
  client: string;
  date?: string;
  tags?: string[];
  author?: string;
  sector?: string;
  clientType?: string;
  recursive?: boolean;
  fileTypes?: string[];
}

interface UploadStats {
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  errors: Array<{ file: string; error: string }>;
}

class BulkUploader {
  private stats: UploadStats;
  private options: UploadOptions;

  constructor(options: UploadOptions) {
    this.options = {
      recursive: false,
      fileTypes: ['.txt', '.md', '.docx', '.pdf'],
      ...options
    };
    
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      totalChunks: 0,
      successfulChunks: 0,
      failedChunks: 0,
      errors: []
    };
  }

  private async readFileContent(filePath: string): Promise<string | null> {
    const ext = extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.txt':
        case '.md':
          return readFileSync(filePath, 'utf-8');
        
        case '.docx':
          try {
            const buffer = readFileSync(filePath);
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
          } catch (error) {
            console.log(`❌ Error reading .docx file ${basename(filePath)}:`, error);
            return null;
          }
        
        case '.pdf':
          try {
            const buffer = readFileSync(filePath);
            const data = await pdf(buffer);
            return data.text;
          } catch (error) {
            console.log(`❌ Error reading .pdf file ${basename(filePath)}:`, error);
            return null;
          }
        
        default:
          console.log(`⚠️  Unsupported file type: ${basename(filePath)}`);
          return null;
      }
    } catch (error) {
      console.log(`❌ Error reading file ${basename(filePath)}:`, error);
      return null;
    }
  }

  private getFilesRecursively(dirPath: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = join(dirPath, item.name);
        
        if (item.isDirectory() && this.options.recursive) {
          files.push(...this.getFilesRecursively(fullPath));
        } else if (item.isFile()) {
          const ext = extname(item.name).toLowerCase();
          if (this.options.fileTypes!.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  private async processFile(filePath: string): Promise<void> {
    const fileName = basename(filePath);
    console.log(`\n📖 Processing: ${fileName}`);

    try {
      // Read file content
      const content = await this.readFileContent(filePath);
      if (!content) {
        this.stats.errors.push({ file: fileName, error: 'Could not read file content' });
        return;
      }

      // Hash the file content
      const file_hash = crypto.createHash('sha256').update(content).digest('hex');

      // Skip if file already uploaded
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
      const { data: existing } = await supabase
        .from('proposals')
        .select('id')
        .eq('metadata->>file_hash', file_hash)
        .maybeSingle();

      if (existing) {
        console.log(`⏭️ Skipping already-uploaded file: ${fileName}`);
        return;
      }

      // Auto-generate tags with LLM
      let autoTags: string[] = [];
      try {
        autoTags = await generateAutoTags(content);
        console.log(`🏷️  Auto-tags: ${autoTags.join(', ')}`);
      } catch (e) {
        console.warn('⚠️  Failed to auto-tag:', e);
      }

      // Process the text
      const chunks = chunkText(content);
      const sections = extractProposalSections(content);

      console.log(`  📝 Extracted ${chunks.length} chunks`);

      // Embed and store each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Generate embedding
          const embedding = await generateEmbedding(chunk);

          // Determine section type
          let sectionType: 'understanding' | 'approach' | 'timeline' | 'problem' | undefined;
          if (sections.understanding && chunk.includes(sections.understanding.substring(0, 100))) {
            sectionType = 'understanding';
          } else if (sections.approach && chunk.includes(sections.approach.substring(0, 100))) {
            sectionType = 'approach';
          } else if (sections.timeline && chunk.includes(sections.timeline.substring(0, 100))) {
            sectionType = 'timeline';
          } else if (sections.problem && chunk.includes(sections.problem.substring(0, 100))) {
            sectionType = 'problem';
          }

          // Insert into database
          const result = await insertProposalChunk(chunk, embedding, {
            filename: fileName,
            client: this.options.client,
            author: this.options.author,
            sector: this.options.sector,
            clientType: this.options.clientType,
            date: this.options.date,
            tags: Array.from(new Set([...(this.options.tags || []), ...autoTags])),
            file_hash,
            section: sectionType
          });

          if (result.success) {
            this.stats.successfulChunks++;
            process.stdout.write('.');
          } else {
            this.stats.failedChunks++;
            console.log(`\n❌ Failed to insert chunk ${i} from ${fileName}:`, result.error);
          }

          this.stats.totalChunks++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          this.stats.failedChunks++;
          this.stats.errors.push({ file: fileName, error: `Chunk ${i}: ${error}` });
          console.log(`\n❌ Error processing chunk ${i} from ${fileName}:`, error);
        }
      }

      this.stats.processedFiles++;
      console.log(`\n✅ Completed: ${fileName}`);

    } catch (error) {
      this.stats.errors.push({ file: fileName, error: String(error) });
      console.log(`❌ Error processing file ${fileName}:`, error);
    }
  }

  async upload(): Promise<UploadStats> {
    console.log(`📁 Reading proposals from: ${this.options.folderPath}`);
    
    // Get all files
    const files = this.getFilesRecursively(this.options.folderPath);
    this.stats.totalFiles = files.length;

    if (files.length === 0) {
      console.log('❌ No supported files found.');
      console.log(`Supported formats: ${this.options.fileTypes!.join(', ')}`);
      return this.stats;
    }

    console.log(`📄 Found ${files.length} files to process`);
    console.log(`🔄 Recursive mode: ${this.options.recursive ? 'Enabled' : 'Disabled'}`);

    // Process files
    for (const filePath of files) {
      await this.processFile(filePath);
    }

    return this.stats;
  }

  printSummary(): void {
    console.log(`\n\n📊 Upload Summary:`);
    console.log(`  Total files found: ${this.stats.totalFiles}`);
    console.log(`  Files processed: ${this.stats.processedFiles}`);
    console.log(`  Total chunks processed: ${this.stats.totalChunks}`);
    console.log(`  Successful chunks: ${this.stats.successfulChunks}`);
    console.log(`  Failed chunks: ${this.stats.failedChunks}`);
    console.log(`  Success rate: ${this.stats.totalChunks > 0 ? ((this.stats.successfulChunks / this.stats.totalChunks) * 100).toFixed(1) : 0}%`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      this.stats.errors.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`);
      });
    }
  }
}

// CLI interface
async function main() {
  console.log("🔍 Starting bulk upload...");
  console.log("Resolved .env.local path:", path.resolve(__dirname, '.env.local'));
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    console.log("Current env:", {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Set" : "Not set",
    });
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY in environment");
    process.exit(1);
  }
  console.log("✅ Environment loaded successfully");
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
📋 Enhanced Bulk Upload Tool

Usage: npx tsx bulk-upload.ts <folder-path> <client-name> [options]

Arguments:
  folder-path    Path to folder containing proposal files
  client-name    Name of the client for these proposals

Options:
  --date <date>           Date for the proposals (YYYY-MM-DD)
  --author <name>         Author of the proposals
  --sector <sector>       Sector responsible for the proposals
  --client-type <type>    Type of client (e.g., enterprise, startup, government)
  --tags <tag1,tag2>      Comma-separated tags (auto-generated tags will be added)
  --recursive             Search subdirectories recursively
  --file-types <types>    Comma-separated file extensions (default: .txt,.md,.docx,.pdf)

Examples:
  npx tsx bulk-upload.ts "C:/Users/IsaacBell/OneDrive/Documents/Proposals" "Acme Corp"
  npx tsx bulk-upload.ts "./proposals" "Tech Startup" --date "2024-01-15" --author "John Smith" --sector "Sales" --tags "crm,enterprise"
  npx tsx bulk-upload.ts "C:/Users/IsaacBell/OneDrive/Documents/Proposals" "PowerParts Group" --author "Jane Doe" --sector "Marketing" --client-type "enterprise"
    `);
    process.exit(1);
  }

  const [folderPath, client, ...options] = args;
  
  // Parse options
  let date: string | undefined;
  let tags: string[] | undefined;
  let author: string | undefined;
  let sector: string | undefined;
  let clientType: string | undefined;
  let recursive = false;
  let fileTypes = ['.txt', '.md', '.docx', '.pdf'];

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    
    switch (option) {
      case '--date':
        date = options[i + 1];
        i++;
        break;
      case '--tags':
        tags = options[i + 1].split(',').map(tag => tag.trim());
        i++;
        break;
      case '--author':
        author = options[i + 1];
        i++;
        break;
      case '--sector':
        sector = options[i + 1];
        i++;
        break;
      case '--client-type':
        clientType = options[i + 1];
        i++;
        break;
      case '--recursive':
        recursive = true;
        break;
      case '--file-types':
        fileTypes = options[i + 1].split(',').map(type => type.trim());
        i++;
        break;
    }
  }

  // Validate folder exists
  if (!existsSync(folderPath)) {
    console.error(`❌ Folder not found: ${folderPath}`);
    console.log('\n💡 Tip: Make sure the OneDrive folder is synced locally and the path is correct.');
    console.log('   Example: "C:/Users/IsaacBell/OneDrive/Documents/Proposals"');
    process.exit(1);
  }

  console.log(`
🚀 Starting enhanced bulk proposal upload...
📁 Folder: ${folderPath}
👤 Client: ${client}
📅 Date: ${date || 'Not specified'}
👨‍💼 Author: ${author || 'Not specified'}
🏢 Sector: ${sector || 'Not specified'}
🏭 Client Type: ${clientType || 'Not specified'}
🏷️  Tags: ${tags && tags.length > 0 ? tags.join(', ') : 'None'}
🔄 Recursive: ${recursive ? 'Yes' : 'No'}
📄 File types: ${fileTypes.join(', ')}
  `);

  const uploader = new BulkUploader({
    folderPath,
    client,
    date,
    tags,
    author,
    sector,
    clientType,
    recursive,
    fileTypes
  });

  try {
    const stats = await uploader.upload();
    uploader.printSummary();
  } catch (error) {
    console.error('❌ Error during upload:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { BulkUploader }; 