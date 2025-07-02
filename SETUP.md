# Setup Guide for Proposal Writing Assistant (Supabase)

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Environment File**
   Create a `.env.local` file in the root directory with the following variables:

   ```env
   # OpenAI API Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   EMBEDDING_MODEL=text-embedding-3-small

   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Detailed Setup Instructions

### 1. OpenAI API Setup

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and add it to your `.env.local` file

### 2. Supabase Project Setup

1. Go to [Supabase](https://supabase.com)
2. Create a new project or select existing one
3. Note your project URL and API keys from Settings → API
4. Copy the values to your `.env.local` file:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon Key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Database Setup

1. **Enable pgvector Extension**:
   - Go to your Supabase dashboard → SQL Editor
   - Run: `CREATE EXTENSION IF NOT EXISTS vector;`

2. **Create the Proposals Table**:
   ```sql
   CREATE TABLE proposals (
     id BIGSERIAL PRIMARY KEY,
     content TEXT NOT NULL,
     embedding vector(1536),
     metadata JSONB NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

3. **Create Vector Search Function**:
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

### 4. Upload Historical Proposals

Use the CLI tool to upload your historical proposals:

```bash
# Create a folder with your proposal files (.txt, .md)
mkdir proposals
# Add your proposal files to this folder

# Upload all proposals from the folder
npx tsx upload_proposals.ts ./proposals "Acme Corp"

# Upload with date and tags
npx tsx upload_proposals.ts ./proposals "Tech Startup" "2024-01-15" "crm" "enterprise"
```

## Testing the Setup

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Upload test proposals**:
   - Create a `proposals` folder
   - Add some `.txt` or `.md` files with proposal content
   - Run the upload script: `npx tsx upload_proposals.ts ./proposals "Test Client"`

3. **Test proposal generation**:
   - Navigate to `/generate`
   - Enter a problem statement
   - Generate a proposal

4. **Test chat functionality**:
   - Navigate to `/chat`
   - Ask a question about your uploaded proposals

## Common Issues and Solutions

### Issue: "Supabase not initialized" error
**Solution**: Check that all Supabase environment variables are correctly set in `.env.local`

### Issue: "OpenAI API key not found" error
**Solution**: Verify your OpenAI API key is correct and has sufficient credits

### Issue: Vector search not working
**Solution**: Ensure the pgvector extension is enabled and the `match_proposals` function is created

### Issue: "Function match_proposals does not exist" error
**Solution**: Run the SQL commands in the Supabase SQL Editor to create the function

### Issue: CLI upload script fails
**Solution**: 
1. Check that all environment variables are set
2. Ensure the proposals table exists
3. Verify file permissions for the proposals folder

## Production Deployment

### Vercel Deployment
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production
Make sure to add all the same environment variables in your production environment (Vercel, Netlify, etc.)

## Database Schema

### Proposals Table
```sql
CREATE TABLE proposals (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,                    -- The actual proposal text chunk
  embedding vector(1536),                   -- OpenAI embedding vector
  metadata JSONB NOT NULL,                  -- Metadata about the proposal
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Metadata Structure
```json
{
  "filename": "proposal.txt",
  "client": "Acme Corp",
  "date": "2024-01-15",
  "tags": ["crm", "enterprise"],
  "section": "understanding"
}
```

## Security Best Practices

1. **Never commit `.env.local`** to version control
2. **Use different API keys** for development and production
3. **Implement authentication** for production use
4. **Set up rate limiting** for API endpoints
5. **Regularly rotate** your API keys
6. **Use Row Level Security (RLS)** in Supabase for production

## Support

If you encounter issues:
1. Check the browser console for client-side errors
2. Check the terminal/server logs for server-side errors
3. Verify all environment variables are set correctly
4. Ensure pgvector extension is enabled in Supabase
5. Check OpenAI API key validity and credits
6. Verify the database schema is set up correctly 