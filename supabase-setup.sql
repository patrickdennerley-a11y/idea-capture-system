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

-- ====================================
-- FLASHCARD SYSTEM TABLES
-- ====================================

-- Table 1: flashcard_decks - Stores generated flashcard decks per topic
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  cards JSONB NOT NULL, -- Array of card objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject, topic)
);

-- Enable RLS for flashcard_decks
ALTER TABLE flashcard_decks ENABLE ROW LEVEL SECURITY;

-- RLS policies for flashcard_decks
CREATE POLICY "Users can view own flashcard decks"
  ON flashcard_decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcard decks"
  ON flashcard_decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcard decks"
  ON flashcard_decks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flashcard decks"
  ON flashcard_decks FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS flashcard_decks_user_subject_topic_idx 
  ON flashcard_decks(user_id, subject, topic);

-- Table 2: flashcard_progress - Tracks spaced repetition data per card
CREATE TABLE IF NOT EXISTS flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL, -- ID of the card within the deck
  ease_factor REAL DEFAULT 2.5, -- SM-2 algorithm ease factor
  interval_days INTEGER DEFAULT 0, -- Days until next review
  repetitions INTEGER DEFAULT 0, -- Number of successful reviews
  next_review TIMESTAMPTZ DEFAULT NOW(), -- When to show this card next
  last_reviewed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, deck_id, card_id)
);

-- Enable RLS for flashcard_progress
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for flashcard_progress
CREATE POLICY "Users can view own flashcard progress"
  ON flashcard_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flashcard progress"
  ON flashcard_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flashcard progress"
  ON flashcard_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS flashcard_progress_user_deck_idx 
  ON flashcard_progress(user_id, deck_id);

CREATE INDEX IF NOT EXISTS flashcard_progress_next_review_idx 
  ON flashcard_progress(user_id, next_review);

-- Add trigger to update flashcard_decks updated_at timestamp
CREATE TRIGGER update_flashcard_decks_last_modified
  BEFORE UPDATE ON flashcard_decks
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified();
