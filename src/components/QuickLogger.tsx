/**
 * QUICK LOGGER COMPONENT
 *
 * Purpose: Log activities with energy/motivation levels, study time tracking, and timer.
 *          AI-powered subject classification for study sessions.
 *          30-day unified history calendar with multi-metric visualization.
 *
 * Key Features:
 * - Manual duration input OR timer-based tracking
 * - AI subject classification (Haiku 3.5, cached)
 * - Energy/motivation sliders (1-10 scale)
 * - Study time calculation and display
 * - Activity grid with quick selection
 * - 30-day unified calendar (energy, motivation, study time)
 * - Day details view with 4 stat cards
 *
 * State Management:
 * - logs[] - All activity logs in localStorage
 * - mode - 'manual' or 'timer'
 * - timerSeconds - Running timer value
 * - duration - Manual input minutes
 * - energy, motivation - 1-10 sliders
 * - selectedDay - History day details view
 *
 * Key Functions:
 * - logEntry() (80-139) - **CRITICAL** Captures form values before async to prevent race conditions
 * - startTimer/pauseTimer/resetTimer() (61-78) - Timer controls
 * - deleteLog() (141-145) - Remove log entry
 * - classifySubject() (174-194) - AI classification with caching
 *
 * Important Sections:
 * - Duration input bug fix (line 84) - Captures values in local consts before await
 * - Study time calculation (line 161) - Rounded to 1 decimal
 * - Unified 30-day calendar (lines 666-757) - Energy, motivation, study bars
 * - Day details view (lines 759-857) - 4 stat cards including study time
 * - Slider gradients - Use ((value - 1) / 9) * 100 for 1-10 range
 *
 * Common Bugs:
 * - Duration showing wrong value → Check logEntry() captures values before async (line 84)
 * - Study time decimals → Should be rounded with Math.round(val * 10) / 10
 * - Slider alignment → Check gradient calculation and slider CSS class
 * - Classification not working → Check server.cjs endpoint and model name
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, Zap, Heart, BookOpen, Plus, TrendingUp, Calendar, X, CheckCircle2, Clock, Play, Pause, Square, Trash2 } from 'lucide-react';
import { formatTime, getTimePeriod, getTodayString } from '../utils/dateUtils';
import { classifySubject } from '../utils/apiService';

// Types
interface SubjectHierarchy {
  hierarchy: string[];
  [key: string]: any;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  timePeriod: string;
  energy: number;
  motivation: number;
  activity: string;
  subject: string | null;
  subjectHierarchy: SubjectHierarchy | null;
  duration: number | null;
  note: string;
}

interface QuickLoggerProps {
  logs: ActivityLog[];
  setLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
}

interface LogHistoryViewProps {
  logs: ActivityLog[];
  onClose: () => void;
}

interface DayData {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  logs: ActivityLog[];
  avgEnergy: number | null;
  avgMotivation: number | null;
  isToday: boolean;
}

const ACTIVITIES = [
  'Studying',
  'Taking meds',
  'Eating',
  'Walking',
  'Resting',
  'Social',
  'Pink/Brown noise',
  'Other',
];

export default function QuickLogger({ logs, setLogs }: QuickLoggerProps) {
  const [showLogger, setShowLogger] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [energy, setEnergy] = useState<number>(5);
  const [motivation, setMotivation] = useState<number>(5);
  const [activity, setActivity] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
  const [isTimerMode, setIsTimerMode] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Timer effect
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  const startTimer = (): void => {
    setIsTimerRunning(true);
    setTimerStartTime(Date.now());
  };

  const pauseTimer = (): void => {
    setIsTimerRunning(false);
  };

  const stopTimer = (): void => {
    setIsTimerRunning(false);
    // Auto-fill duration with timer value
    const minutes = Math.round(timerSeconds / 60);
    setDuration(minutes.toString());
    setTimerSeconds(0);
    setIsTimerMode(false);
  };

  const formatTimer = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const logEntry = async (): Promise<void> => {
    // Store values before state updates to prevent race conditions
    const currentActivity = activity;
    const currentSubject = subject;
    const currentDuration = duration;
    const currentEnergy = energy;
    const currentMotivation = motivation;
    const currentNote = note;

    // Calculate duration in minutes
    let durationMinutes = 30; // default
    if (currentDuration && currentDuration.trim() !== '') {
      const parsed = parseInt(currentDuration.trim(), 10); // Explicit base 10
      if (!isNaN(parsed) && parsed > 0) {
        durationMinutes = parsed;
      }
    }

    console.log('Duration input:', JSON.stringify(currentDuration), '→ Parsed:', durationMinutes);

    // Classify subject if studying
    let subjectHierarchy: SubjectHierarchy | null = null;
    if (currentActivity === 'Studying' && currentSubject.trim()) {
      console.log('Classifying subject:', currentSubject.trim());
      const classification = await classifySubject(currentSubject.trim());
      console.log('Classification result:', classification);
      if (classification.success) {
        subjectHierarchy = classification.data;
      }
    }

    const newLog: ActivityLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      timePeriod: getTimePeriod(),
      energy: currentEnergy,
      motivation: currentMotivation,
      activity: currentActivity,
      subject: currentActivity === 'Studying' ? currentSubject : null,
      subjectHierarchy: currentActivity === 'Studying' ? subjectHierarchy : null,
      duration: currentActivity === 'Studying' ? durationMinutes : null,
      note: currentNote.trim(),
    };

    console.log('Creating log with duration:', newLog.duration);

    setLogs(prev => [newLog, ...prev]);

    // Reset form - ensure clean state
    setEnergy(5);
    setMotivation(5);
    setActivity('');
    setSubject('');
    setNote('');
    setDuration('');
    setTimerSeconds(0);
    setIsTimerMode(false);
    setIsTimerRunning(false);
    setShowLogger(false);
  };

  const deleteLog = (logId: number): void => {
    if (confirm('Delete this log entry?')) {
      setLogs(prev => prev.filter(log => log.id !== logId));
    }
  };

  const todayLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp).toDateString();
    const today = new Date().toDateString();
    return logDate === today;
  });

  const avgEnergy = todayLogs.length > 0
    ? Math.round(todayLogs.reduce((sum, log) => sum + log.energy, 0) / todayLogs.length)
    : 0;

  const avgMotivation = todayLogs.length > 0
    ? Math.round(todayLogs.reduce((sum, log) => sum + log.motivation, 0) / todayLogs.length)
    : 0;

  const studyTime = Math.round(
    (todayLogs
      .filter(log => log.activity === 'Studying')
      .reduce((total, log) => total + (log.duration || 30), 0) / 60) * 10
  ) / 10; // Sum durations in hours, rounded to 1 decimal

  // Render history view if active
  if (showHistory) {
    return (
      <LogHistoryView
        logs={logs}
        onClose={() => setShowHistory(false)}
      />
    );
  }

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-neural-blue" />
          Today's Pulse
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary text-sm"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            History
          </button>
          <button
            onClick={() => setShowLogger(!showLogger)}
            className="neural-button text-sm"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Quick Log
          </button>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-400">Avg Energy</span>
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">{avgEnergy}/10</div>
          <div className="h-2 bg-neural-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 transition-all"
              style={{ width: `${avgEnergy * 10}%` }}
            />
          </div>
        </div>

        <div className="bg-neural-darker border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-400">Avg Motivation</span>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">{avgMotivation}/10</div>
          <div className="h-2 bg-neural-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-red-400 transition-all"
              style={{ width: `${avgMotivation * 10}%` }}
            />
          </div>
        </div>

        <div className="bg-neural-darker border border-gray-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-5 h-5 text-neural-purple" />
            <span className="text-sm text-gray-400">Study Time</span>
          </div>
          <div className="text-3xl font-bold text-neural-purple">{studyTime}h</div>
          <div className="text-sm text-gray-500 mt-1">
            {todayLogs.filter(l => l.activity === 'Studying').length} sessions
          </div>
        </div>
      </div>

      {/* Quick Logger Form */}
      {showLogger && (
        <div className="bg-neural-darker border border-neural-purple rounded-lg p-4 mb-6 animate-slide-in">
          <h3 className="font-bold mb-4">Log Current State</h3>

          {/* Energy Slider */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Energy Level
              </span>
              <span className="text-yellow-400 font-bold text-lg">{energy}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={energy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnergy(parseInt(e.target.value))}
              className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #facc15 0%, #facc15 ${((energy - 1) / 9) * 100}%, #1a1a1f ${((energy - 1) / 9) * 100}%, #1a1a1f 100%)`
              }}
            />
          </div>

          {/* Motivation Slider */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Motivation Level
              </span>
              <span className="text-red-400 font-bold text-lg">{motivation}/10</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={motivation}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMotivation(parseInt(e.target.value))}
              className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #f87171 0%, #f87171 ${((motivation - 1) / 9) * 100}%, #1a1a1f ${((motivation - 1) / 9) * 100}%, #1a1a1f 100%)`
              }}
            />
          </div>

          {/* Activity Dropdown */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Current Activity</label>
            <select
              value={activity}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActivity(e.target.value)}
              className="neural-input"
            >
              <option value="">Select activity...</option>
              {ACTIVITIES.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Subject Input (if studying) */}
          {activity === 'Studying' && (
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  Subject
                  <span className="text-xs text-gray-500 ml-2">(e.g., "Group Theory", "Quantum Field Theory")</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                  placeholder="Enter what you're studying..."
                  className="neural-input"
                />
              </div>

              {/* Duration / Timer */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400">Study Duration</label>
                  <button
                    onClick={() => {
                      console.log('Switching mode from', isTimerMode ? 'Timer' : 'Manual', 'to', isTimerMode ? 'Manual' : 'Timer', '| Current duration:', duration);
                      setIsTimerMode(!isTimerMode);
                      if (!isTimerMode) {
                        setDuration('');
                        setTimerSeconds(0);
                        setIsTimerRunning(false);
                      }
                    }}
                    className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                  >
                    {isTimerMode ? 'Manual' : 'Timer'}
                  </button>
                </div>

                {isTimerMode ? (
                  <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                    <div className="text-center mb-3">
                      <div className="text-4xl font-bold text-neural-purple font-mono">
                        {formatTimer(timerSeconds)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {isTimerRunning ? 'Timer running...' : 'Timer paused'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!isTimerRunning ? (
                        <button
                          onClick={startTimer}
                          className="flex-1 neural-button-secondary flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          {timerSeconds === 0 ? 'Start' : 'Resume'}
                        </button>
                      ) : (
                        <button
                          onClick={pauseTimer}
                          className="flex-1 neural-button-secondary flex items-center justify-center gap-2"
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </button>
                      )}
                      <button
                        onClick={stopTimer}
                        disabled={timerSeconds === 0}
                        className="flex-1 neural-button-secondary flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Square className="w-4 h-4" />
                        Stop
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={duration}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        console.log('Duration field changed:', JSON.stringify(e.target.value));
                        setDuration(e.target.value);
                      }}
                      placeholder="30"
                      min="1"
                      className="neural-input"
                    />
                    <span className="text-sm text-gray-400 whitespace-nowrap">minutes (default: 30)</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick Note */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">Quick Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
              placeholder="e.g., 'felt motivated after walk', 'brain fog'"
              className="neural-input"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={logEntry}
              disabled={!activity}
              className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Log
            </button>
            <button
              onClick={() => setShowLogger(false)}
              className="neural-button-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recent Logs Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h3 className="font-bold">Today's Timeline ({todayLogs.length} logs)</h3>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {todayLogs.length === 0 ? (
            <p className="text-gray-500 text-center py-4 text-sm">
              No logs yet today. Click "Quick Log" to start tracking!
            </p>
          ) : (
            todayLogs.map(log => (
              <div
                key={log.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-3 hover:border-neural-blue transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-neural-blue">{log.activity}</span>
                      {log.subject && (
                        <span className="text-sm text-gray-400">
                          {log.subjectHierarchy ? `(${log.subjectHierarchy.hierarchy.join(' → ')})` : `(${log.subject})`}
                        </span>
                      )}
                      {log.duration && (
                        <span className="text-xs px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded-full">
                          {log.duration} min
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-1">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400">{log.energy}/10</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-red-400" />
                        <span className="text-red-400">{log.motivation}/10</span>
                      </span>
                    </div>
                    {log.note && (
                      <p className="text-sm text-gray-400 italic">{log.note}</p>
                    )}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div>
                      <p className="text-xs text-gray-600">{formatTime(log.timestamp)}</p>
                      <p className="text-xs text-gray-700 capitalize">{log.timePeriod}</p>
                    </div>
                    <button
                      onClick={() => deleteLog(log.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Log History View Component
function LogHistoryView({ logs, onClose }: LogHistoryViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Group logs by date
  const logsByDate = logs.reduce<Record<string, ActivityLog[]>>((acc, log) => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  // Generate last 30 days
  const generateCalendarDays = (): DayData[] => {
    const days: DayData[] = [];
    const today = new Date();
    const todayString = getTodayString();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const dayLogs = logsByDate[dateString] || [];

      const avgEnergy = dayLogs.length > 0
        ? dayLogs.reduce((sum, log) => sum + log.energy, 0) / dayLogs.length
        : null;

      const avgMotivation = dayLogs.length > 0
        ? dayLogs.reduce((sum, log) => sum + log.motivation, 0) / dayLogs.length
        : null;

      days.push({
        date: dateString,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayOfMonth: date.getDate(),
        logs: dayLogs,
        avgEnergy,
        avgMotivation,
        isToday: dateString === todayString,
      });
    }

    return days;
  };

  const days = generateCalendarDays();

  // Calculate overall stats
  const daysWithLogs = days.filter(d => d.logs.length > 0).length;
  const allLogs = days.flatMap(d => d.logs);

  const overallAvgEnergy = allLogs.length > 0
    ? Math.round((allLogs.reduce((sum, log) => sum + log.energy, 0) / allLogs.length) * 10) / 10
    : 0;

  const overallAvgMotivation = allLogs.length > 0
    ? Math.round((allLogs.reduce((sum, log) => sum + log.motivation, 0) / allLogs.length) * 10) / 10
    : 0;

  const totalLogs = allLogs.length;

  // Find best and worst days
  const daysWithData = days.filter(d => d.avgEnergy !== null);
  const bestEnergyDay = daysWithData.reduce((best, d) =>
    (d.avgEnergy || 0) > (best.avgEnergy || 0) ? d : best
  , { avgEnergy: 0 } as DayData);

  const worstEnergyDay = daysWithData.reduce((worst, d) =>
    (d.avgEnergy || 10) < (worst.avgEnergy || 10) ? d : worst
  , { avgEnergy: 10 } as DayData);

  const getColorClass = (avgValue: number | null): string => {
    if (avgValue === null) return 'bg-gray-800 border-gray-700';
    if (avgValue >= 7) return 'bg-green-600/30 border-green-600/50';
    if (avgValue >= 4) return 'bg-yellow-600/30 border-yellow-600/50';
    return 'bg-red-600/30 border-red-600/50';
  };

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-neural-purple" />
            Log History & Analytics
          </h2>
          <p className="text-sm text-gray-400 mt-1">Last 30 days</p>
        </div>
        <button onClick={onClose} className="neural-button-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">Total Logs</div>
          <div className="text-2xl font-bold text-neural-purple">{totalLogs}</div>
          <div className="text-xs text-gray-500">{daysWithLogs} days</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
            <Zap className="w-3 h-3" />
            Avg Energy
          </div>
          <div className="text-2xl font-bold text-yellow-400">{overallAvgEnergy}/10</div>
          <div className="text-xs text-gray-500">All time</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
            <Heart className="w-3 h-3" />
            Avg Motivation
          </div>
          <div className="text-2xl font-bold text-red-400">{overallAvgMotivation}/10</div>
          <div className="text-xs text-gray-500">All time</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">Tracking Rate</div>
          <div className="text-2xl font-bold text-neural-blue">{Math.round((daysWithLogs / 30) * 100)}%</div>
          <div className="text-xs text-gray-500">{daysWithLogs}/30 days</div>
        </div>
      </div>

      {/* Insights */}
      {daysWithData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-600/10 to-green-600/5 border border-green-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="font-bold text-green-400">Best Energy Day</span>
            </div>
            <div className="text-sm text-gray-300">
              {new Date(bestEnergyDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-2xl font-bold text-green-400 mt-1">
              {Math.round((bestEnergyDay.avgEnergy || 0) * 10) / 10}/10
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {bestEnergyDay.logs.length} logs that day
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-600/10 to-red-600/5 border border-red-600/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-red-400" />
              <span className="font-bold text-red-400">Lowest Energy Day</span>
            </div>
            <div className="text-sm text-gray-300">
              {new Date(worstEnergyDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div className="text-2xl font-bold text-red-400 mt-1">
              {Math.round((worstEnergyDay.avgEnergy || 0) * 10) / 10}/10
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {worstEnergyDay.logs.length} logs that day
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4">
        <div className="flex items-center gap-4 mb-2 text-sm">
          <span className="text-gray-400 font-medium">Metric indicators:</span>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-gray-500">Energy</span>
          </div>
          <div className="flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400" />
            <span className="text-gray-500">Motivation</span>
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-purple-400" />
            <span className="text-gray-500">Study Hours</span>
          </div>
        </div>
      </div>

      {/* Single Calendar Grid with All Metrics */}
      <div className="mb-6">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Activity className="w-5 h-5 text-neural-purple" />
          30-Day Overview
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const studyHours = day.logs
              .filter(log => log.activity === 'Studying')
              .reduce((total, log) => total + (log.duration || 30), 0) / 60;

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.logs.length > 0 ? day.date : null)}
                className={`p-2 rounded-lg border-2 transition-all ${
                  day.logs.length === 0
                    ? 'bg-gray-800 border-gray-700'
                    : 'bg-neural-darker border-gray-700 hover:border-neural-purple/50'
                } ${
                  selectedDate === day.date ? 'ring-2 ring-neural-purple' : ''
                } ${
                  day.logs.length > 0 ? 'cursor-pointer' : 'cursor-default'
                } ${
                  day.isToday ? 'border-neural-blue' : ''
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {day.dayOfWeek}
                  {day.isToday && <span className="text-neural-blue ml-1">●</span>}
                </div>
                <div className="text-base font-bold mb-1">{day.dayOfMonth}</div>

                {day.logs.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {/* Energy bar */}
                    {day.avgEnergy !== null && (
                      <div className="h-1 bg-neural-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400"
                          style={{ width: `${day.avgEnergy * 10}%` }}
                          title={`Energy: ${Math.round(day.avgEnergy * 10) / 10}/10`}
                        />
                      </div>
                    )}
                    {/* Motivation bar */}
                    {day.avgMotivation !== null && (
                      <div className="h-1 bg-neural-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400"
                          style={{ width: `${day.avgMotivation * 10}%` }}
                          title={`Motivation: ${Math.round(day.avgMotivation * 10) / 10}/10`}
                        />
                      </div>
                    )}
                    {/* Study time bar */}
                    {studyHours > 0 && (
                      <div className="h-1 bg-neural-dark rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400"
                          style={{ width: `${Math.min(studyHours / 8 * 100, 100)}%` }}
                          title={`Study: ${Math.round(studyHours * 10) / 10}h`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Details */}
      {selectedDate && (() => {
        const selectedDay = days.find(d => d.date === selectedDate);
        if (!selectedDay || selectedDay.logs.length === 0) return null;

        return (
          <div className="bg-neural-darker border border-neural-purple rounded-lg p-4 animate-slide-in">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {selectedDay.isToday && (
                <span className="text-xs px-2 py-1 bg-neural-blue/20 text-neural-blue rounded-full">
                  Today
                </span>
              )}
            </h3>

            {/* Day stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Logs</div>
                <div className="text-2xl font-bold text-neural-purple">
                  {selectedDay.logs.length}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
                  <Zap className="w-3 h-3" />
                  Avg Energy
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  {Math.round((selectedDay.avgEnergy || 0) * 10) / 10}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
                  <Heart className="w-3 h-3" />
                  Avg Motivation
                </div>
                <div className="text-2xl font-bold text-red-400">
                  {Math.round((selectedDay.avgMotivation || 0) * 10) / 10}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
                  <BookOpen className="w-3 h-3" />
                  Study Time
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round((selectedDay.logs
                    .filter(log => log.activity === 'Studying')
                    .reduce((total, log) => total + (log.duration || 30), 0) / 60) * 10) / 10}h
                </div>
              </div>
            </div>

            {/* Logs for the day */}
            <div>
              <div className="text-sm font-medium mb-2">Logs ({selectedDay.logs.length}):</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedDay.logs.map(log => (
                  <div
                    key={log.id}
                    className="bg-neural-dark border border-gray-800 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-neural-blue">{log.activity}</span>
                          {log.subject && (
                            <span className="text-sm text-gray-400">
                              {log.subjectHierarchy ? `(${log.subjectHierarchy.hierarchy.join(' → ')})` : `(${log.subject})`}
                            </span>
                          )}
                          {log.duration && (
                            <span className="text-xs px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded-full">
                              {log.duration} min
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm mb-1">
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400">{log.energy}/10</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-red-400" />
                            <span className="text-red-400">{log.motivation}/10</span>
                          </span>
                        </div>
                        {log.note && (
                          <p className="text-sm text-gray-400 italic">{log.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">{formatTime(log.timestamp)}</p>
                        <p className="text-xs text-gray-700 capitalize">{log.timePeriod}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
