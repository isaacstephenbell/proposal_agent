import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { readFileSync } from 'fs';
import mammoth from 'mammoth';
import pdf from 'pdf-parse';
import crypto from 'crypto';
import { extractMetadataFromDocument, DocumentMetadata } from './extractMetadata';
import { chunkText } from './chunker';
import { insertProposalChunk, searchSimilarProposals, supabaseAdmin } from './supabase';
import { generateEmbedding } from './openai';
import { checkForDuplicates, calculateFileHash, formatDuplicateWarning } from './duplicate-detector';

// Configuration interface for the pipeline
export interface PipelineConfig {
  chunkSize: number;
  tokenOverlap: number;
  embeddingModel: string;
  vectorSearchThreshold: number;
  maxRetrievalResults: number;
}

// Default configuration
const DEFAULT_CONFIG: PipelineConfig = {
  chunkSize: 500,
  tokenOverlap: 25,
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  vectorSearchThreshold: 0.3,
  maxRetrievalResults: 5
};

// Document ingestion functions
export async function ingestDocument(filePath: string): Promise<{
  content: string;
  fileHash: string;
  metadata: {
    fileName: string;
    fileType: string;
    filePath: string;
    ingestedAt: string;
  };
}> {
  try {
    // Determine file type and parse accordingly
    const content = await parseDocument(filePath);
    
    // Generate file hash for deduplication using our duplicate detector
    const fileHash = calculateFileHash(content);
    
    // Extract basic file metadata
    const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
    const fileType = getFileType(filePath);
    
    return {
      content,
      fileHash,
      metadata: {
        fileName,
        fileType,
        filePath,
        ingestedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new Error(`Failed to ingest document: ${error}`);
  }
}

async function parseDocument(filePath: string): Promise<string> {
  const fileExtension = filePath.toLowerCase().split('.').pop();
  console.log(`  🔍 Parsing ${fileExtension?.toUpperCase()} file...`);
  
  switch (fileExtension) {
    case 'txt':
    case 'md':
      console.log(`  📄 Reading text file...`);
      return readFileSync(filePath, 'utf-8');
    
    case 'docx':
      try {
        console.log(`  📄 Reading DOCX file...`);
        const buffer = readFileSync(filePath);
        console.log(`  📦 DOCX buffer size: ${buffer.length} bytes`);
        console.log(`  🔄 Extracting text with Mammoth...`);
        const result = await mammoth.extractRawText({ buffer });
        console.log(`  ✅ DOCX text extracted: ${result.value.length} characters`);
        return result.value;
      } catch (error) {
        throw new Error(`Failed to parse DOCX file: ${error}`);
      }
    
    case 'pdf':
      try {
        console.log(`  📄 Reading PDF file...`);
        const buffer = readFileSync(filePath);
        console.log(`  📦 PDF buffer size: ${buffer.length} bytes`);
        console.log(`  🔄 Parsing PDF with pdf-parse...`);
        
        // Add timeout for PDF parsing
        const parsePromise = pdf(buffer);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF parsing timeout after 30 seconds')), 30000)
        );
        
        const data = await Promise.race([parsePromise, timeoutPromise]) as any;
        console.log(`  ✅ PDF parsed successfully`);
        console.log(`  📊 PDF info: ${data.numpages} pages, ${data.text.length} characters`);
        
        if (!data.text || data.text.trim().length === 0) {
          throw new Error('PDF appears to be empty or contains no extractable text');
        }
        
        return data.text;
      } catch (error) {
        console.error(`  ❌ PDF parsing error:`, error);
        throw new Error(`Failed to parse PDF file: ${error}`);
      }
    
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
}

function getFileType(filePath: string): string {
  const extension = filePath.toLowerCase().split('.').pop();
  return extension || 'unknown';
}

// Document chunking functions using enhanced semantic chunking
export async function chunkDocument(
  content: string,
  config: PipelineConfig = DEFAULT_CONFIG
): Promise<string[]> {
  try {
    // Use enhanced semantic chunking with token-based overlap
    const chunks = chunkText(content, config.chunkSize, config.tokenOverlap);
    
    console.log(`  📝 Created ${chunks.length} chunks with ${config.tokenOverlap}-token overlap`);
    
    return chunks;
  } catch (error) {
    throw new Error(`Failed to chunk document: ${error}`);
  }
}

// Vector storage functions
export async function storeVectors(
  chunks: string[],
  documentMetadata: DocumentMetadata,
  fileMetadata: any
): Promise<Array<{ success: boolean; error?: any; chunkIndex?: number }>> {
  try {
    const storedChunks = [];
    
    console.log(`  💾 Storing ${chunks.length} chunks with embeddings...`);
    console.log(`  🔐 File hash: ${fileMetadata?.fileHash || 'MISSING!'}`);
    
    // Store each chunk with its embedding
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for the chunk
      const embedding = await generateEmbedding(chunk);
      
      // Store the chunk with proper metadata
      const result = await insertProposalChunk(
        chunk,
        embedding,
        {
          filename: fileMetadata?.fileName || 'unknown',
          client: documentMetadata?.client || 'Auto-extracted',
          date: documentMetadata?.date,
          tags: documentMetadata?.tags || [],
          author: documentMetadata?.author || 'Unknown',
          sector: documentMetadata?.sector || 'other',
          file_hash: fileMetadata?.fileHash
        }
      );
      
      storedChunks.push({
        success: result.success,
        error: result.error,
        chunkIndex: i
      });
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return storedChunks;
  } catch (error) {
    throw new Error(`Failed to store vectors: ${error}`);
  }
}

// Vector retrieval functions
export async function retrieveVectors(
  query: string,
  filters?: {
    author?: string;
    sector?: string;
    client?: string;
    tags?: string[];
  },
  config: PipelineConfig = DEFAULT_CONFIG
): Promise<any[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);
    
    // Search for similar proposals
    const results = await searchSimilarProposals(
      embedding,
      config.maxRetrievalResults,
      filters
    );
    
    return results;
  } catch (error) {
    throw new Error(`Failed to retrieve vectors: ${error}`);
  }
}

