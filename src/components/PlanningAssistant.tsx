/**
 * PLANNING ASSISTANT COMPONENT
 *
 * Purpose: Pre-action planning with AI-powered recommendations using Claude Sonnet 4.5.
 *          Analyzes user's captured ideas, activity logs, routines, and reviews
 *          to provide personalized guidance on WHEN, HOW LONG, WHERE, and HOW to do activities.
 *
 * Key Features:
 * - AI analysis using Sonnet 4.5 (quality over cost per user request)
 * - Personalized timing based on energy patterns
 * - ADHD-friendly duration recommendations
 * - Location and environment suggestions
 * - Recurring vs one-time activity guidance
 * - Actionable tips for success
 *
 * Input Data:
 * - ideas[] - Recent 20 captured ideas
 * - logs[] - Recent 20 activity logs with energy/motivation
 * - checklist - Current daily routines
 * - reviews[] - Latest end-of-day review
 *
 * AI Response Format:
 * - summary - What activity is and why it matters
 * - bestTime - Optimal timing based on energy patterns
 * - duration - Recommended time allocation
 * - location - Suggested environment
 * - recurring - Frequency recommendation
 * - tips[] - Array of actionable advice
 *
 * Key Functions:
 * - handlePlan() (11-37) - Calls API with all user data
 *
 * UI Sections:
 * - Input form (62-97) - Activity input with Enter key support
 * - Plan display (106-205) - Recommendation cards
 * - Help text (208-238) - How it works explanation
 *
 * Important Notes:
 * - Uses Sonnet 4.5 NOT Haiku (per user request for quality)
 * - Bullet points have NO mt-1 for proper alignment
 * - Backend endpoint: POST /api/plan-activity in server.cjs
 */

import React, { useState } from 'react';
import { Compass, Sparkles, Clock, MapPin, Repeat, Zap, Lightbulb, X, History, Trash2, Save, BookmarkPlus } from 'lucide-react';
import { getPlanningAdvice } from '@/utils/apiService';
import type { ActivityLog, Checklist, EndOfDayReview, Idea as ApiIdea } from '@/utils/apiService';
import type { Idea } from './IdeaEditModal';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { formatDateTime } from '@/utils/dateUtils';
import SmartReminders from './SmartReminders';

// Type definitions
interface PlanData {
  summary?: string;
  bestTime?: string;
  duration?: string;
  location?: string;
  recurring?: string;
  tips?: string[];
  activity?: string;
  timestamp?: string;
  id?: number;
  name?: string;
  savedAt?: string;
}

