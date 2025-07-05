# Proposal Writing Assistant

A Retrieval-Augmented Generation (RAG) powered proposal writing assistant that generates structured proposals based on historical success patterns using Supabase with pgvector.

## 🚀 Features

- **Proposal Generator**: Create structured proposals with "Our Understanding", "Proposed Approach", and "Timeline/Workplan" sections
- **Discovery Chat**: Ask natural language questions about historical proposals
- **No Hallucination**: All generated content is grounded in actual historical proposal data
- **Vector Search**: Uses Supabase Postgres with pgvector for semantic similarity
- **Modern UI**: Built with Next.js 14, TypeScript, and Tailwind CSS
- **Enhanced Bulk Upload**: Advanced CLI tool for batch uploading proposals from OneDrive with support for .txt, .md, .docx, and .pdf files

## 🏗️ Architecture

### RAG Pipeline
1. **Vector Embeddings**: OpenAI's `text-embedding-3-small` (1536 dimensions)
2. **Vector Storage**: Supabase Postgres with pgvector extension
3. **Semantic Retrieval**: Find similar historical proposals using cosine similarity
4. **Content Generation**: GPT-4 generates new proposals based on retrieved context

### Tech Stack
- **Frontend**: Next.js 14 App Router, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase Postgres with pgvector
- **AI**: OpenAI GPT-4 and Embeddings API
- **Deployment**: Ready for Vercel deployment

## 📋 Prerequisites

1. **Supabase Project** with Postgres database and pgvector extension
2. **OpenAI API Key** for embeddings and text generation
3. **Supabase Service Role Key** for server-side operations

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd template-2
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# OpenAI
OPENAI_API_KEY=your_openai_api_key
EMBEDDING_MODEL=text-embedding-3-small

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Supabase Setup

