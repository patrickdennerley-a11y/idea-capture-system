-- ====================================
-- NEURAL CAPTURE - IDEAS TABLE SETUP
-- ====================================
-- This script creates the ideas table and Row Level Security policies
-- Run this in your Supabase SQL Editor

-- Create ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  context TEXT,
  due_date DATE,
  classification_type TEXT DEFAULT 'general',
  duration INTEGER,
  recurrence TEXT DEFAULT 'none',
  time_of_day TEXT,
  priority TEXT DEFAULT 'medium',
  auto_classified BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_modified TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only SELECT their own ideas
CREATE POLICY "Users can view their own ideas"
  ON ideas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy 2: Users can only INSERT their own ideas
CREATE POLICY "Users can create their own ideas"
  ON ideas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can only UPDATE their own ideas
CREATE POLICY "Users can update their own ideas"
  ON ideas
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy 4: Users can only DELETE their own ideas
CREATE POLICY "Users can delete their own ideas"
  ON ideas
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS ideas_user_id_created_at_idx 
  ON ideas(user_id, created_at DESC);

-- Add a trigger to automatically update last_modified timestamp
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ideas_last_modified
  BEFORE UPDATE ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified();

-- Verify table was created successfully
SELECT 
  tablename, 
  schemaname,
  tableowner
FROM pg_tables 
WHERE tablename = 'ideas';

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'ideas';
