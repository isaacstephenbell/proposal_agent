#!/usr/bin/env tsx

// Load environment variables first
require('dotenv').config({ path: '.env.local' });

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { createProposalPipeline } from './langchain-pipeline';

interface UploadOptions {
  folderPath: string;
  recursive?: boolean;
  fileTypes?: string[];
  pipelineConfig?: {
    chunkSize?: number;
    tokenOverlap?: number;
  };
}

interface UploadStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  errors: string[];
}

class LangChainUploader {
  private options: UploadOptions;
  private pipeline: ReturnType<typeof createProposalPipeline>;
  private stats: UploadStats;

  constructor(options: UploadOptions) {
    this.options = {
      recursive: false,
      fileTypes: ['txt', 'md', 'docx', 'pdf'],
      ...options
    };
    
    this.pipeline = createProposalPipeline(options.pipelineConfig);
    
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalChunks: 0,
      successfulChunks: 0,
      failedChunks: 0,
      errors: []
    };
  }

  async uploadDocuments(): Promise<void> {
    console.log('🚀 Starting LangChain-powered document upload...');
    console.log(`📁 Source folder: ${this.options.folderPath}`);
    console.log(`🔄 Recursive: ${this.options.recursive ? 'Yes' : 'No'}`);
    console.log(`📄 File types: ${this.options.fileTypes?.join(', ') || 'txt, md, docx, pdf'}`);

    try {
      const files = this.discoverFiles(this.options.folderPath);
      console.log(`\n📊 Found ${files.length} files to process`);

      if (files.length === 0) {
        console.log('❌ No supported files found. Supported formats: .txt, .md, .docx, .pdf');
        return;
      }

      this.stats.totalFiles = files.length;

      // Process files one by one
      for (const file of files) {
        await this.processFile(file);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Print final statistics
      this.printStats();

    } catch (error) {
      console.error('❌ Upload failed:', error);
      this.stats.errors.push(`Upload failed: ${error}`);
    }
  }

  private discoverFiles(folderPath: string): string[] {
    const files: string[] = [];
    const supportedTypes = this.options.fileTypes || ['txt', 'md', 'docx', 'pdf'];

    const processDirectory = (dirPath: string) => {
      try {
        const items = readdirSync(dirPath, { withFileTypes: true });

        for (const item of items) {
          const itemPath = join(dirPath, item.name);

          if (item.isDirectory() && this.options.recursive) {
            processDirectory(itemPath);
          } else if (item.isFile()) {
            const extension = item.name.toLowerCase().split('.').pop();
            if (extension && supportedTypes.includes(extension)) {
              files.push(itemPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    processDirectory(folderPath);
    return files;
  }

  private async processFile(filePath: string): Promise<void> {
    const fileName = basename(filePath);
    console.log(`\n📖 Processing: ${fileName}`);

    try {
      // Use the LangChain pipeline to process the document
      const result = await this.pipeline.processDocument(filePath);

      if (result.success) {
        this.stats.processedFiles++;
        this.stats.totalChunks += result.chunksProcessed;
        this.stats.successfulChunks += result.chunksProcessed;
        
        console.log(`✅ Successfully processed ${fileName}`);
        console.log(`   📊 Metadata:`);
        console.log(`      🏢 Sector: ${result.metadata.sector}`);
        console.log(`      👤 Author: ${result.metadata.author}`);
        console.log(`      👥 Client: ${result.metadata.client || 'Auto-extracted'}`);
        console.log(`      📅 Date: ${result.metadata.date || 'Not found'}`);
        console.log(`   📝 Chunks: ${result.chunksProcessed}`);
        console.log(`   🏷️  Tags: ${result.metadata.tags.join(', ')}`);
        
        if (result.errors.length > 0) {
          console.log(`   ⚠️  Warnings: ${result.errors.length}`);
          result.errors.forEach(error => console.log(`     - ${error}`));
        }
      } else {
        this.stats.failedFiles++;
        console.log(`❌ Failed to process ${fileName}`);
        result.errors.forEach(error => console.log(`   - ${error}`));
        this.stats.errors.push(`${fileName}: ${result.errors.join(', ')}`);
      }

    } catch (error) {
      this.stats.failedFiles++;
      console.log(`❌ Error processing ${fileName}:`, error);
      this.stats.errors.push(`${fileName}: ${error}`);
    }
  }

  private printStats(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Upload Summary:');
    console.log(`  Total files found: ${this.stats.totalFiles}`);
    console.log(`  Files processed: ${this.stats.processedFiles}`);
    console.log(`  Files failed: ${this.stats.failedFiles}`);
    console.log(`  Total chunks processed: ${this.stats.totalChunks}`);
    console.log(`  Successful chunks: ${this.stats.successfulChunks}`);
    console.log(`  Failed chunks: ${this.stats.failedChunks}`);
    
    if (this.stats.totalFiles > 0) {
      const successRate = (this.stats.processedFiles / this.stats.totalFiles * 100).toFixed(1);
      console.log(`  Success rate: ${successRate}%`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      this.stats.errors.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('='.repeat(50));
  }
}

// CLI interface
export async function uploadWithLangChain(
  folderPath: string,
  options: {
    recursive?: boolean;
    fileTypes?: string[];
    chunkSize?: number;
    tokenOverlap?: number;
  } = {}
): Promise<void> {
  const uploader = new LangChainUploader({
    folderPath,
    recursive: options.recursive ?? false,
    fileTypes: options.fileTypes,
    pipelineConfig: {
      chunkSize: options.chunkSize,
      tokenOverlap: options.tokenOverlap
    }
  });

  await uploader.uploadDocuments();
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔗 LangChain-Powered Proposal Upload Tool');
    console.log('Usage: tsx langchain-upload.ts <folder_path> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --recursive          Process subdirectories recursively');
    console.log('  --file-types=ext1,ext2   Comma-separated list of file extensions (default: txt,md,docx,pdf)');
    console.log('  --chunk-size=500     Chunk size in tokens (default: 500)');
    console.log('  --token-overlap=25   Token overlap between chunks (default: 25)');
    console.log('');
    console.log('Examples:');
    console.log('  tsx langchain-upload.ts ./proposals');
    console.log('  tsx langchain-upload.ts ./docs --recursive --file-types=pdf,docx');
    console.log('  tsx langchain-upload.ts ./proposals --chunk-size=600 --token-overlap=30');
    console.log('');
    console.log('Features:');
    console.log('  ✅ Automatic metadata extraction (client, author, date, sector)');
    console.log('  ✅ Semantic chunking with token-based overlap');
    console.log('  ✅ Fuzzy author matching against canonical list');
    console.log('  ✅ LLM-powered tag generation');
    console.log('  ✅ Sector classification (5 categories)');
    console.log('  ✅ Duplicate detection via SHA-256 hashing');
    process.exit(1);
  }

  const folderPath = args[0];
  const options: any = {};

  // Parse CLI arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--recursive') {
      options.recursive = true;
    } else if (arg.startsWith('--file-types=')) {
      options.fileTypes = arg.split('=')[1].split(',');
    } else if (arg.startsWith('--chunk-size=')) {
      options.chunkSize = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--token-overlap=')) {
      options.tokenOverlap = parseInt(arg.split('=')[1]);
    }
  }

  // Validate folder path
  try {
    const stats = statSync(folderPath);
    if (!stats.isDirectory()) {
      console.error(`❌ Path is not a directory: ${folderPath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Folder not found: ${folderPath}`);
    process.exit(1);
  }

  console.log('🔗 Starting LangChain-powered upload...');
  console.log(`📁 Processing: ${folderPath}`);
  console.log(`🧠 Auto-extracting: Client, Author, Date, Sector, Tags`);
  console.log(`📝 Using semantic chunking with ${options.tokenOverlap || 25}-token overlap`);
  console.log('');

  uploadWithLangChain(folderPath, options)
    .then(() => {
      console.log('\n🎊 LangChain upload completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 LangChain upload failed:', error);
      process.exit(1);
    });
} 