-- Neural Capture - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension (usually enabled by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- IDEAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context TEXT,
  classification_type TEXT,
  duration INTEGER,
  recurrence TEXT,
  time_of_day TEXT,
  priority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS ideas_user_id_idx ON ideas(user_id);
CREATE INDEX IF NOT EXISTS ideas_timestamp_idx ON ideas(timestamp DESC);
CREATE INDEX IF NOT EXISTS ideas_tags_idx ON ideas USING GIN(tags);

-- ============================================
-- LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activity TEXT NOT NULL,
  duration INTEGER,
  energy INTEGER,
  motivation INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS logs_user_id_idx ON logs(user_id);
CREATE INDEX IF NOT EXISTS logs_timestamp_idx ON logs(timestamp DESC);

-- ============================================
-- CHECKLIST ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  important BOOLEAN DEFAULT FALSE,
  streak_count INTEGER DEFAULT 0,
  last_completed TIMESTAMPTZ,
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS checklist_user_id_idx ON checklist_items(user_id);
CREATE INDEX IF NOT EXISTS checklist_completed_idx ON checklist_items(completed);

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  achievements TEXT,
  challenges TEXT,
  gratitude TEXT,
  tomorrow_plan TEXT,
  energy_level INTEGER,
  mood INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON reviews(user_id);
CREATE INDEX IF NOT EXISTS reviews_date_idx ON reviews(date DESC);

-- ============================================
-- ROUTINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS routines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  time_of_day TEXT,
  duration INTEGER,
  frequency TEXT,
  tasks JSONB DEFAULT '[]',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS routines_user_id_idx ON routines(user_id);
CREATE INDEX IF NOT EXISTS routines_active_idx ON routines(active);

-- ============================================
-- REMINDER HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reminder_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reminder_type TEXT NOT NULL,
  content TEXT,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS reminder_history_user_id_idx ON reminder_history(user_id);
CREATE INDEX IF NOT EXISTS reminder_history_triggered_idx ON reminder_history(triggered_at DESC);

-- ============================================
-- TIMETABLE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  description TEXT,
  category TEXT,
  recurrence TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS timetable_user_id_idx ON timetable(user_id);
CREATE INDEX IF NOT EXISTS timetable_start_time_idx ON timetable(start_time);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;

-- Ideas policies
CREATE POLICY "Users can view their own ideas"
  ON ideas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ideas"
  ON ideas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ideas"
  ON ideas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ideas"
  ON ideas FOR DELETE
  USING (auth.uid() = user_id);

-- Logs policies
CREATE POLICY "Users can view their own logs"
  ON logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
  ON logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON logs FOR DELETE
  USING (auth.uid() = user_id);

-- Checklist items policies
CREATE POLICY "Users can view their own checklist items"
  ON checklist_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own checklist items"
  ON checklist_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklist items"
  ON checklist_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checklist items"
  ON checklist_items FOR DELETE
  USING (auth.uid() = user_id);

-- Reviews policies
CREATE POLICY "Users can view their own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Routines policies
CREATE POLICY "Users can view their own routines"
  ON routines FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routines"
  ON routines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routines"
  ON routines FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routines"
  ON routines FOR DELETE
  USING (auth.uid() = user_id);

-- Reminder history policies
CREATE POLICY "Users can view their own reminder history"
  ON reminder_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminder history"
  ON reminder_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminder history"
  ON reminder_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminder history"
  ON reminder_history FOR DELETE
  USING (auth.uid() = user_id);

-- Timetable policies
CREATE POLICY "Users can view their own timetable"
  ON timetable FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own timetable"
  ON timetable FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timetable"
  ON timetable FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own timetable"
  ON timetable FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- AUTOMATIC UPDATED_AT TRIGGER
-- ============================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables
CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_logs_updated_at BEFORE UPDATE ON logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON routines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminder_history_updated_at BEFORE UPDATE ON reminder_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetable_updated_at BEFORE UPDATE ON timetable
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for all tables (run in Supabase dashboard if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE ideas;
-- ALTER PUBLICATION supabase_realtime ADD TABLE logs;
-- ALTER PUBLICATION supabase_realtime ADD TABLE checklist_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
-- ALTER PUBLICATION supabase_realtime ADD TABLE routines;
-- ALTER PUBLICATION supabase_realtime ADD TABLE reminder_history;
-- ALTER PUBLICATION supabase_realtime ADD TABLE timetable;