1. **Create a Supabase Project**:
   - Go to [Supabase](https://supabase.com) and create a new project
   - Note your project URL and API keys

2. **Enable pgvector Extension**:
   - Go to your Supabase dashboard → SQL Editor
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`

3. **Create the Proposals Table**:
   ```sql
   CREATE TABLE proposals (
     id BIGSERIAL PRIMARY KEY,
     content TEXT NOT NULL,
     embedding vector(1536),
     metadata JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

4. **Create Vector Search Function**:
   ```sql
   CREATE OR REPLACE FUNCTION match_proposals(
     query_embedding vector(1536),
     match_threshold float DEFAULT 0.7,
     match_count int DEFAULT 5
   )
   RETURNS TABLE (
     id bigint,
     content text,
     metadata jsonb,
     created_at timestamp with time zone,
     similarity float
   )
   LANGUAGE plpgsql
   AS $$
   BEGIN
     RETURN QUERY
     SELECT
       proposals.id,
       proposals.content,
       proposals.metadata,
       proposals.created_at,
       1 - (proposals.embedding <=> query_embedding) AS similarity
     FROM proposals
     WHERE 1 - (proposals.embedding <=> query_embedding) > match_threshold
     ORDER BY proposals.embedding <=> query_embedding
     LIMIT match_count;
   END;
   $$;
   ```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── ask/route.ts              # Chat-based discovery API
│   │   ├── generate/route.ts         # Proposal generation API
│   │   └── embed/route.ts            # Internal embedding API
│   ├── page.tsx                      # Combined chat and generation interface
│   ├── layout.tsx                    # Root layout with navigation
│   └── page.tsx                      # Home page
├── components/
│   └── Navigation.tsx                # Navigation component
├── lib/
│   ├── supabase.ts                   # Supabase client and vector search
│   ├── openai.ts                     # OpenAI wrapper for GPT + embeddings
│   ├── chunker.ts                    # Text chunking utilities
│   └── types.ts                      # Shared type definitions
├── bulk-upload.ts                    # Enhanced CLI script for batch uploads
├── upload.bat                        # Windows batch script for easy uploads
└── upload.ps1                        # PowerShell script for advanced uploads
```

## 🎯 Usage

### 1. Upload Historical Proposals

#### Enhanced Bulk Upload Tool

The new bulk upload system supports multiple file formats and OneDrive integration:

**Supported File Formats:**
- `.txt` - Plain text files
- `.md` - Markdown files  
- `.docx` - Microsoft Word documents
- `.pdf` - PDF documents

**Command Line Usage:**
```bash
# Basic upload from OneDrive folder
npx tsx bulk-upload.ts "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Acme Corp"

# Upload with date and tags
npx tsx bulk-upload.ts "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Tech Startup" --date "2024-01-15" --tags "crm,enterprise"

# Recursive upload (includes subdirectories)
npx tsx bulk-upload.ts "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Client Name" --recursive

# Custom file types
npx tsx bulk-upload.ts "./proposals" "Client Name" --file-types ".txt,.md"
```

**Windows Batch Script (upload.bat):**
```cmd
# Simple usage
upload.bat "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Acme Corp"

# With options
upload.bat "C:\Users\IsaacBell\OneDrive\Documents\Proposals" "Tech Startup" --date "2024-01-15" --tags "crm,enterprise"
```

**PowerShell Script (upload.ps1):**
```powershell
# Simple usage
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Acme Corp"

# With options
.\upload.ps1 -FolderPath "C:\Users\IsaacBell\OneDrive\Documents\Proposals" -ClientName "Tech Startup" -Date "2024-01-15" -Tags "crm,enterprise" -Recursive
```

**Common OneDrive Paths:**
- `C:\Users\%USERNAME%\OneDrive\Documents\Proposals`
- `C:\Users\%USERNAME%\OneDrive\Business\Proposals`
- `C:\Users\%USERNAME%\OneDrive\Work\Proposals`

**Features:**
- ✅ Automatic file format detection and parsing
- ✅ Recursive directory scanning
- ✅ Progress tracking with detailed statistics
- ✅ Error handling and reporting
- ✅ Rate limiting to avoid API limits
- ✅ Section type detection (understanding, approach, timeline, problem)
- ✅ Metadata tagging (client, date, tags, filename)

**Legacy Upload Tool:**
```bash
# Original upload tool (still available)
npx tsx upload_proposals.ts ./proposals "Acme Corp"
```

### 2. Generate New Proposals
- Navigate to `/generate`
- Enter a problem statement
- Optionally specify a client name
- Generate a structured proposal based on historical patterns

### 3. Discover Insights
- Navigate to `/chat`
- Ask natural language questions like:
  - "Have we solved a problem like this before?"
  - "What approach did we use for similar projects?"
  - "What was our timeline for CRM implementations?"

## 🔧 API Endpoints

### POST `/api/ask`
Ask questions about historical proposals.

**Body:**
```json
{
  "query": "Have we solved a problem like this before?"
}
```

### POST `/api/generate`
Generate a new proposal based on historical data.

**Body:**
```json
{
  "problem": "We need to implement a customer relationship management system",
  "client": "Tech Startup"
}
```

### POST `/api/embed`
Internal API for embedding new proposal text.

**Body:**
```json
{
  "text": "Proposal content...",
  "metadata": {
    "filename": "proposal.txt",
    "client": "Acme Corp",
    "date": "2024-01-15",
    "tags": ["crm", "enterprise"]
  }
}
```

## 🚀 Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Local Deployment
```bash
npm run build
npm start
```

## 🔒 Security Considerations

- Store Supabase service role key securely
- Use environment variables for all API keys
- Implement proper authentication for production use
- Consider rate limiting for API endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the Supabase documentation for pgvector setup
2. Verify your OpenAI API key has sufficient credits
3. Ensure all environment variables are properly set
4. Check the browser console and server logs for errors
5. Verify the pgvector extension is enabled in your Supabase project