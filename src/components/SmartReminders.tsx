import { useState, FC } from 'react';
import { Bell, X, Volume2, VolumeX, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Idea, ActivityLog, Checklist, EndOfDayReview } from '../utils/apiService';

// ========== TYPE DEFINITIONS ==========

interface ReminderHistoryItem {
  ideaId: number;
  lastShown: string;
  showCount: number;
  dismissCount: number;
  actionTaken: boolean;
}

interface Reminder {
  id: number;
  content: string;
  tags?: string[];
  dueDate?: string | null;
  daysUntilDue?: number | null;
  importance: number;
  urgency: number;
  urgencyLabel: string;
  timesShown: number;
  shouldPlaySound: boolean;
}

interface RemindersResponse {
  reminders: Reminder[];
  profile: {
    forgetfulnessScore: number;
    category: string;
    recommendedFrequency: number;
  };
  metadata: {
    hasHighPriority: boolean;
    selectedCount: number;
    totalCandidates: number;
  };
}

interface SmartRemindersProps {
  ideas: Idea[];
  logs: ActivityLog[];
  checklist: Checklist;
  reviews: EndOfDayReview[];
}

// ========== AUDIO CONTEXT SINGLETON ==========

// Create AudioContext once at module level to avoid memory leaks
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (!audioContext && (window.AudioContext || (window as any).webkitAudioContext)) {
    audioContext = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// ========== COMPONENT ==========

const SmartReminders: FC<SmartRemindersProps> = ({ ideas, logs, checklist, reviews }) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [profile, setProfile] = useState<RemindersResponse['profile'] | null>(null);
  const [metadata, setMetadata] = useState<RemindersResponse['metadata'] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showReminders, setShowReminders] = useState<boolean>(false);
  const [reminderHistory, setReminderHistory] = useLocalStorage<ReminderHistoryItem[]>('neural-reminder-history', []);

  // Play notification sound for high priority reminders (reuses audio context)
  const playNotificationSound = (): void => {
    if (!soundEnabled) return;

    const context = getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.frequency.value = 800; // Frequency in Hz
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.5);
  };

  const fetchReminders = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/get-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ideas,
          logs,
          checklist,
          reviews,
          reminderHistory
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reminders');
      }

      const data: RemindersResponse = await response.json();
      setReminders(data.reminders);
      setProfile(data.profile);
      setMetadata(data.metadata);
      setShowReminders(true);

      // Play sound if there are high priority reminders
      if (data.metadata.hasHighPriority && soundEnabled) {
        playNotificationSound();
      }

      // Update reminder history - mark all returned reminders as shown
      const now = new Date().toISOString();
      const updatedHistory = [...reminderHistory];

      data.reminders.forEach(reminder => {
        const existingIndex = updatedHistory.findIndex(h => h.ideaId === reminder.id);
        if (existingIndex >= 0) {
          const existing = updatedHistory[existingIndex]!;
          updatedHistory[existingIndex] = {
            ideaId: existing.ideaId,
            lastShown: now,
            showCount: existing.showCount + 1,
            dismissCount: existing.dismissCount,
            actionTaken: existing.actionTaken
          };
        } else {
          updatedHistory.push({
            ideaId: reminder.id,
            lastShown: now,
            showCount: 1,
            dismissCount: 0,
            actionTaken: false
          });
        }
      });

      setReminderHistory(updatedHistory);

    } catch (err) {
      console.error('Error fetching reminders:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const dismissReminder = (reminderId: number): void => {
    // Update history to track dismissal
    const updatedHistory = reminderHistory.map(h =>
      h.ideaId === reminderId
        ? { ...h, dismissCount: h.dismissCount + 1 }
        : h
    );
    setReminderHistory(updatedHistory);

    // Remove from current display
    setReminders(prev => prev.filter(r => r.id !== reminderId));

    // If no reminders left, close the panel
    if (reminders.length === 1) {
      setShowReminders(false);
    }
  };

  const getUrgencyColor = (urgencyLabel: string): string => {
    switch (urgencyLabel) {
      case 'Critical': return 'text-red-400 bg-red-950 border-red-800';
      case 'High': return 'text-orange-400 bg-orange-950 border-orange-800';
      case 'Medium': return 'text-yellow-400 bg-yellow-950 border-yellow-800';
      default: return 'text-blue-400 bg-blue-950 border-blue-800';
    }
  };

  const getProfileColor = (category: string): string => {
    if (category === 'High Forgetfulness') return 'text-red-400';
    if (category === 'Average') return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-4">
      {/* Reminder Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={fetchReminders}
          disabled={loading || ideas.length === 0}
          className={`neural-button flex items-center gap-2 ${
            loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <Bell className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
          {loading ? 'Analyzing...' : 'Get Smart Reminders'}
        </button>

        {/* Sound Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="neural-button-secondary flex items-center gap-2"
          title={soundEnabled ? 'Sound notifications on' : 'Sound notifications off'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        {/* Profile Info */}
        {profile && (
          <div className="ml-auto text-sm text-gray-400">
            Profile: <span className={getProfileColor(profile.category)}>{profile.category}</span>
            {' '}(remind every ~{profile.recommendedFrequency} checks)
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

      {/* Reminders Panel */}
      {showReminders && reminders.length > 0 && (
        <div className="neural-card space-y-4 animate-slide-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-neural-purple" />
              Your Smart Reminders
              {metadata?.hasHighPriority && (
                <span className="text-xs px-2 py-1 bg-red-950 text-red-400 rounded-full border border-red-800">
                  High Priority
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowReminders(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile Summary */}
          {profile && metadata && (
            <div className="p-3 bg-neural-darker rounded-lg border border-gray-800 text-sm">
              <div className="flex items-center gap-4 text-gray-400">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Forgetfulness: <span className={getProfileColor(profile.category)}>{profile.forgetfulnessScore}%</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Showing {metadata.selectedCount} of {metadata.totalCandidates} candidates</span>
                </div>
              </div>
            </div>
          )}

          {/* Reminders List */}
          <div className="space-y-3">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`p-4 rounded-lg border ${getUrgencyColor(reminder.urgencyLabel)} relative group`}
              >
                {/* Dismiss Button */}
                <button
                  onClick={() => dismissReminder(reminder.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white"
                  title="Dismiss this reminder"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Content */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium flex-1 pr-6">{reminder.content}</p>
                  </div>

                  {/* Tags */}
                  {reminder.tags && reminder.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reminder.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {reminder.dueDate && reminder.daysUntilDue !== undefined && reminder.daysUntilDue !== null && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {reminder.daysUntilDue === 0 && 'Due TODAY'}
                          {reminder.daysUntilDue === 1 && 'Due tomorrow'}
                          {reminder.daysUntilDue > 1 && `Due in ${reminder.daysUntilDue} days`}
                          {reminder.daysUntilDue < 0 && `OVERDUE by ${Math.abs(reminder.daysUntilDue)} days`}
                        </span>
                      </div>
                    )}
                    <span>Importance: {reminder.importance}/100</span>
                    <span>Urgency: {reminder.urgency}/100</span>
                    {reminder.timesShown > 1 && (
                      <span className="text-gray-500">Shown {reminder.timesShown}x</span>
                    )}
                  </div>

                  {/* Sound Indicator */}
                  {reminder.shouldPlaySound && (
                    <div className="flex items-center gap-1 text-xs text-neural-purple">
                      <Volume2 className="w-3 h-3" />
                      <span>High priority notification</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Info */}
          <div className="text-xs text-gray-500 text-center pt-2 border-t border-gray-800">
            Reminders adapt to your forgetfulness profile. Dismiss ones you've handled to improve accuracy.
          </div>
        </div>
      )}

      {/* No Reminders Message */}
      {showReminders && reminders.length === 0 && (
        <div className="neural-card text-center text-gray-400 py-8 animate-slide-in">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-1">No urgent reminders right now</p>
          <p className="text-sm">You're all caught up! Keep up the great work.</p>
        </div>
      )}
    </div>
  );
};

export default SmartReminders;
