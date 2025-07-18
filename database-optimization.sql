-- Database Optimization for Enhanced Search Performance

-- 1. Optimize existing indexes
DROP INDEX IF EXISTS idx_proposals_embedding;
CREATE INDEX idx_proposals_embedding ON proposals USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 2. Add performance indexes for new search patterns
CREATE INDEX IF NOT EXISTS idx_proposals_client_lower ON proposals (LOWER(client));
CREATE INDEX IF NOT EXISTS idx_proposals_author_lower ON proposals (LOWER(author));
CREATE INDEX IF NOT EXISTS idx_proposals_sector_lower ON proposals (LOWER(sector));

-- 3. Add composite indexes for filtered searches
CREATE INDEX IF NOT EXISTS idx_proposals_client_date ON proposals (client, proposal_date DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_sector_date ON proposals (sector, proposal_date DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_author_date ON proposals (author, proposal_date DESC);

-- 4. Add full-text search index for content
CREATE INDEX IF NOT EXISTS idx_proposals_content_fts ON proposals USING gin(to_tsvector('english', content));

-- 5. Add index for file hash lookups (duplicate detection)
CREATE INDEX IF NOT EXISTS idx_proposals_file_hash ON proposals (file_hash);

-- 6. Add index for tags array searches
CREATE INDEX IF NOT EXISTS idx_proposals_tags_gin ON proposals USING gin(tags);

-- 7. Optimize the match_proposals function for better performance
CREATE OR REPLACE FUNCTION match_proposals_enhanced(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
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
AS \$\$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.metadata,
    p.author,
    p.sector,
    p.proposal_date,
    p.filename,
    p.client,
    p.tags,
    p.created_at,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM proposals p
  WHERE 1 - (p.embedding <=> query_embedding) > match_threshold
    AND (filter_author IS NULL OR LOWER(p.author) = LOWER(filter_author))
    AND (filter_sector IS NULL OR LOWER(p.sector) = LOWER(filter_sector))
    AND (filter_client IS NULL OR LOWER(p.client) = LOWER(filter_client))
    AND (filter_tags IS NULL OR p.tags && filter_tags)
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
\$\$;

-- 8. Create function for text-based search (fallback)
CREATE OR REPLACE FUNCTION search_proposals_text(
  search_terms TEXT[],
  match_count int DEFAULT 10,
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
AS \$\$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.content,
    p.metadata,
    p.author,
    p.sector,
    p.proposal_date,
    p.filename,
    p.client,
    p.tags,
    p.created_at,
    0.5 AS similarity -- Default similarity for text matches
  FROM proposals p
  WHERE (
    -- Use full-text search for better performance
    to_tsvector('english', p.content) @@ plainto_tsquery('english', array_to_string(search_terms, ' '))
    OR 
    -- Fallback to ILIKE for exact matches
    EXISTS (
      SELECT 1 FROM unnest(search_terms) AS term
      WHERE p.content ILIKE '%' || term || '%'
    )
  )
    AND (filter_author IS NULL OR LOWER(p.author) = LOWER(filter_author))
    AND (filter_sector IS NULL OR LOWER(p.sector) = LOWER(filter_sector))
    AND (filter_client IS NULL OR LOWER(p.client) = LOWER(filter_client))
    AND (filter_tags IS NULL OR p.tags && filter_tags)
  ORDER BY 
    -- Prioritize full-text search matches
    CASE WHEN to_tsvector('english', p.content) @@ plainto_tsquery('english', array_to_string(search_terms, ' ')) 
         THEN 1 ELSE 2 END,
    p.created_at DESC
  LIMIT match_count;
END;
\$\$;

-- 9. Add statistics collection for query optimization
CREATE TABLE IF NOT EXISTS search_performance_stats (
  id SERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  search_type VARCHAR(50) NOT NULL, -- 'semantic', 'text', 'hybrid'
  execution_time_ms INTEGER NOT NULL,
  results_count INTEGER NOT NULL,
  similarity_threshold FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create index for performance stats
CREATE INDEX IF NOT EXISTS idx_search_stats_created_at ON search_performance_stats (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_stats_type ON search_performance_stats (search_type);

-- 11. Update table statistics for better query planning
ANALYZE proposals;

-- 12. Create materialized view for frequently accessed client data
CREATE MATERIALIZED VIEW IF NOT EXISTS client_proposal_summary AS
SELECT 
  client,
  COUNT(*) as proposal_count,
  MAX(proposal_date) as latest_proposal,
  MIN(proposal_date) as earliest_proposal,
  array_agg(DISTINCT sector) as sectors,
  array_agg(DISTINCT author) as authors,
  array_agg(DISTINCT unnest(tags)) as all_tags
FROM proposals 
WHERE client IS NOT NULL
GROUP BY client;

-- 13. Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_client_summary_client ON client_proposal_summary (client);

-- 14. Create refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_client_summary()
RETURNS void
LANGUAGE plpgsql
AS \$\$
BEGIN
  REFRESH MATERIALIZED VIEW client_proposal_summary;
END;
\$\$;

-- 15. Performance monitoring queries (for analysis)
-- Query to check index usage:
-- SELECT schemaname, tablename, attname, n_distinct, correlation 
-- FROM pg_stats WHERE tablename = 'proposals';

-- Query to check slow queries:
-- SELECT query, mean_time, calls, total_time 
-- FROM pg_stat_statements 
-- WHERE query LIKE '%proposals%' 
-- ORDER BY mean_time DESC;

COMMIT;
