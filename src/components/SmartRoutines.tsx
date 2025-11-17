/**
 * SMART ROUTINES COMPONENT
 *
 * Purpose: Generate personalized routine suggestions by analyzing captured ideas,
 *          logs, and patterns. Provides 5 suggestions per generation with both
 *          direct ideas (user-written) and AI mashups.
 *
 * Features:
 * - Generates 5 routine suggestions (2-3 direct, 2-3 mashups)
 * - Visual differentiation between user ideas and AI syntheses
 * - Three action buttons: Confirm & Add, Skip, Discard
 * - Fast generation using Haiku 3.5 (<2s)
 * - Confirmation dialog for permanent deletion
 *
 * Actions:
 * - Confirm & Add: Adds to user's active routines immediately
 * - Skip: Hides temporarily, can reappear in future generations
 * - Discard: Permanently removes from this generation (with confirmation)
 */

import { useState, useEffect } from 'react';
import { Sparkles, Check, X, SkipForward, Clock, Calendar, Lightbulb, Loader, AlertCircle, History, Save, Trash2 } from 'lucide-react';

// Types
interface Idea {
  id: number;
  content: string;
  [key: string]: any;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  [key: string]: any;
}

interface TimetableEvent {
  id: number;
  [key: string]: any;
}

interface RoutineItem {
  id: number;
  text?: string;
  title?: string;
  [key: string]: any;
}

interface SmartRoutine {
  id: string;
  title: string;
  description: string;
  timeOfDay: string;
  frequency: string;
  duration?: string;
  type: 'direct' | 'mashup';
  sources?: string[];
  reasoning?: string;
}

interface SmartRoutinesMetadata {
  directCount: number;
  mashupCount: number;
}

interface HistoryEntry {
  id: number;
  timestamp: string;
  suggestions: SmartRoutine[];
  metadata: SmartRoutinesMetadata;
  states: Record<string, string>;
}

interface GenerationHistory {
  smartRoutines?: HistoryEntry[];
  [key: string]: any;
}

