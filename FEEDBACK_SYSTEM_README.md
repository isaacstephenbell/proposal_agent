# Discovery Chat Feedback System

## Overview
The Discovery Chat now includes a comprehensive feedback loop system that captures user ratings on AI-generated answers to continuously improve the RAG (Retrieval-Augmented Generation) system.

## Features

### ✅ Simple Rating System
- **Good (👍)** or **Bad (👎)** buttons after each AI response
- No confusing "Fine" option - keeps feedback clear and actionable
- One-click feedback submission

### ✅ Comprehensive Data Capture
For each feedback submission, the system captures:
- **Question**: The original user question
- **Answer**: The full AI-generated response
- **Rating**: Good or Bad
- **Chunk IDs**: Which specific chunks were used to generate the answer
- **Query Type**: Consultant query type (methodology, client_examples, etc.)
- **Applied Filters**: What filters/context was applied
- **Session ID**: For tracking anonymous sessions
- **Timestamp**: When the feedback was given

### ✅ Database Schema
```sql
create table discovery_feedback (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  rating text check (rating in ('good', 'bad')) not null,
  chunk_ids jsonb not null,
  query_type text,
  applied_filters jsonb,
  user_id uuid,
  session_id text,
  created_at timestamp with time zone default now()
);
```

## How to Set Up

### 1. Create the Database Table
Run the SQL schema from `discovery-feedback-schema.sql` in your Supabase database.

### 2. System is Ready!
The feedback system is already integrated into:
- **API**: `/api/feedback` endpoint handles submissions
- **Chat UI**: Feedback buttons appear after each AI response
- **Data Flow**: Chunk IDs and query types are automatically captured

## Usage

### For Users
1. Ask any question in Discovery Chat
2. Review the AI response
3. Click 👍 **Good** if the answer was helpful
4. Click 👎 **Bad** if the answer was poor/irrelevant
5. See confirmation that feedback was recorded

### For Analysis
Use the feedback data to identify:

**Problem Chunks:**
```sql
-- Find chunks that appear most often in bad ratings
SELECT 
  jsonb_array_elements_text(chunk_ids) as chunk_id,
  count(*) as bad_count
FROM discovery_feedback 
WHERE rating = 'bad'
GROUP BY chunk_id
ORDER BY bad_count DESC
LIMIT 20;
```

**Query Type Performance:**
```sql
-- Analyze bad ratings by query type
SELECT 
  query_type, 
  count(*) as bad_count,
  count(*) * 100.0 / (SELECT count(*) FROM discovery_feedback WHERE query_type IS NOT NULL) as percentage
FROM discovery_feedback 
WHERE rating = 'bad' AND query_type IS NOT NULL
GROUP BY query_type 
ORDER BY bad_count DESC;
```

**Overall Performance:**
```sql
-- Get feedback summary
SELECT 
  rating,
  count(*) as count,
  count(*) * 100.0 / (SELECT count(*) FROM discovery_feedback) as percentage
FROM discovery_feedback 
GROUP BY rating;
```

## Benefits

### ✅ Continuous Improvement
- **Identify problematic chunks** that consistently lead to bad answers
- **Find query types** that need prompt improvements
- **Track overall system performance** over time

### ✅ Data-Driven Optimization
- **Chunk quality analysis**: Which chunks should be rewritten or removed?
- **Prompt tuning**: Which consultant query types need better prompts?
- **Retrieval improvements**: Are the right chunks being selected?

### ✅ User Experience Insights
- **Response quality tracking**: Is the system getting better over time?
- **Common failure modes**: What types of questions consistently fail?
- **Success patterns**: What works well that we can replicate?

## API Endpoints

### POST /api/feedback
Submit user feedback on a Discovery Chat response.

**Request:**
```json
{
  "question": "What work have we done for MGT?",
  "answer": "Based on our historical proposals...",
  "rating": "good",
  "chunk_ids": ["chunk-123", "chunk-456"],
  "query_type": "client_examples",
  "applied_filters": { "client": "MGT", "contextSource": "explicit" },
  "session_id": "anonymous"
}
```

**Response:**
```json
{
  "success": true,
  "feedback_id": "uuid-here"
}
```

### GET /api/feedback
Retrieve feedback analytics (admin use).

**Query Parameters:**
- `query_type`: Filter by consultant query type
- `rating`: Filter by rating (good/bad)
- `limit`: Number of records to return (default: 50)

## Future Enhancements

### Phase 2 (Optional)
- **Feedback comments**: Allow users to add text explanations
- **Suggested corrections**: Let users propose better answers
- **Automated retraining**: Use feedback to automatically improve embeddings

### Phase 3 (Advanced)
- **Chunk quality scoring**: Automatically flag problematic chunks
- **Query pattern analysis**: Identify and fix systematic issues
- **A/B testing**: Test different prompt strategies based on feedback

## Files Modified
- `src/lib/types.ts` - Added feedback interfaces
- `src/app/api/feedback/route.ts` - Feedback submission endpoint
- `src/app/api/ask/route.ts` - Added chunk IDs and query type to responses
- `src/app/chat/page.tsx` - Added feedback buttons and submission logic
- `src/lib/openai.ts` - Exported query type detection function
- `discovery-feedback-schema.sql` - Database schema

The system is now live and ready to collect valuable feedback data! 🚀 