import React, { useState, FC, ChangeEvent, FormEvent } from 'react';
import { Moon, Calendar, TrendingUp, TrendingDown, Minus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDateTime, getTodayString } from '../utils/dateUtils';
import { ActivityLog, Checklist } from '../utils/apiService';

// ========== TYPE DEFINITIONS ==========

type MoodType = 'great' | 'good' | 'okay' | 'poor';

interface EndOfDayReviewType {
  id: number;
  date: string;
  timestamp: string;
  mood: MoodType;
  accomplishments: string;
  challenges: string;
  tomorrow: string;
  gratitude: string;
  stats: {
    logsCount: number;
    checklistCompleted: number;
    checklistTotal: number;
  };
}

interface EndOfDayReviewProps {
  reviews: EndOfDayReviewType[];
  setReviews: React.Dispatch<React.SetStateAction<EndOfDayReviewType[]>>;
  logs: ActivityLog[];
  checklist: Checklist;
}

interface MoodOption {
  value: MoodType;
  label: string;
  emoji: string;
  color: string;
}

// ========== CONSTANTS ==========

const MOOD_OPTIONS: MoodOption[] = [
  { value: 'great', label: 'Great', emoji: '😄', color: 'text-green-400' },
  { value: 'good', label: 'Good', emoji: '🙂', color: 'text-blue-400' },
  { value: 'okay', label: 'Okay', emoji: '😐', color: 'text-yellow-400' },
  { value: 'poor', label: 'Poor', emoji: '😔', color: 'text-red-400' },
];

// ========== COMPONENT ==========

const EndOfDayReview: FC<EndOfDayReviewProps> = ({ reviews, setReviews, logs, checklist }) => {
  const [mood, setMood] = useState<MoodType>('okay');
  const [accomplishments, setAccomplishments] = useState<string>('');
  const [challenges, setChallenges] = useState<string>('');
  const [tomorrow, setTomorrow] = useState<string>('');
  const [gratitude, setGratitude] = useState<string>('');
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);

  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.startTime).toDateString();
    const today = new Date().toDateString();
    return logDate === today;
  });

  const completedTodayCount = checklist.items.filter(item => item.completed).length;
  const totalItemsCount = checklist.items.length;

  const saveReview = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    const newReview: EndOfDayReviewType = {
      id: Date.now(),
      date: getTodayString(),
      timestamp: new Date().toISOString(),
      mood,
      accomplishments: accomplishments.trim(),
      challenges: challenges.trim(),
      tomorrow: tomorrow.trim(),
      gratitude: gratitude.trim(),
      stats: {
        logsCount: todayLogs.length,
        checklistCompleted: completedTodayCount,
        checklistTotal: totalItemsCount,
      },
    };

    setReviews(prev => [newReview, ...prev]);

    // Reset form
    setMood('okay');
    setAccomplishments('');
    setChallenges('');
    setTomorrow('');
    setGratitude('');
  };

  const deleteReview = (id: number): void => {
    if (confirm('Delete this review?')) {
      setReviews(prev => prev.filter(r => r.id !== id));
    }
  };

  const getMoodEmoji = (moodValue: MoodType): string => {
    return MOOD_OPTIONS.find(m => m.value === moodValue)?.emoji ?? '😐';
  };

  const toggleExpand = (id: number): void => {
    setExpandedReviewId(expandedReviewId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Review Form */}
      <div className="neural-card">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Moon className="w-6 h-6 text-neural-purple" />
          End of Day Review
        </h2>

        <form onSubmit={saveReview} className="space-y-4">
          {/* Today's Stats */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-neural-darker rounded-lg border border-gray-800">
            <div>
              <div className="text-xs text-gray-500">Activity Logs Today</div>
              <div className="text-2xl font-bold text-blue-400">{todayLogs.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Checklist Progress</div>
              <div className="text-2xl font-bold text-purple-400">
                {completedTodayCount}/{totalItemsCount}
              </div>
            </div>
          </div>

          {/* Mood Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">How was your day?</label>
            <div className="grid grid-cols-4 gap-2">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    mood === option.value
                      ? 'border-neural-purple bg-neural-purple/20'
                      : 'border-gray-800 bg-neural-darker hover:border-gray-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.emoji}</div>
                  <div className={`text-sm font-medium ${option.color}`}>{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Accomplishments */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              What did you accomplish today?
            </label>
            <textarea
              value={accomplishments}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAccomplishments(e.target.value)}
              placeholder="List your wins, big or small..."
              className="neural-textarea min-h-[100px]"
              required
            />
          </div>

          {/* Challenges */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-orange-400" />
              What challenges did you face?
            </label>
            <textarea
              value={challenges}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setChallenges(e.target.value)}
              placeholder="What was difficult? What could improve?"
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Tomorrow's Plan */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              What's important for tomorrow?
            </label>
            <textarea
              value={tomorrow}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTomorrow(e.target.value)}
              placeholder="Top priorities for tomorrow..."
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Gratitude */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Minus className="w-4 h-4 text-pink-400" />
              What are you grateful for today?
            </label>
            <textarea
              value={gratitude}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGratitude(e.target.value)}
              placeholder="Three things you're grateful for..."
              className="neural-textarea min-h-[100px]"
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="neural-button w-full">
            <Moon className="w-4 h-4 inline mr-2" />
            Save End of Day Review
          </button>
        </form>
      </div>

      {/* Past Reviews */}
      {reviews.length > 0 && (
        <div className="neural-card">
          <h3 className="text-xl font-bold mb-4">Past Reviews ({reviews.length})</h3>

          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-neural-purple transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <button
                    onClick={() => toggleExpand(review.id)}
                    className="flex items-center gap-3 flex-1 text-left group"
                  >
                    <div className="text-3xl">{getMoodEmoji(review.mood)}</div>
                    <div>
                      <div className="font-bold text-lg group-hover:text-neural-purple transition-colors">
                        {review.date}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(review.timestamp)}
                      </div>
                    </div>
                    {expandedReviewId === review.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 ml-auto" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteReview(review.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Stats Preview */}
                <div className="flex gap-4 text-sm text-gray-400 mb-3">
                  <span>{review.stats.logsCount} logs</span>
                  <span>
                    {review.stats.checklistCompleted}/{review.stats.checklistTotal} tasks
                  </span>
                </div>

                {/* Expanded Content */}
                {expandedReviewId === review.id && (
                  <div className="space-y-3 pt-3 border-t border-gray-800 animate-slide-in">
                    {review.accomplishments && (
                      <div>
                        <div className="text-sm font-medium text-green-400 mb-1 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Accomplishments
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {review.accomplishments}
                        </p>
                      </div>
                    )}

                    {review.challenges && (
                      <div>
                        <div className="text-sm font-medium text-orange-400 mb-1 flex items-center gap-2">
                          <TrendingDown className="w-4 h-4" />
                          Challenges
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {review.challenges}
                        </p>
                      </div>
                    )}

                    {review.tomorrow && (
                      <div>
                        <div className="text-sm font-medium text-blue-400 mb-1 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Tomorrow's Plan
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {review.tomorrow}
                        </p>
                      </div>
                    )}

                    {review.gratitude && (
                      <div>
                        <div className="text-sm font-medium text-pink-400 mb-1 flex items-center gap-2">
                          <Minus className="w-4 h-4" />
                          Gratitude
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">
                          {review.gratitude}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EndOfDayReview;
