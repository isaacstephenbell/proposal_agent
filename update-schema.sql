-- Safely add new columns to the proposals table (only if they don't exist)
DO $$ 
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'author') THEN
        ALTER TABLE proposals ADD COLUMN author VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'sector') THEN
        ALTER TABLE proposals ADD COLUMN sector VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'proposal_date') THEN
        ALTER TABLE proposals ADD COLUMN proposal_date DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'filename') THEN
        ALTER TABLE proposals ADD COLUMN filename VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'client') THEN
        ALTER TABLE proposals ADD COLUMN client VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'file_hash') THEN
        ALTER TABLE proposals ADD COLUMN file_hash VARCHAR(64);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'tags') THEN
        ALTER TABLE proposals ADD COLUMN tags TEXT[];
    END IF;
END $$;

-- Remove client_type column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'client_type') THEN
        ALTER TABLE proposals DROP COLUMN client_type;
    END IF;
END $$;

-- Update existing records to populate the new columns from metadata
UPDATE proposals 
SET 
  author = COALESCE(author, metadata->>'author'),
  sector = COALESCE(sector, metadata->>'sector'),
  proposal_date = COALESCE(proposal_date, 
    CASE 
      WHEN metadata->>'date' IS NOT NULL THEN (metadata->>'date')::DATE
      ELSE NULL
    END
  ),
  filename = COALESCE(filename, metadata->>'filename'),
  client = COALESCE(client, metadata->>'client'),
  file_hash = COALESCE(file_hash, metadata->>'file_hash'),
  tags = COALESCE(tags, 
    CASE 
      WHEN metadata->>'tags' IS NOT NULL THEN 
        ARRAY(SELECT jsonb_array_elements_text(metadata->'tags'))
      ELSE NULL
    END
  )
WHERE metadata IS NOT NULL;

-- Create indexes for better query performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals(author);
CREATE INDEX IF NOT EXISTS idx_proposals_sector ON proposals(sector);
CREATE INDEX IF NOT EXISTS idx_proposals_date ON proposals(proposal_date);
CREATE INDEX IF NOT EXISTS idx_proposals_client ON proposals(client);
CREATE INDEX IF NOT EXISTS idx_proposals_filename ON proposals(filename);
CREATE INDEX IF NOT EXISTS idx_proposals_file_hash ON proposals(file_hash);
CREATE INDEX IF NOT EXISTS idx_proposals_tags ON proposals USING GIN(tags);

-- Remove the section column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'section') THEN
        ALTER TABLE proposals DROP COLUMN section;
    END IF;
END $$;

-- Remove index if it exists
DROP INDEX IF EXISTS idx_proposals_section;

-- Update the match_proposals function to remove section and client_type
CREATE OR REPLACE FUNCTION match_proposals(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  filter_author VARCHAR DEFAULT NULL,
  filter_sector VARCHAR DEFAULT NULL,
  filter_client VARCHAR DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  author varchar,
  sector varchar,
  proposal_date date,
  filename varchar,
  client varchar,
  tags text[],
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
    proposals.author,
    proposals.sector,
    proposals.proposal_date,
    proposals.filename,
    proposals.client,
    proposals.tags,
    proposals.created_at,
    1 - (proposals.embedding <=> query_embedding) AS similarity
  FROM proposals
  WHERE 1 - (proposals.embedding <=> query_embedding) > match_threshold
    AND (filter_author IS NULL OR proposals.author = filter_author)
    AND (filter_sector IS NULL OR proposals.sector = filter_sector)
    AND (filter_client IS NULL OR proposals.client = filter_client)
    AND (filter_tags IS NULL OR proposals.tags && filter_tags)
  ORDER BY proposals.embedding <=> query_embedding
  LIMIT match_count;
END;
$$; 