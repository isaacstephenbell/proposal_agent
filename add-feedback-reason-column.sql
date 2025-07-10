-- Add feedback_reason column to existing discovery_feedback table
-- Run this in your Supabase SQL editor

ALTER TABLE discovery_feedback 
ADD COLUMN feedback_reason text;

-- Add a comment to document the column
COMMENT ON COLUMN discovery_feedback.feedback_reason IS 'Optional text explaining why the user rated the response as good or bad'; 