// Main pipeline class
export class ProposalPipeline {
  private config: PipelineConfig;

  constructor(config?: Partial<PipelineConfig>) {
    // Filter out undefined values to preserve defaults
    const validConfig = config ? Object.fromEntries(
      Object.entries(config).filter(([_, value]) => value !== undefined)
    ) : {};
    
    this.config = { ...DEFAULT_CONFIG, ...validConfig };
  }

  async processDocument(filePath: string): Promise<{
    success: boolean;
    chunksProcessed: number;
    metadata: DocumentMetadata;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      console.log(`  📄 Processing document: ${filePath}`);
      
      // Step 1: Ingest document
      const ingestionResult = await ingestDocument(filePath);
      console.log(`  📖 Extracted text: ${ingestionResult.content.length} characters`);
      
      // Step 2: Check for duplicates with comprehensive detection
      console.log(`  🔍 Checking for duplicates...`);
      const duplicateCheck = await checkForDuplicates(
        ingestionResult.metadata.fileName,
        ingestionResult.content,
        ingestionResult.fileHash
      );
      
      if (duplicateCheck.isDuplicate) {
        const warning = formatDuplicateWarning(duplicateCheck);
        console.log(`  ⚠️  ${warning}`);
        
        if (!duplicateCheck.shouldProceed) {
          errors.push(`Duplicate detected: ${duplicateCheck.reason}. File: ${duplicateCheck.duplicateFile}`);
          return { success: false, chunksProcessed: 0, metadata: {} as DocumentMetadata, errors };
        } else {
          errors.push(`Warning: ${duplicateCheck.reason}. File: ${duplicateCheck.duplicateFile}. Proceeding with upload.`);
        }
      } else {
        console.log(`  ✅ No duplicates found, proceeding with upload`);
      }
      
      // Step 3: Extract metadata BEFORE chunking
      console.log(`  🔍 Extracting metadata with fuzzy author matching...`);
      const documentMetadata = await extractMetadataFromDocument(ingestionResult.content);
      
      console.log(`  📊 Extracted metadata:`);
      console.log(`      🏢 Sector: ${documentMetadata.sector}`);
      console.log(`      👤 Author: ${documentMetadata.author}`);
      console.log(`      👥 Client: ${documentMetadata.client || 'Auto-extracted from content'}`);
      console.log(`      📅 Date: ${documentMetadata.date || 'Not found'}`);
      console.log(`      🏷️  Tags: ${documentMetadata.tags.join(', ')}`);
      
      // Step 4: Chunk document using semantic chunking
      console.log(`  ✂️  Chunking with ${this.config.tokenOverlap}-token overlap...`);
      const chunks = await chunkDocument(ingestionResult.content, this.config);
      
      if (chunks.length === 0) {
        errors.push('No valid chunks generated from document');
        return { success: false, chunksProcessed: 0, metadata: documentMetadata, errors };
      }
      
      // Step 5: Store vectors
      console.log(`  🧠 Generating embeddings and storing...`);
      const storageResults = await storeVectors(
        chunks,
        documentMetadata,
        {
          ...ingestionResult.metadata,
          fileHash: ingestionResult.fileHash  // Explicitly pass the fileHash
        }
      );
      
      // Count successful chunks
      const successfulChunks = storageResults.filter(r => r.success).length;
      const failedChunks = storageResults.filter(r => !r.success).length;
      
      if (failedChunks > 0) {
        errors.push(`${failedChunks} chunks failed to store`);
        storageResults.forEach(r => {
          if (!r.success && r.error) {
            errors.push(`Chunk ${r.chunkIndex}: ${r.error}`);
          }
        });
      }
      
      console.log(`  ✅ Successfully stored ${successfulChunks}/${chunks.length} chunks`);
      
      return {
        success: successfulChunks > 0,
        chunksProcessed: successfulChunks,
        metadata: documentMetadata,
        errors
      };
      
    } catch (error) {
      const errorMessage = `Pipeline error: ${error instanceof Error ? error.message : error}`;
      errors.push(errorMessage);
      console.error(`  ❌ ${errorMessage}`);
      
      return {
        success: false,
        chunksProcessed: 0,
        metadata: {} as DocumentMetadata,
        errors
      };
    }
  }

  async queryDocuments(
    query: string,
    filters?: {
      author?: string;
      sector?: string;
      client?: string;
      tags?: string[];
    }
  ): Promise<{
    success: boolean;
    results: any[];
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      console.log(`  🔍 Querying documents with filters:`, filters);
      
      const results = await retrieveVectors(query, filters, this.config);
      
      console.log(`  📊 Found ${results.length} matching documents`);
      
      return {
        success: true,
        results,
        errors
      };
      
    } catch (error) {
      const errorMessage = `Query error: ${error instanceof Error ? error.message : error}`;
      errors.push(errorMessage);
      console.error(`  ❌ ${errorMessage}`);
      
      return {
        success: false,
        results: [],
        errors
      };
    }
  }
}

// Factory function to create pipeline instances
export function createProposalPipeline(config?: Partial<PipelineConfig>): ProposalPipeline {
  return new ProposalPipeline(config);
}