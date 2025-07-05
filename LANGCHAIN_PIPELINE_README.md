# Proposal.AI LangChain Pipeline Implementation

This document describes the comprehensive LangChain-based pipeline implementation for proposal ingestion and retrieval, as specified in the detailed requirements.

## 🏗️ Architecture Overview

The pipeline consists of five main LangChain chains that work together to process documents:

1. **Document Ingestion Chain** - Parses files and extracts raw content
2. **Metadata Extraction Chain** - Extracts structured metadata before chunking
3. **Document Chunking Chain** - Creates semantic chunks with token-based overlap
4. **Embedding Generation Chain** - Generates vector embeddings for chunks
5. **Vector Storage Chain** - Stores chunks and embeddings in Supabase
6. **Vector Retrieval Chain** - Retrieves relevant chunks based on queries

## 📋 Implementation Details

### Document Support
- **PDF**: Text-based parsing using `pdf-parse` (no OCR)
- **Word Documents**: Full text extraction using `mammoth`
- **Text Files**: `.txt` and `.md` files

### Metadata Extraction

The pipeline extracts the following metadata fields **before** chunking:

#### Sector Classification
Documents are classified into one of five sectors:
- `social-impact`
- `private-equity-due-diligence`
- `corporate`
- `higher-education`
- `other`

#### Author Extraction
Uses fuzzy matching against a canonical author list with 90% similarity threshold:
- Aaron Andersen, Jacob Allen, James Shirey, Jason Richards
- Miguel Howe, Dan Case, Douglas Hervey, George Durham
- Michael Jensen (also matches "Mike Jensen"), Rory Brosius
- Aaron Jorgensen, Benjamin Aplanalp, George Wong, Michael Jenson

#### Additional Metadata
- **Proposal Date**: Extracted from document headers/content
- **Client**: Extracted from document content or metadata
- **Tags**: Up to 8 high-quality LLM-generated tags focusing on nouns/adjectives
- **File Hash**: SHA-256 hash for deduplication

### Chunking Strategy

- **Semantic Chunking**: Preserves natural language boundaries
- **Token-based Overlap**: 20-30 tokens (80-120 characters) between chunks
- **Configurable Size**: Default 500 tokens per chunk
- **Quality Filtering**: Removes chunks < 100 characters or < 20 tokens

### Vector Embeddings

- **Model**: OpenAI `text-embedding-3-small` (configurable)
- **Storage**: Supabase with pgvector extension
- **Search**: Cosine similarity with HNSW/IVFFlat indexing
- **Retrieval**: Top-K nearest neighbors with filtering support

## 🚀 Usage

### Basic Document Processing

```typescript
import { createProposalPipeline } from './src/lib/langchain-pipeline';

const pipeline = createProposalPipeline({
  chunkSize: 500,
  tokenOverlap: 25,
  maxRetrievalResults: 5
});

// Process a single document
const result = await pipeline.processDocument('./path/to/document.pdf');
console.log(`Processed ${result.chunksProcessed} chunks`);
console.log(`Metadata: ${JSON.stringify(result.metadata)}`);
```

### Batch Upload with CLI

```bash
# Basic upload
npx tsx src/lib/langchain-upload.ts ./proposals

# With options
npx tsx src/lib/langchain-upload.ts ./docs \
  --recursive \
  --file-types=pdf,docx \
  --chunk-size=600 \
  --token-overlap=30
```

### Query Documents

```typescript
// Simple query
const queryResult = await pipeline.queryDocuments(
  "What methodologies are recommended for market research?"
);

// With filters
const filteredResult = await pipeline.queryDocuments(
  "technology assessment approaches",
  {
    sector: "higher-education",
    author: "Aaron Andersen",
    tags: ["technology", "assessment"]
  }
);
```

### API Integration

The pipeline integrates seamlessly with the existing API endpoints:

```typescript
// In your API route
import { createProposalPipeline } from '@/lib/langchain-pipeline';

export async function POST(request: NextRequest) {
  const { query, filters } = await request.json();
  
  const pipeline = createProposalPipeline();
  const result = await pipeline.queryDocuments(query, filters);
  
  return NextResponse.json({
    results: result.results,
    success: result.success
  });
}
```

## ⚙️ Configuration

### Pipeline Configuration

```typescript
interface PipelineConfig {
  chunkSize: number;           // Default: 500
  tokenOverlap: number;        // Default: 25
  embeddingModel: string;      // Default: 'text-embedding-3-small'
  vectorSearchThreshold: number; // Default: 0.7
  maxRetrievalResults: number; // Default: 5
}
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
EMBEDDING_MODEL=text-embedding-3-small
```

