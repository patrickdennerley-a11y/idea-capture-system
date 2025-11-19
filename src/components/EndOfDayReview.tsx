import { useState } from 'react';
import { Moon, AlertCircle, TrendingUp, Brain } from 'lucide-react';
import { getTodayString, isToday } from '../utils/dateUtils';

// Type definitions
interface Log {
  timestamp: string;
  energy: number;
  activity: string;
  [key: string]: any;
}

interface ChecklistItem {
  completed: boolean;
  [key: string]: any;
}

interface Checklist {
  items: ChecklistItem[];
  [key: string]: any;
}

interface ReviewResponses {
  dayOverall: string;
  accomplishments: string;
  energyRecall: number;
  followedRoutines: boolean;
  tomorrowPriorities: string;
}

interface ActualData {
  avgEnergy: number;
  studyTime: number;
  followedRoutines: boolean;
  completionRate: number;
  totalLogs: number;
}

interface Comparison {
  energyAccuracy: number;
  routineAccuracy: boolean;
}

interface Insight {
  type: 'success' | 'warning' | 'info';
  text: string;
}

interface Review {
  id: number;
  date: string;
  timestamp: string;
  completed: boolean;
  responses: ReviewResponses;
  actualData: ActualData;
  comparison: Comparison;
  insights: Insight[];
}

interface EndOfDayReviewProps {
  reviews: Review[];
  setReviews: (reviews: Review[] | ((prev: Review[]) => Review[])) => void;
  logs: Log[];
  checklist: Checklist;
}

