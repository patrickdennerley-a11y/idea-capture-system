/**
 * ROUTINE GENERATOR COMPONENT
 *
 * Purpose: AI-powered daily routine generator that analyzes all user data
 *          to create an optimized, time-blocked schedule for ADHD productivity.
 *
 * Features:
 * - Analyzes ideas, logs, checklist, reviews
 * - Identifies urgent items and deadlines
 * - Considers energy patterns from activity logs
 * - Generates prioritized time-blocked schedule
 * - Regenerate with one click
 * - Save generated routines for reference
 * - Uses Sonnet 4.5 for quality
 *
 * Data Analysis:
 * - ideas[] - Captured ideas to potentially schedule
 * - logs[] - Energy/motivation patterns for optimal timing
 * - checklist - Current daily routines
 * - reviews[] - End-of-day reflections and accomplishments
 *
 * Output Format:
 * - Time blocks for the day (e.g., "9:00 AM - 10:30 AM")
 * - Task/activity for each block
 * - Priority level (high/medium/low)
 * - Reasoning for timing
 * - Breaks and buffer time
 */

import { useState, FC } from 'react';
import { Sparkles, Calendar, Clock, Zap, RefreshCw, Save, Trash2, AlertCircle, TrendingUp, Eye, X, Lightbulb } from 'lucide-react';
import { generateDailyRoutine } from '../utils/apiService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import CalendarView from './CalendarView';
import SmartRoutines from './SmartRoutines';

// Type definitions
interface Idea {
  classificationType?: string;
  dueDate?: string;
  [key: string]: any;
}

interface Log {
  [key: string]: any;
}

interface ChecklistItem {
  id?: string | number;
  text?: string;
  description?: string;
  completed?: boolean;
  timeOfDay?: string;
  frequency?: string;
  [key: string]: any;
}

interface Checklist {
  items?: ChecklistItem[];
  [key: string]: any;
}

interface Review {
  [key: string]: any;
}

interface ScheduleBlock {
  time: string;
  activity: string;
  priority?: string;
  description?: string;
  reasoning?: string;
  [key: string]: any;
}

interface GeneratedRoutine {
  id?: number | null;
  timestamp?: string;
  date?: string;
  schedule?: ScheduleBlock[];
  summary?: string;
  energyTips?: string[];
  [key: string]: any;
}

interface SavedRoutine extends GeneratedRoutine {
  id: number;
  name: string;
  savedAt: string;
}

interface RoutineGeneratorProps {
  ideas?: Idea[];
  logs?: Log[];
  checklist?: Checklist;
  reviews?: Review[];
  isGeneratingRoutine: boolean;
  setIsGeneratingRoutine: (value: boolean) => void;
  generatedRoutine: GeneratedRoutine | null;
  setGeneratedRoutine: (value: GeneratedRoutine | null) => void;
  routineError: string | null;
  setRoutineError: (value: string | null) => void;
  smartRoutines: any[];
  setSmartRoutines: (value: any[]) => void;
  isGeneratingSmartRoutines: boolean;
  setIsGeneratingSmartRoutines: (value: boolean) => void;
  smartRoutinesError: string | null;
  setSmartRoutinesError: (value: string | null) => void;
  showSmartRoutines: boolean;
  setShowSmartRoutines: (value: boolean) => void;
  smartRoutinesMetadata: any;
  setSmartRoutinesMetadata: (value: any) => void;
  smartRoutineStates: any;
  setSmartRoutineStates: (value: any) => void;
  generationHistory: any[];
  setGenerationHistory: (value: any[]) => void;
}

type ViewType = 'generator' | 'smart-routines' | 'calendar';