## 🧪 Testing

Run the test suite to validate the pipeline:

```bash
npx tsx test-langchain-pipeline.ts
```

The test suite:
- Creates sample documents
- Tests document processing
- Validates metadata extraction
- Tests query functionality
- Tests filtering capabilities
- Provides comprehensive reporting

## 📊 Performance Features

### Deduplication
- SHA-256 hashing prevents duplicate documents
- Automatic skip of already-processed files

### Parallel Processing
- Batch embedding generation for efficiency
- Configurable rate limiting to avoid API limits

### Error Handling
- Comprehensive error reporting
- Graceful degradation for partial failures
- Detailed logging for debugging

### Scalability
- Configurable chunk sizes and overlap
- Support for multi-granularity chunking
- Extensible chain architecture

## 🔄 Migration from Legacy System

### Compatibility
- Maintains compatibility with existing database schema
- Preserves existing metadata fields
- Supports legacy upload scripts during transition

### Migration Steps
1. Install new dependencies: `npm install --legacy-peer-deps`
2. Test pipeline: `npx tsx test-langchain-pipeline.ts`
3. Upload new documents: `npx tsx src/lib/langchain-upload.ts ./folder`
4. Update API endpoints to use new pipeline (already done)

## 🎯 Key Benefits

### Enhanced Accuracy
- Fuzzy author matching with 90% similarity
- Improved sector classification with LLM
- Better date extraction from multiple sources

### Better Chunking
- Token-based overlap prevents information loss
- Semantic boundaries preserve context
- Configurable chunk sizes for different use cases

### Modular Architecture
- Each pipeline stage is a separate LangChain chain
- Easy to swap components (embeddings, chunking, etc.)
- Extensible for future enhancements

### Production Ready
- Comprehensive error handling
- Detailed logging and monitoring
- Configurable parameters via environment variables

## 🛠️ Advanced Usage

### Custom Chunking Strategies

```typescript
import { semanticChunkText, createMultiGranularityChunks } from './src/lib/chunker';

// Semantic chunking that preserves paragraph boundaries
const semanticChunks = semanticChunkText(content, 400);

// Multi-granularity chunking for different use cases
const multiChunks = createMultiGranularityChunks(content);
// Returns: { fine_chunks, medium_chunks, coarse_chunks }
```

### Custom Metadata Extraction

```typescript
import { extractMetadataFromDocument } from './src/lib/extractMetadata';

const metadata = await extractMetadataFromDocument(content);
// Returns: { sector, tags, author, date, client }
```

### Direct Chain Usage

```typescript
import { 
  DocumentIngestionChain,
  MetadataExtractionChain,
  DocumentChunkingChain 
} from './src/lib/langchain-pipeline';

// Use individual chains
const ingestionChain = new DocumentIngestionChain();
const result = await ingestionChain.call({ filePath: './document.pdf' });
```

## 📈 Monitoring and Metrics

The pipeline provides detailed metrics:

```typescript
const result = await pipeline.processDocument('./document.pdf');

console.log({
  success: result.success,
  chunksProcessed: result.chunksProcessed,
  metadata: result.metadata,
  errors: result.errors
});
```

## 🔧 Troubleshooting

### Common Issues

1. **OpenAI API Key**: Ensure valid API key with sufficient credits
2. **Supabase Connection**: Verify URL and service role key
3. **pgvector Extension**: Enable in Supabase dashboard
4. **Memory Issues**: Reduce chunk size for large documents

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=langchain* npx tsx your-script.ts
```

## 🚀 Future Enhancements

The modular architecture supports easy addition of:
- Additional file formats (PowerPoint, etc.)
- Alternative embedding models
- Custom chunking strategies
- Advanced retrieval techniques (hybrid search, reranking)
- Real-time processing capabilities

## 📝 API Reference

### ProposalPipeline Class

```typescript
class ProposalPipeline {
  constructor(config?: Partial<PipelineConfig>)
  
  async processDocument(filePath: string): Promise<ProcessResult>
  async queryDocuments(query: string, filters?: FilterOptions): Promise<QueryResult>
}
```

### Factory Function

```typescript
function createProposalPipeline(config?: Partial<PipelineConfig>): ProposalPipeline
```

This implementation provides a robust, scalable, and maintainable foundation for proposal document processing and retrieval. 