interface SmartRoutinesProps {
  ideas: Idea[];
  logs: ActivityLog[];
  timetable: TimetableEvent[];
  routines: RoutineItem[];
  suggestions: SmartRoutine[];
  setSuggestions: React.Dispatch<React.SetStateAction<SmartRoutine[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  showSuggestions: boolean;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  metadata: SmartRoutinesMetadata | null;
  setMetadata: React.Dispatch<React.SetStateAction<SmartRoutinesMetadata | null>>;
  suggestionStates: Record<string, string>;
  setSuggestionStates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  generationHistory: GenerationHistory;
  setGenerationHistory: React.Dispatch<React.SetStateAction<GenerationHistory>>;
  onRoutineAdded: (routine: any) => void;
}

const SmartRoutines: React.FC<SmartRoutinesProps> = ({
  ideas,
  logs,
  timetable,
  routines,
  suggestions,
  setSuggestions,
  loading,
  setLoading,
  error,
  setError,
  showSuggestions,
  setShowSuggestions,
  metadata,
  setMetadata,
  suggestionStates,
  setSuggestionStates,
  generationHistory,
  setGenerationHistory,
  onRoutineAdded
}) => {
  const [discardConfirm, setDiscardConfirm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Auto-show suggestions when results are ready (handles tab switch during generation)
  useEffect(() => {
    if (suggestions.length > 0 && !showSuggestions) {
      console.log('🔍 Auto-showing smart routines (results ready after tab switch)');
      setShowSuggestions(true);
    }
  }, [suggestions, showSuggestions, setShowSuggestions]);

  const fetchSmartRoutines = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/generate-smart-routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideas,
          logs,
          timetable,
          existingRoutines: routines
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate smart routines');
      }

      const data = await response.json();
      setSuggestions(data.routines);
      setMetadata(data.metadata);
      setShowSuggestions(true);

      // Initialize all suggestions as pending
      const initialStates: Record<string, string> = {};
      data.routines.forEach((routine: SmartRoutine) => {
        initialStates[routine.id] = 'pending';
      });
      setSuggestionStates(initialStates);

    } catch (err) {
      console.error('Error fetching smart routines:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirmRoutine = (routine: SmartRoutine): void => {
    // Mark as confirmed
    setSuggestionStates(prev => ({
      ...prev,
      [routine.id]: 'confirmed'
    }));

    // Add to user's routines
    onRoutineAdded({
      id: Date.now(),
      title: routine.title,
      description: routine.description,
      timeOfDay: routine.timeOfDay,
      frequency: routine.frequency,
      duration: routine.duration,
      type: 'routine',
      timestamp: new Date().toISOString(),
      source: routine.type === 'direct' ? 'user-idea' : 'ai-mashup'
    });

    // Remove from visible suggestions after animation
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== routine.id));
    }, 500);
  };

  const skipRoutine = (routineId: string): void => {
    setSuggestionStates(prev => ({
      ...prev,
      [routineId]: 'skipped'
    }));

    // Remove from view
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== routineId));
    }, 300);
  };

  const requestDiscard = (routineId: string): void => {
    setDiscardConfirm(routineId);
  };

  const confirmDiscard = (): void => {
    const routineId = discardConfirm;
    if (!routineId) return;

    setSuggestionStates(prev => ({
      ...prev,
      [routineId]: 'discarded'
    }));

    // Remove from view
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== routineId));
    }, 300);

    setDiscardConfirm(null);
  };

  const cancelDiscard = (): void => {
    setDiscardConfirm(null);
  };

  const handleCloseSuggestions = (): void => {
    setShowSuggestions(false);
    // Clear suggestions so they don't auto-show when returning to tab
    setSuggestions([]);
    setSuggestionStates({});
    setMetadata(null);
  };

  const handleDismissAll = (): void => {
    // Mark all as discarded
    const allDiscarded: Record<string, string> = {};
    suggestions.forEach(s => {
      allDiscarded[s.id] = 'discarded';
    });
    setSuggestionStates(allDiscarded);

    // Close and clear
    setTimeout(() => {
      handleCloseSuggestions();
    }, 300);
  };

  const handleSaveToHistory = (): void => {
    const historyEntry: HistoryEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      suggestions: suggestions,
      metadata: metadata!,
      states: suggestionStates
    };

    // Add to smart routines history
    setGenerationHistory(prev => ({
      ...prev,
      smartRoutines: [historyEntry, ...(prev.smartRoutines || [])]
    }));

    // Close suggestions panel
    handleCloseSuggestions();
  };

  const viewHistoryEntry = (entry: HistoryEntry): void => {
    setSuggestions(entry.suggestions);
    setMetadata(entry.metadata);
    setSuggestionStates(entry.states);
    setShowSuggestions(true);
    setShowHistory(false);
  };

  const deleteHistoryEntry = (entryId: number): void => {
    setGenerationHistory(prev => ({
      ...prev,
      smartRoutines: (prev.smartRoutines || []).filter(e => e.id !== entryId)
    }));
  };

  const getTypeStyles = (type: 'direct' | 'mashup') => {
    if (type === 'direct') {
      return {
        badge: '📝 FROM YOUR IDEAS',
        bg: 'bg-blue-950/30',
        border: 'border-blue-800',
        badgeBg: 'bg-blue-950',
        badgeText: 'text-blue-300',
        badgeBorder: 'border-blue-700'
      };
    } else {
      return {
        badge: '🤖 AI MASHUP',
        bg: 'bg-purple-950/30',
        border: 'border-purple-800',
        badgeBg: 'bg-purple-950',
        badgeText: 'text-purple-300',
        badgeBorder: 'border-purple-700'
      };
    }
  };

  const getTimeIcon = (timeOfDay: string): string => {
    switch (timeOfDay) {
      case 'morning': return '🌅';
      case 'afternoon': return '☀️';
      case 'evening': return '🌙';
      default: return '⏰';
    }
  };

  const visibleSuggestions = suggestions.filter(s => suggestionStates[s.id] === 'pending');

  return (
    <div className="space-y-4">
      {/* Generate Button & History */}
      <div className="flex items-center gap-3">
        <button
          onClick={fetchSmartRoutines}
          disabled={loading || ideas.length === 0}
          className={`neural-button flex items-center gap-2 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Sparkles className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Generating...' : 'Generate Smart Routines'}
        </button>

        {(generationHistory?.smartRoutines?.length || 0) > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History ({generationHistory.smartRoutines!.length})
          </button>
        )}

        {metadata && (
          <div className="ml-auto text-sm text-gray-400">
            Generated: {metadata.directCount} direct, {metadata.mashupCount} mashups
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="neural-card bg-red-950 border-red-800 text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Error: {error}</span>
          </div>
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && visibleSuggestions.length > 0 && (
        <div className="neural-card space-y-4 animate-slide-in">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3 -mt-2 -mx-2 px-2">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neural-purple" />
              Smart Routine Suggestions
            </h3>
            <button
              onClick={handleCloseSuggestions}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveToHistory}
              className="neural-button-secondary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save to History
            </button>
            <button
              onClick={handleDismissAll}
              className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 px-3 py-2"
            >
              <Trash2 className="w-4 h-4" />
              Dismiss All
            </button>
          </div>

          <div className="bg-neural-darker rounded-lg border border-gray-800 p-3 text-sm text-gray-300">
            <p>Review each suggestion and choose:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-gray-400">
              <li><strong className="text-green-400">Confirm & Add</strong> - Add to your routines</li>
              <li><strong className="text-gray-400">Skip</strong> - Hide for now</li>
              <li><strong className="text-red-400">Discard</strong> - Remove permanently</li>
            </ul>
          </div>

          {/* Suggestions List */}
          <div className="space-y-3">
            {visibleSuggestions.map((routine) => {
              const styles = getTypeStyles(routine.type);
              const state = suggestionStates[routine.id];

              return (
                <div
                  key={routine.id}
                  className={`p-4 rounded-lg border transition-all ${styles.bg} ${styles.border} ${
                    state === 'confirmed' ? 'border-green-500 bg-green-950/30 scale-95 opacity-50' :
                    state === 'skipped' || state === 'discarded' ? 'scale-95 opacity-0' : ''
                  }`}
                >
                  {/* Badge */}
                  <div className="mb-3">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${styles.badgeBg} ${styles.badgeText} border ${styles.badgeBorder}`}>
                      {styles.badge}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold text-gray-100">{routine.title}</h4>
                    <p className="text-sm text-gray-300">{routine.description}</p>

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <span>{getTimeIcon(routine.timeOfDay)}</span>
                        <span className="capitalize">{routine.timeOfDay}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span className="capitalize">{routine.frequency}</span>
                      </div>
                      {routine.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{routine.duration}</span>
                        </div>
                      )}
                    </div>

                    {/* Sources */}
                    {routine.sources && routine.sources.length > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Based on: </span>
                        {routine.sources.join(', ')}
                      </div>
                    )}

                    {/* Reasoning */}
                    {routine.reasoning && (
                      <div className="text-xs text-gray-400 italic border-l-2 border-gray-700 pl-2">
                        {routine.reasoning}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => confirmRoutine(routine)}
                      disabled={state !== 'pending'}
                      className="flex-1 neural-button bg-green-600 hover:bg-green-700 border-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm py-2"
                    >
                      <Check className="w-4 h-4" />
                      Confirm & Add
                    </button>
                    <button
                      onClick={() => skipRoutine(routine.id)}
                      disabled={state !== 'pending'}
                      className="neural-button-secondary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <SkipForward className="w-4 h-4" />
                      Skip
                    </button>
                    <button
                      onClick={() => requestDiscard(routine.id)}
                      disabled={state !== 'pending'}
                      className="neural-button-secondary hover:bg-red-900 hover:border-red-700 flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4" />
                      Discard
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
            Routines adapt to your captured ideas and activity patterns. Add ones that fit your lifestyle.
          </div>
        </div>
      )}

      {/* No Suggestions Message */}
      {showSuggestions && visibleSuggestions.length === 0 && (
        <div className="neural-card text-center text-gray-400 py-8 animate-slide-in">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">All suggestions reviewed!</p>
          <p className="text-sm">Generate more to see new routine ideas.</p>
          <button
            onClick={fetchSmartRoutines}
            className="neural-button mt-4"
          >
            Generate More Routines
          </button>
        </div>
      )}

      {/* Discard Confirmation Dialog */}
      {discardConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neural-dark border border-red-600 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Discard this routine?
            </h3>
            <p className="text-gray-300 text-sm mb-2">
              {suggestions.find(s => s.id === discardConfirm)?.title}
            </p>
            <p className="text-gray-400 text-xs mb-6">
              This action cannot be undone. The routine will be permanently removed from this generation.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDiscard}
                className="flex-1 neural-button-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDiscard}
                className="flex-1 neural-button bg-red-600 hover:bg-red-700 border-red-700"
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neural-dark border border-neural-purple rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neural-dark border-b border-gray-800 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-neural-purple" />
                <h2 className="text-2xl font-bold">Smart Routines History</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {(generationHistory?.smartRoutines?.length || 0) > 0 ? (
                generationHistory.smartRoutines!.map((entry) => {
                  const date = new Date(entry.timestamp);
                  const confirmedCount = Object.values(entry.states || {}).filter(s => s === 'confirmed').length;
                  const discardedCount = Object.values(entry.states || {}).filter(s => s === 'discarded').length;

                  return (
                    <div
                      key={entry.id}
                      className="bg-neural-darker border border-gray-800 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-sm text-gray-400">
                            {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.suggestions?.length || 0} suggestions |
                            {confirmedCount > 0 && ` ${confirmedCount} accepted`}
                            {discardedCount > 0 && ` | ${discardedCount} discarded`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => viewHistoryEntry(entry)}
                            className="neural-button-secondary px-3 py-1 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => deleteHistoryEntry(entry.id)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {entry.metadata && (
                        <div className="text-xs text-gray-500">
                          {entry.metadata.directCount} direct, {entry.metadata.mashupCount} AI mashups
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No history yet. Generate smart routines to save them here!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartRoutines;
