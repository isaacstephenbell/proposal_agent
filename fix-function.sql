-- Drop all old match_proposals function signatures to resolve overloading
DROP FUNCTION IF EXISTS match_proposals(vector, float, int, varchar, varchar, varchar);
DROP FUNCTION IF EXISTS match_proposals(
  query_embedding vector,
  match_threshold float,
  match_count int,
  filter_author varchar,
  filter_sector varchar,
  filter_client varchar,
  filter_client_type varchar,
  filter_section varchar,
  filter_tags text[]
);

-- Remove client_type column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'client_type') THEN
        ALTER TABLE proposals DROP COLUMN client_type;
    END IF;
END $$;

-- Remove section column if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'proposals' AND column_name = 'section') THEN
        ALTER TABLE proposals DROP COLUMN section;
    END IF;
END $$;

-- Remove indexes for dropped columns
DROP INDEX IF EXISTS idx_proposals_client_type;
DROP INDEX IF EXISTS idx_proposals_section;

-- Create the new match_proposals function with only the columns we need
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