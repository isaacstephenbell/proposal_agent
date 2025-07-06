-- Create proposal_blocks table for reusable proposal sections
CREATE TABLE IF NOT EXISTS proposal_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  author_id VARCHAR(255), -- User ID who created the block
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  embedding VECTOR(1536), -- For similarity search
  notes TEXT -- Optional notes/comments about the block
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_blocks_author ON proposal_blocks(author_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON proposal_blocks(created_at);
CREATE INDEX IF NOT EXISTS idx_blocks_last_used_at ON proposal_blocks(last_used_at);
CREATE INDEX IF NOT EXISTS idx_blocks_usage_count ON proposal_blocks(usage_count);
CREATE INDEX IF NOT EXISTS idx_blocks_tags ON proposal_blocks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blocks_embedding ON proposal_blocks USING ivfflat (embedding vector_cosine_ops);

-- Create function to match similar blocks for auto-suggestions
CREATE OR REPLACE FUNCTION match_blocks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5,
  filter_author VARCHAR DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  exclude_block_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  tags text[],
  author_id varchar,
  created_at timestamp with time zone,
  last_used_at timestamp with time zone,
  usage_count int,
  notes text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    proposal_blocks.id,
    proposal_blocks.title,
    proposal_blocks.content,
    proposal_blocks.tags,
    proposal_blocks.author_id,
    proposal_blocks.created_at,
    proposal_blocks.last_used_at,
    proposal_blocks.usage_count,
    proposal_blocks.notes,
    1 - (proposal_blocks.embedding <=> query_embedding) AS similarity
  FROM proposal_blocks
  WHERE 1 - (proposal_blocks.embedding <=> query_embedding) > match_threshold
    AND (filter_author IS NULL OR proposal_blocks.author_id = filter_author)
    AND (filter_tags IS NULL OR proposal_blocks.tags && filter_tags)
    AND (exclude_block_ids IS NULL OR proposal_blocks.id != ALL(exclude_block_ids))
  ORDER BY proposal_blocks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function to update block usage when inserted into proposals
CREATE OR REPLACE FUNCTION update_block_usage(block_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE proposal_blocks 
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = block_id;
END;
$$;

-- Create function to get popular blocks (most used)
CREATE OR REPLACE FUNCTION get_popular_blocks(
  limit_count int DEFAULT 10,
  filter_author VARCHAR DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  tags text[],
  author_id varchar,
  created_at timestamp with time zone,
  last_used_at timestamp with time zone,
  usage_count int,
  notes text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    proposal_blocks.id,
    proposal_blocks.title,
    proposal_blocks.content,
    proposal_blocks.tags,
    proposal_blocks.author_id,
    proposal_blocks.created_at,
    proposal_blocks.last_used_at,
    proposal_blocks.usage_count,
    proposal_blocks.notes
  FROM proposal_blocks
  WHERE (filter_author IS NULL OR proposal_blocks.author_id = filter_author)
    AND (filter_tags IS NULL OR proposal_blocks.tags && filter_tags)
  ORDER BY proposal_blocks.usage_count DESC, proposal_blocks.last_used_at DESC
  LIMIT limit_count;
END;
$$;

-- Create function to get recent blocks
CREATE OR REPLACE FUNCTION get_recent_blocks(
  limit_count int DEFAULT 10,
  filter_author VARCHAR DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title varchar,
  content text,
  tags text[],
  author_id varchar,
  created_at timestamp with time zone,
  last_used_at timestamp with time zone,
  usage_count int,
  notes text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    proposal_blocks.id,
    proposal_blocks.title,
    proposal_blocks.content,
    proposal_blocks.tags,
    proposal_blocks.author_id,
    proposal_blocks.created_at,
    proposal_blocks.last_used_at,
    proposal_blocks.usage_count,
    proposal_blocks.notes
  FROM proposal_blocks
  WHERE (filter_author IS NULL OR proposal_blocks.author_id = filter_author)
    AND (filter_tags IS NULL OR proposal_blocks.tags && filter_tags)
  ORDER BY proposal_blocks.created_at DESC
  LIMIT limit_count;
END;
$$; 