export default function EndOfDayReview({
  reviews,
  setReviews,
  logs,
  checklist,
}: EndOfDayReviewProps): React.ReactElement {
  const [showReview, setShowReview] = useState<boolean>(false);
  const [dayOverall, setDayOverall] = useState<string>('');
  const [accomplishments, setAccomplishments] = useState<string>('');
  const [energyRecall, setEnergyRecall] = useState<number>(5);
  const [followedRoutines, setFollowedRoutines] = useState<boolean>(true);
  const [tomorrowPriorities, setTomorrowPriorities] = useState<string>('');

  const todayReview = reviews.find(r => r.date === getTodayString());
  const hasCompletedToday = todayReview && todayReview.completed;

  const saveReview = (): void => {
    // Calculate actual stats from logs
    const todayLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp).toDateString();
      const today = new Date().toDateString();
      return logDate === today;
    });

    const actualAvgEnergy = todayLogs.length > 0
      ? Math.round(todayLogs.reduce((sum, log) => sum + log.energy, 0) / todayLogs.length)
      : 0;

    const actualStudyTime = todayLogs.filter(l => l.activity === 'Studying').length * 0.5;

    const completionRate = checklist.items
      ? (checklist.items.filter(i => i.completed).length / checklist.items.length) * 100
      : 0;

    const actualFollowedRoutines = completionRate >= 70;

    // Create review with comparison
    const newReview: Review = {
      id: Date.now(),
      date: getTodayString(),
      timestamp: new Date().toISOString(),
      completed: true,
      responses: {
        dayOverall: dayOverall.trim(),
        accomplishments: accomplishments.trim(),
        energyRecall,
        followedRoutines,
        tomorrowPriorities: tomorrowPriorities.trim(),
      },
      actualData: {
        avgEnergy: actualAvgEnergy,
        studyTime: actualStudyTime,
        followedRoutines: actualFollowedRoutines,
        completionRate: Math.round(completionRate),
        totalLogs: todayLogs.length,
      },
      comparison: {
        energyAccuracy: Math.abs(energyRecall - actualAvgEnergy),
        routineAccuracy: followedRoutines === actualFollowedRoutines,
      },
      insights: generateInsights(
        energyRecall,
        actualAvgEnergy,
        followedRoutines,
        actualFollowedRoutines,
        todayLogs
      ),
    };

    setReviews(prev => {
      const filtered = prev.filter(r => r.date !== getTodayString());
      return [newReview, ...filtered];
    });

    // Reset form
    setDayOverall('');
    setAccomplishments('');
    setEnergyRecall(5);
    setFollowedRoutines(true);
    setTomorrowPriorities('');
    setShowReview(false);
  };

  const generateInsights = (
    recalled: number,
    actual: number,
    routinesRecalled: boolean,
    routinesActual: boolean,
    logs: Log[]
  ): Insight[] => {
    const insights: Insight[] = [];

    // Energy perception accuracy
    const energyDiff = recalled - actual;
    if (Math.abs(energyDiff) > 2) {
      if (energyDiff > 0) {
        insights.push({
          type: 'warning',
          text: `You recalled energy as ${recalled}/10, but actual average was ${actual}/10. You overestimated by ${energyDiff} points.`,
        });
      } else {
        insights.push({
          type: 'info',
          text: `You recalled energy as ${recalled}/10, but actual average was ${actual}/10. You underestimated by ${Math.abs(energyDiff)} points.`,
        });
      }
    } else {
      insights.push({
        type: 'success',
        text: `Your energy perception is accurate! Recalled ${recalled}/10, actual ${actual}/10.`,
      });
    }

    // Routine adherence
    if (routinesRecalled !== routinesActual) {
      insights.push({
        type: 'warning',
        text: routinesRecalled
          ? 'You thought you followed routines, but completion was below 70%.'
          : 'You were harder on yourself than reality - you actually followed routines well!',
      });
    }

    // Activity patterns
    const studySessions = logs.filter(l => l.activity === 'Studying');
    if (studySessions.length > 0) {
      const avgStudyEnergy = Math.round(
        studySessions.reduce((sum, l) => sum + l.energy, 0) / studySessions.length
      );
      insights.push({
        type: 'info',
        text: `Study sessions had average energy of ${avgStudyEnergy}/10. ${
          avgStudyEnergy >= 6 ? 'Good energy for learning!' : 'Consider studying when energy is higher.'
        }`,
      });
    }

    return insights;
  };

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Moon className="w-6 h-6 text-purple-400" />
            End of Day Review
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Metacognition: Compare perception vs reality
          </p>
        </div>
        {!hasCompletedToday && (
          <button
            onClick={() => setShowReview(!showReview)}
            className="neural-button text-sm"
          >
            {showReview ? 'Close' : 'Start Review'}
          </button>
        )}
      </div>

      {hasCompletedToday && (
        <div className="bg-neural-darker border border-green-800/30 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center">
              <Moon className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Today's Review Complete!</h3>
              <p className="text-sm text-gray-400">
                Great job reflecting on your day
              </p>
            </div>
          </div>

          {/* Show comparison and insights */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neural-dark rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Energy Recalled</div>
                <div className="text-2xl font-bold text-purple-400">
                  {todayReview?.responses.energyRecall}/10
                </div>
              </div>
              <div className="bg-neural-dark rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Energy Actual</div>
                <div className="text-2xl font-bold text-neural-blue">
                  {todayReview?.actualData.avgEnergy}/10
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-neural-purple" />
                Insights
              </h4>
              <div className="space-y-2">
                {todayReview?.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      insight.type === 'success'
                        ? 'bg-green-900/10 border-green-800/30 text-green-400'
                        : insight.type === 'warning'
                        ? 'bg-yellow-900/10 border-yellow-800/30 text-yellow-400'
                        : 'bg-blue-900/10 border-blue-800/30 text-blue-400'
                    }`}
                  >
                    <p className="text-sm">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4">
              <h4 className="font-bold mb-2">Your Reflections</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-400">Day Overall:</span>
                  <p className="text-gray-200 mt-1">{todayReview?.responses.dayOverall}</p>
                </div>
                <div>
                  <span className="text-gray-400">Accomplishments:</span>
                  <p className="text-gray-200 mt-1">{todayReview?.responses.accomplishments}</p>
                </div>
                <div>
                  <span className="text-gray-400">Tomorrow's Priorities:</span>
                  <p className="text-gray-200 mt-1">{todayReview?.responses.tomorrowPriorities}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReview && !hasCompletedToday && (
        <div className="space-y-4 animate-slide-in">
          <div className="bg-neural-darker border border-purple-800/30 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 text-purple-400 mb-2" />
            <p className="text-sm text-gray-400">
              Answer these questions based on your MEMORY, then we'll compare with your actual logged data.
            </p>
          </div>

          {/* Question 1: Day Overall */}
          <div>
            <label className="block text-sm font-medium mb-2">
              1. How was your day overall?
            </label>
            <textarea
              value={dayOverall}
              onChange={(e) => setDayOverall(e.target.value)}
              placeholder="Free text... how did you feel, what stood out?"
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Question 2: Accomplishments */}
          <div>
            <label className="block text-sm font-medium mb-2">
              2. What did you accomplish today?
            </label>
            <textarea
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              placeholder="List what you completed today..."
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Question 3: Energy Recall */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center justify-between">
              <span>3. What was your energy level throughout the day?</span>
              <span className="text-purple-400 font-bold text-lg">{energyRecall}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={energyRecall}
              onChange={(e) => setEnergyRecall(parseInt(e.target.value))}
              className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((energyRecall - 1) / 9) * 100}%, #1a1a1f ${((energyRecall - 1) / 9) * 100}%, #1a1a1f 100%)`,
              }}
            />
          </div>

          {/* Question 4: Routines */}
          <div>
            <label className="block text-sm font-medium mb-2">
              4. Did you follow your routines today?
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setFollowedRoutines(true)}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  followedRoutines
                    ? 'bg-green-600 text-white'
                    : 'bg-neural-darker border border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setFollowedRoutines(false)}
                className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                  !followedRoutines
                    ? 'bg-red-600 text-white'
                    : 'bg-neural-darker border border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Question 5: Tomorrow */}
          <div>
            <label className="block text-sm font-medium mb-2">
              5. What are tomorrow's top 3 priorities?
            </label>
            <textarea
              value={tomorrowPriorities}
              onChange={(e) => setTomorrowPriorities(e.target.value)}
              placeholder="1. ...&#10;2. ...&#10;3. ..."
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Save Button */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={saveReview}
              disabled={!dayOverall.trim() || !accomplishments.trim()}
              className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Complete Review
            </button>
            <button
              onClick={() => setShowReview(false)}
              className="neural-button-secondary"
            >
              Save for Later
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Your review will be compared with your actual logged data to build self-awareness
          </p>
        </div>
      )}

      {!showReview && !hasCompletedToday && (
        <div className="text-center py-8">
          <Moon className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            End your day with reflection and metacognition
          </p>
          <button
            onClick={() => setShowReview(true)}
            className="neural-button"
          >
            Start Tonight's Review
          </button>
        </div>
      )}

      {/* Past Reviews */}
      {reviews.filter(r => r.date !== getTodayString()).length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-800">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-400" />
            Past Reviews
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {reviews
              .filter(r => r.date !== getTodayString())
              .slice(0, 7)
              .map(review => (
                <div
                  key={review.id}
                  className="bg-neural-darker border border-gray-800 rounded-lg p-3 hover:border-gray-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{review.date}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-purple-400">
                        Recalled: {review.responses.energyRecall}/10
                      </span>
                      <span className="text-neural-blue">
                        Actual: {review.actualData.avgEnergy}/10
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {review.responses.dayOverall}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