const RoutineGenerator: FC<RoutineGeneratorProps> = ({
  ideas = [],
  logs = [],
  checklist,
  reviews = [],
  isGeneratingRoutine,
  setIsGeneratingRoutine,
  generatedRoutine,
  setGeneratedRoutine,
  routineError,
  setRoutineError,
  smartRoutines,
  setSmartRoutines,
  isGeneratingSmartRoutines,
  setIsGeneratingSmartRoutines,
  smartRoutinesError,
  setSmartRoutinesError,
  showSmartRoutines,
  setShowSmartRoutines,
  smartRoutinesMetadata,
  setSmartRoutinesMetadata,
  smartRoutineStates,
  setSmartRoutineStates,
  generationHistory,
  setGenerationHistory
}) => {
  const [currentView, setCurrentView] = useState<ViewType>('generator');
  const [savedRoutines, setSavedRoutines] = useLocalStorage<SavedRoutine[]>('neural-saved-routines', []);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [routineName, setRoutineName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleGenerate = async (): Promise<void> => {
    setIsGeneratingRoutine(true);
    setRoutineError(null);
    setGeneratedRoutine(null);

    try {
      // Filter ideas based on classification and date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const relevantIdeas = ideas.filter((idea: Idea) => {
        const classificationType = idea.classificationType || 'general';

        // ALWAYS include routine-type ideas (recurring patterns)
        if (classificationType === 'routine') return true;

        // Exclude timetable events (handled in timetable tab)
        if (classificationType === 'timetable') return false;

        // For checklist and general items, apply date filtering
        if (!idea.dueDate) return true; // Include if no due date

        const dueDate = new Date(idea.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        // Exclude past-dated checklist items (they're done or missed)
        if (classificationType === 'checklist' && dueDate < today) return false;

        // Include if due today or in the future
        return dueDate >= today;
      });

      const result = await generateDailyRoutine(relevantIdeas, logs, checklist, reviews);

      if (result.success) {
        const routineWithTimestamp: GeneratedRoutine = {
          ...result.data,
          id: null,
          timestamp: new Date().toISOString(),
          date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        };
        setGeneratedRoutine(routineWithTimestamp);
      } else {
        setRoutineError(result.error || 'Failed to generate routine');
      }
    } catch (err) {
      setRoutineError('Unexpected error occurred. Please try again.');
    } finally {
      setIsGeneratingRoutine(false);
    }
  };

  const handleSaveClick = (): void => {
    if (!generatedRoutine) return;
    setRoutineName('');
    setShowSaveDialog(true);
  };

  const handleDeleteBlock = (indexToDelete: number): void => {
    if (!generatedRoutine?.schedule) return;

    const updatedSchedule = generatedRoutine.schedule.filter((_, index) => index !== indexToDelete);
    setGeneratedRoutine({
      ...generatedRoutine,
      schedule: updatedSchedule
    });
  };

  const handleSaveConfirm = (): void => {
    if (!generatedRoutine || !routineName.trim()) {
      alert('Please enter a routine name');
      return;
    }

    const saved: SavedRoutine = {
      id: Date.now(),
      ...generatedRoutine as any,
      name: routineName.trim(),
      savedAt: new Date().toISOString(),
    };

    setSavedRoutines((prev: SavedRoutine[]) => [saved, ...prev]);
    setShowSaveDialog(false);
    setRoutineName('');
    alert('Routine saved! Check History to view.');
  };

  const handleDelete = (id: number): void => {
    if (confirm('Delete this saved routine?')) {
      setSavedRoutines((prev: SavedRoutine[]) => prev.filter(r => r.id !== id));
    }
  };

  const handleLoad = (routine: SavedRoutine): void => {
    const { id, ...routineWithoutId } = routine;
    setGeneratedRoutine(routineWithoutId as GeneratedRoutine);
    setShowHistory(false);
  };

  // Filter routines based on search query
  const filteredRoutines = savedRoutines.filter((routine: SavedRoutine) =>
    routine.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    routine.date?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority?: string): string => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'text-red-400 bg-red-500/20 border-red-500/50';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'low':
        return 'text-green-400 bg-green-500/20 border-green-500/50';
      default:
        return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };

  if (showHistory) {
    return (
      <div className="neural-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="w-6 h-6 text-neural-purple" />
              Saved Routines
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {savedRoutines.length} saved routine{savedRoutines.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="neural-button-secondary"
          >
            Back to Generator
          </button>
        </div>

        {/* Search Bar */}
        {savedRoutines.length > 0 && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search routines by name or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neural-dark border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-neural-purple"
            />
          </div>
        )}

        {savedRoutines.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No saved routines yet</p>
            <p className="text-sm text-gray-600 mt-2">Generate and save routines to see them here</p>
          </div>
        ) : filteredRoutines.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No routines match your search</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRoutines.map((routine: SavedRoutine) => (
              <div
                key={routine.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-neural-purple transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-bold text-lg mb-1 text-neural-purple">{routine.name}</div>
                    <div className="text-sm text-gray-400 mb-1">{routine.date}</div>
                    <div className="text-xs text-gray-500">
                      Saved {new Date(routine.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLoad(routine)}
                      className="neural-button-secondary px-3 py-1 text-sm flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(routine.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {routine.summary && (
                  <p className="text-sm text-gray-400 mb-3 italic">{routine.summary}</p>
                )}

                <div className="text-sm text-gray-500">
                  {routine.schedule?.length || 0} time blocks scheduled
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-neural-purple" />
            AI Daily Routine Generator
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Generate an optimized schedule based on your patterns
          </p>
        </div>
        {savedRoutines.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            History ({savedRoutines.length})
          </button>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setCurrentView('generator')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'generator'
              ? 'text-neural-purple border-neural-purple'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          AI Generator
        </button>
        <button
          onClick={() => setCurrentView('smart-routines')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'smart-routines'
              ? 'text-neural-purple border-neural-purple'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Lightbulb className="w-4 h-4 inline mr-2" />
          Smart Routines
        </button>
        <button
          onClick={() => setCurrentView('calendar')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'calendar'
              ? 'text-neural-purple border-neural-purple'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Calendar
        </button>
      </div>

      {/* Calendar View */}
      {currentView === 'calendar' && <CalendarView routineToLoad={generatedRoutine} />}

      {/* Smart Routines View */}
      {currentView === 'smart-routines' && (
        <SmartRoutines
          ideas={ideas}
          logs={logs}
          timetable={[]}
          routines={checklist?.items || []}
          suggestions={smartRoutines}
          setSuggestions={setSmartRoutines}
          loading={isGeneratingSmartRoutines}
          setLoading={setIsGeneratingSmartRoutines}
          error={smartRoutinesError}
          setError={setSmartRoutinesError}
          showSuggestions={showSmartRoutines}
          setShowSuggestions={setShowSmartRoutines}
          metadata={smartRoutinesMetadata}
          setMetadata={setSmartRoutinesMetadata}
          suggestionStates={smartRoutineStates}
          setSuggestionStates={setSmartRoutineStates}
          generationHistory={generationHistory}
          setGenerationHistory={setGenerationHistory}
          onRoutineAdded={(routine) => {
            // Add routine to checklist items
            if (checklist && checklist.items) {
              const newChecklistItem: ChecklistItem = {
                id: routine.id,
                text: routine.title,
                description: routine.description,
                completed: false,
                timeOfDay: routine.timeOfDay,
                frequency: routine.frequency
              };
              // This would need to be handled by parent component's state management
              console.log('New routine to add:', newChecklistItem);
            }
          }}
        />
      )}

      {/* AI Generator View */}
      {currentView === 'generator' && (
        <>
          {/* Data Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Captured Ideas</div>
          <div className="text-2xl font-bold text-yellow-400">{ideas?.length || 0}</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Activity Logs</div>
          <div className="text-2xl font-bold text-blue-400">{logs?.length || 0}</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Daily Routines</div>
          <div className="text-2xl font-bold text-purple-400">{checklist?.items?.length || 0}</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-xs text-gray-500 mb-1">Reviews</div>
          <div className="text-2xl font-bold text-pink-400">{reviews?.length || 0}</div>
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGeneratingRoutine}
        className="neural-button w-full mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGeneratingRoutine ? (
          <>
            <RefreshCw className="w-5 h-5 inline mr-2 animate-spin" />
            Analyzing Your Data & Generating Routine...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 inline mr-2" />
            Generate Daily Routine
          </>
        )}
      </button>

      {/* Error Display */}
      {routineError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm font-medium">Error</p>
              <p className="text-red-300 text-sm mt-1">{routineError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Routine Display */}
      {generatedRoutine && (
        <div className="animate-slide-in space-y-6">
          {/* Header with Save */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Today's Optimized Routine</h3>
            <button
              onClick={handleSaveClick}
              className="neural-button-secondary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Routine
            </button>
          </div>

          {/* Summary */}
          {generatedRoutine.summary && (
            <div className="bg-neural-darker border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-neural-purple" />
                <span className="font-bold text-neural-purple">Overview</span>
              </div>
              <p className="text-gray-300">{generatedRoutine.summary}</p>
            </div>
          )}

          {/* Time-Blocked Schedule */}
          {generatedRoutine.schedule && generatedRoutine.schedule.length > 0 && (
            <div>
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-neural-blue" />
                Time-Blocked Schedule
              </h4>
              <div className="space-y-3">
                {generatedRoutine.schedule.map((block: ScheduleBlock, index: number) => (
                  <div
                    key={index}
                    className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-neural-purple transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-neural-blue flex-shrink-0" />
                        <span className="font-bold text-neural-blue">{block.time}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {block.priority && (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(block.priority)}`}>
                            {block.priority.toUpperCase()}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteBlock(index)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Delete this time block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <h5 className="font-bold text-lg mb-2">{block.activity}</h5>
                    {block.description && (
                      <p className="text-sm text-gray-400 mb-2">{block.description}</p>
                    )}
                    {block.reasoning && (
                      <p className="text-xs text-gray-500 italic">💡 {block.reasoning}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Energy Optimization Tips */}
          {generatedRoutine.energyTips && generatedRoutine.energyTips.length > 0 && (
            <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="font-bold text-yellow-400">Energy Optimization Tips</span>
              </div>
              <ul className="space-y-2">
                {generatedRoutine.energyTips.map((tip: string, index: number) => (
                  <li key={index} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-neural-purple">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Regenerate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGeneratingRoutine}
            className="neural-button-secondary w-full"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Regenerate Routine
          </button>
        </div>
      )}

      {/* Help Text */}
      {!generatedRoutine && !isGeneratingRoutine && (
        <div className="bg-neural-darker/50 border border-gray-800 rounded-lg p-6">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neural-purple" />
            How This Works
          </h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Analyzes your captured ideas to identify what needs to be scheduled</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Reviews your activity logs to understand energy and motivation patterns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Considers your existing daily routines and integrates them</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Learns from your end-of-day reviews about what works and what doesn't</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Generates a time-blocked schedule optimized for your ADHD brain</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Includes breaks, buffer time, and realistic expectations</span>
            </li>
          </ul>
        </div>
      )}
        </>
      )}

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Save Routine</h3>
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              handleSaveConfirm();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Routine Name *
                  </label>
                  <input
                    type="text"
                    value={routineName}
                    onChange={(e) => setRoutineName(e.target.value)}
                    className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                    placeholder="e.g., Morning Study Session, Exam Prep Day"
                    autoFocus
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="neural-button flex-1 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveDialog(false)}
                    className="neural-button-secondary px-4"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutineGenerator;
