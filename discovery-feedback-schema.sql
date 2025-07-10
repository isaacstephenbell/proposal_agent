-- Discovery Chat Feedback System Schema
-- This table captures user feedback on AI-generated answers to improve the RAG system

create table discovery_feedback (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  rating text check (rating in ('good', 'bad')) not null,
  feedback_reason text, -- why was it good/bad? (optional)
  chunk_ids jsonb not null,
  query_type text, -- consultant query type (methodology, client_examples, etc.)
  applied_filters jsonb, -- captures what filters were applied
  user_id uuid, -- optional; for session tracking
  session_id text, -- optional; for anonymous session tracking
  created_at timestamp with time zone default now()
);

-- Index for efficient queries
create index idx_discovery_feedback_rating on discovery_feedback(rating);
create index idx_discovery_feedback_query_type on discovery_feedback(query_type);
create index idx_discovery_feedback_created_at on discovery_feedback(created_at);
create index idx_discovery_feedback_chunk_ids on discovery_feedback using gin(chunk_ids);

-- Enable RLS (Row Level Security) for future user-specific access
alter table discovery_feedback enable row level security;

-- Example queries for analysis:

-- Find all feedback for a specific chunk
-- select * from discovery_feedback where chunk_ids @> '["chunk-123"]'::jsonb;

-- Analyze bad ratings by query type
-- select query_type, count(*) as bad_count 
-- from discovery_feedback 
-- where rating = 'bad' 
-- group by query_type 
-- order by bad_count desc;

-- Find chunks that appear most often in bad ratings
-- select 
--   jsonb_array_elements_text(chunk_ids) as chunk_id,
--   count(*) as bad_count
-- from discovery_feedback 
-- where rating = 'bad'
-- group by chunk_id
-- order by bad_count desc
-- limit 20; 