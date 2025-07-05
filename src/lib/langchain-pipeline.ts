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
    
    // Generate file hash for deduplication
    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    
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
  
  switch (fileExtension) {
    case 'txt':
    case 'md':
      return readFileSync(filePath, 'utf-8');
    
    case 'docx':
      try {
        const buffer = readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (error) {
        throw new Error(`Failed to parse DOCX file: ${error}`);
      }
    
    case 'pdf':
      try {
        const buffer = readFileSync(filePath);
        const data = await pdf(buffer);
        return data.text;
      } catch (error) {
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
      
      // Step 2: Check for duplicates
      const { data: existing, error: checkError } = await supabaseAdmin
        .from('proposals')
        .select('id')
        .eq('file_hash', ingestionResult.fileHash)
        .limit(1);
      
      if (checkError) {
        errors.push(`Error checking for duplicates: ${checkError.message}`);
        return { success: false, chunksProcessed: 0, metadata: {} as DocumentMetadata, errors };
      }
      
      if (existing && existing.length > 0) {
        errors.push(`Duplicate detected (SHA-256: ${ingestionResult.fileHash}). Skipping.`);
        return { success: false, chunksProcessed: 0, metadata: {} as DocumentMetadata, errors };
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