// ============================================================================
// Centralized Type Definitions for Neural Capture System
// ============================================================================

// ============================================================================
// Idea and Classification Types
// ============================================================================

export type ClassificationType = 'general' | 'routine' | 'checklist' | 'timetable';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
export type TimeOfDayType = 'morning' | 'afternoon' | 'evening' | 'night' | null;
export type PriorityType = 'low' | 'medium' | 'high';
export type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Unified Idea interface used throughout the application
 * Note: 'content' is the primary field, 'text' is an alias for API compatibility
 */
export interface Idea {
  id: string;
  content: string;
  text?: string; // Alias for content (API compatibility)
  timestamp?: string;
  tags: string[];
  context?: string;
  dueDate?: string;
  classificationType?: ClassificationType;
  duration?: number | null;
  recurrence?: RecurrenceType;
  timeOfDay?: TimeOfDayType;
  priority?: PriorityType;
  autoClassified?: boolean;
  lastModified?: string;
  classification?: string; // Legacy field
  isDraft?: boolean; // For draft ideas
}

// ============================================================================
// Activity Logging Types
// ============================================================================

export interface ActivityLog {
  id: string;
  subject: string;
  classification?: {
    domain: string;
    field: string;
    topic: string;
  };
  startTime: string;
  endTime: string;
  duration: number;
  energy: number;
  motivation: number;
  focus?: number;
  notes?: string;
}

// ============================================================================
// Checklist Types
// ============================================================================

export interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  completedAt?: string;
}

export interface Checklist {
  date: string;
  items: ChecklistItem[];
}

// ============================================================================
// Review and Planning Types
// ============================================================================

export interface EndOfDayReview {
  date: string;
  energyLevel: number;
  accomplishments: string;
  challenges: string;
  gratitude: string;
  improvements: string;
}

export interface PlanData {
  activity?: string;
  bestTime?: string;
  duration?: string;
  location?: string;
  preparation?: string[];
  tips?: string[];
}

// ============================================================================
// Routine Types
// ============================================================================

export interface ScheduleBlock {
  time: string;
  activity: string;
  duration: number;
  priority?: PriorityType;
  notes?: string;
}

export interface GeneratedRoutine {
  id: string;
  date: string;
  blocks: ScheduleBlock[];
  summary?: string;
  suggestions?: string[];
}

export interface RoutineSuggestion {
  activity: string;
  bestTime: string;
  duration: number;
  reasoning: string;
  priority: PriorityType;
}

export interface SuggestionMetadata {
  generatedAt: string;
  basedOn: {
    ideas: number;
    logs: number;
    reviews: number;
  };
}

export interface GenerationHistory {
  smartRoutines: RoutineSuggestion[][];
}

// ============================================================================
// Noise and Audio Types
// ============================================================================

export interface NoiseSession {
  id: string;
  type: string;
  startTime: string;
  duration?: number;
  volume: number;
}

// ============================================================================
// Theme and Customization Types
// ============================================================================

export interface IconTheme {
  icon: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

// ============================================================================
// Calendar Types
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Classification Result Types
// ============================================================================

export interface ClassificationResult {
  classificationType?: ClassificationType;
  duration?: number;
  recurrence?: RecurrenceType;
  timeOfDay?: TimeOfDayType;
  priority?: PriorityType;
}

// ============================================================================
// Reminder Types
// ============================================================================

export interface Reminder {
  id: string;
  activity: string;
  time: string;
  enabled: boolean;
  recurring?: boolean;
  days?: string[];
}