interface PlanningAssistantProps {
  ideas: Idea[];
  logs: ActivityLog[];
  checklist: Checklist;
  reviews: EndOfDayReview[];
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  plan: PlanData | null;
  setPlan: React.Dispatch<React.SetStateAction<PlanData | null>>;
  planError: string | null;
  setPlanError: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function PlanningAssistant({
  ideas,
  logs,
  checklist,
  reviews,
  isAnalyzing,
  setIsAnalyzing,
  plan,
  setPlan,
  planError,
  setPlanError,
}: PlanningAssistantProps): JSX.Element {
  const [activity, setActivity] = useState('');
  const [planHistory, setPlanHistory] = useLocalStorage<PlanData[]>('neural-plan-history', []);
  const [showHistory, setShowHistory] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [planName, setPlanName] = useState('');

  const handlePlan = async (): Promise<void> => {
    if (!activity.trim()) return;

    setIsAnalyzing(true);
    setPlanError(null);
    setPlan(null);

    const currentActivity = activity.trim();

    try {
      // Filter ideas based on classification and date
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const relevantIdeas = ideas.filter(idea => {
        const classificationType = idea.classificationType || 'general';

        // Include all routine items (always relevant for planning)
        if (classificationType === 'routine') return true;

        // Include timetable events (relevant for planning around them)
        if (classificationType === 'timetable') {
          if (!idea.dueDate) return true;
          const dueDate = new Date(idea.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate >= today; // Only future/today timetable events
        }

        // For checklist and general items, apply date filtering
        if (!idea.dueDate) return true; // Include if no due date

        const dueDate = new Date(idea.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        // Exclude past-dated items (already done or missed)
        if (dueDate < today) return false;

        // Include if due today or in the future
        return dueDate >= today;
      });

      // Transform ideas to API format
      const apiIdeas: ApiIdea[] = relevantIdeas.map(idea => ({
        id: idea.id,
        text: idea.content,
        timestamp: idea.lastModified || new Date().toISOString(),
        classification: idea.classificationType,
        tags: idea.tags,
        priority: idea.priority,
        recurrence: idea.recurrence,
        timeOfDay: idea.timeOfDay === null ? undefined : idea.timeOfDay,
      }));

      const result = await getPlanningAdvice(
        currentActivity,
        apiIdeas,
        logs,
        checklist,
        reviews
      );

      if (result.success) {
        const planWithMetadata: PlanData = {
          ...result.data,
          activity: currentActivity,
          timestamp: new Date().toISOString(),
          id: Date.now(),
        };

        setPlan(planWithMetadata);

        // Auto-save to history without dialog
        setPlanHistory(prev => [planWithMetadata, ...prev].slice(0, 50)); // Keep last 50
      } else {
        setPlanError(result.error || 'Failed to generate plan');
      }
    } catch (err) {
      setPlanError('Unexpected error occurred. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSavePlanWithName = (): void => {
    if (!plan || !planName.trim()) {
      alert('Please enter a name for this plan');
      return;
    }

    const namedPlan: PlanData = {
      ...plan,
      name: planName.trim(),
      savedAt: new Date().toISOString(),
    };

    // Update in history (replace the auto-saved one or add new)
    setPlanHistory(prev => {
      const existingIndex = prev.findIndex(p => p.id === plan.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = namedPlan;
        return updated;
      }
      return [namedPlan, ...prev].slice(0, 50);
    });

    setShowSaveDialog(false);
    setPlanName('');
    alert('Plan named and saved!');
  };

  const deletePlanFromHistory = (id: number): void => {
    if (confirm('Delete this plan from history?')) {
      setPlanHistory(prev => prev.filter(p => p.id !== id));
    }
  };

  const loadPlanFromHistory = (historicalPlan: PlanData): void => {
    setPlan(historicalPlan);
    setActivity(historicalPlan.activity || '');
    setShowHistory(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePlan();
    }
  };

  // Show history view if active
  if (showHistory) {
    return (
      <div className="neural-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-neural-purple" />
              Planning History
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {planHistory.length} saved plan{planHistory.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="neural-button-secondary"
          >
            Back to Planner
          </button>
        </div>

        {planHistory.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No planning history yet</p>
            <p className="text-sm text-gray-600 mt-2">Generate plans to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {planHistory.map((historicalPlan) => (
              <div
                key={historicalPlan.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-neural-purple transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="font-bold text-lg mb-1 text-neural-purple flex items-center gap-2">
                      {historicalPlan.name && <BookmarkPlus className="w-5 h-5" />}
                      {historicalPlan.name || historicalPlan.activity}
                    </div>
                    {historicalPlan.name && (
                      <div className="text-sm text-gray-400 mb-1">
                        Activity: {historicalPlan.activity}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatDateTime(historicalPlan.savedAt || historicalPlan.timestamp || '')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadPlanFromHistory(historicalPlan)}
                      className="neural-button-secondary px-3 py-1 text-sm"
                    >
                      View
                    </button>
                    <button
                      onClick={() => historicalPlan.id && deletePlanFromHistory(historicalPlan.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {historicalPlan.summary && (
                  <p className="text-sm text-gray-400 line-clamp-2 italic">
                    {historicalPlan.summary}
                  </p>
                )}
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
            <Compass className="w-6 h-6 text-neural-purple" />
            Pre-Action Planner
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Get AI-powered recommendations before starting any activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History {planHistory.length > 0 ? `(${planHistory.length})` : ''}
          </button>
          <Sparkles className="w-6 h-6 text-neural-pink" />
        </div>
      </div>

      {/* Smart Reminders Section */}
      <div className="mb-8 pb-8 border-b border-gray-800">
        <SmartReminders
          ideas={ideas}
          logs={logs}
          checklist={checklist}
          reviews={reviews}
        />
      </div>

      {/* Input Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          What are you planning to do?
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Study linear algebra, Work on project proposal, Go for a walk..."
            className="neural-input flex-1"
            disabled={isAnalyzing}
          />
          <button
            onClick={handlePlan}
            disabled={!activity.trim() || isAnalyzing}
            className="neural-button px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline-block mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 inline mr-2" />
                Plan It
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter or click "Plan It" to get personalized recommendations
        </p>
      </div>

      {/* Error Display */}
      {planError && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{planError}</p>
        </div>
      )}

      {/* Plan Display */}
      {plan && (
        <div className="animate-slide-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Your Personalized Plan
              {plan.activity && (
                <span className="text-sm font-normal text-gray-400">- {plan.activity}</span>
              )}
            </h3>
            <button
              onClick={() => {
                if (confirm('Clear this plan?')) {
                  setPlan(null);
                }
              }}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Clear plan"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Summary */}
            {plan.summary && (
              <div className="bg-neural-darker border border-purple-500/30 rounded-lg p-4">
                <p className="text-gray-200">{plan.summary}</p>
              </div>
            )}

            {/* Best Time */}
            {plan.bestTime && (
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-blue-400">Best Time to Do This</span>
                </div>
                <p className="text-gray-300">{plan.bestTime}</p>
              </div>
            )}

            {/* Duration */}
            {plan.duration && (
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-yellow-400">Recommended Duration</span>
                </div>
                <p className="text-gray-300">{plan.duration}</p>
              </div>
            )}

            {/* Location/Context */}
            {plan.location && (
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-5 h-5 text-green-400" />
                  <span className="font-bold text-green-400">Where & How</span>
                </div>
                <p className="text-gray-300">{plan.location}</p>
              </div>
            )}

            {/* Recurring */}
            {plan.recurring && (
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Repeat className="w-5 h-5 text-purple-400" />
                  <span className="font-bold text-purple-400">Should This Be Recurring?</span>
                </div>
                <p className="text-gray-300">{plan.recurring}</p>
              </div>
            )}

            {/* Additional Tips */}
            {plan.tips && plan.tips.length > 0 && (
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-neural-pink" />
                  <span className="font-bold text-neural-pink">Pro Tips</span>
                </div>
                <ul className="space-y-2">
                  {plan.tips.map((tip, index) => (
                    <li key={index} className="text-gray-300 flex items-start gap-2">
                      <span className="text-neural-purple mt-1">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 pt-6 border-t border-gray-800 flex gap-3">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="neural-button-secondary flex-1 flex items-center justify-center gap-2"
            >
              <BookmarkPlus className="w-4 h-4" />
              {plan.name ? 'Rename Plan' : 'Name & Save'}
            </button>
            <button
              onClick={() => {
                setActivity('');
                setPlan(null);
              }}
              className="neural-button flex-1"
            >
              Plan Another Activity
            </button>
          </div>
        </div>
      )}

      {/* Save Plan Dialog */}
      {showSaveDialog && plan && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Name This Plan</h3>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSavePlanWithName();
                    }
                  }}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                  placeholder={`e.g., "${plan.activity}" or "Morning Routine Plan"`}
                  autoFocus
                />
              </div>

              <div className="text-xs text-gray-500">
                Activity: {plan.activity}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSavePlanWithName}
                  className="neural-button flex-1 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPlanName('');
                  }}
                  className="neural-button-secondary px-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!plan && !isAnalyzing && (
        <div className="bg-neural-darker/50 border border-gray-800 rounded-lg p-6">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            <Compass className="w-5 h-5 text-neural-purple" />
            How This Works
          </h4>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>AI analyzes your captured ideas, routines, energy logs, and past reviews</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Recommends optimal timing based on your energy patterns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Suggests duration based on similar activities and your ADHD patterns</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Advises on context, location, and whether to make it a routine</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neural-purple">•</span>
              <span>Provides personalized tips for success</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
