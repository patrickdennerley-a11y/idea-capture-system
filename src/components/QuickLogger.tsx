import React, { useState, useEffect, FC, ChangeEvent, FormEvent } from 'react';
import { Activity, Clock, Zap, Target, Trash2, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { formatDateTime } from '../utils/dateUtils';
import { ActivityLog } from '../utils/apiService';

// ========== TYPE DEFINITIONS ==========

interface QuickLoggerProps {
  logs: ActivityLog[];
  setLogs: React.Dispatch<React.SetStateAction<ActivityLog[]>>;
}

type TimerStatus = 'idle' | 'running' | 'paused';

// ========== COMPONENT ==========

const QuickLogger: FC<QuickLoggerProps> = ({ logs, setLogs }) => {
  // Form state
  const [subject, setSubject] = useState<string>('');
  const [energy, setEnergy] = useState<number>(5);
  const [motivation, setMotivation] = useState<number>(5);
  const [focus, setFocus] = useState<number>(5);
  const [notes, setNotes] = useState<string>('');

  // Timer state
  const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Timer effect
  useEffect(() => {
    let interval: number | undefined;

    if (timerStatus === 'running' && startTime) {
      interval = window.setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerStatus, startTime]);

  const startTimer = (): void => {
    setStartTime(new Date());
    setTimerStatus('running');
    setElapsedSeconds(0);
  };

  const stopTimer = (): void => {
    setTimerStatus('idle');
    // Keep elapsed time for the log
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const saveLog = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!subject.trim()) {
      alert('Please enter a subject');
      return;
    }

    const now = new Date();
    const startDateTime = startTime ?? new Date(now.getTime() - elapsedSeconds * 1000);
    const duration = elapsedSeconds > 0 ? elapsedSeconds : 60; // Default 1 minute if no timer used

    const newLog: ActivityLog = {
      id: Date.now().toString(),
      startTime: startDateTime.toISOString(),
      endTime: now.toISOString(),
      subject: subject.trim(),
      duration,
      energy,
      motivation,
      focus,
      notes: notes.trim(),
    };

    setLogs(prev => [newLog, ...prev]);

    // Reset form
    setSubject('');
    setEnergy(5);
    setMotivation(5);
    setFocus(5);
    setNotes('');
    setTimerStatus('idle');
    setStartTime(null);
    setElapsedSeconds(0);
  };

  const deleteLog = (id: string): void => {
    if (confirm('Delete this log entry?')) {
      setLogs(prev => prev.filter(log => log.id !== id));
    }
  };

  const toggleExpand = (id: string): void => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const getMetricColor = (value: number): string => {
    if (value >= 8) return 'text-green-400';
    if (value >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Logger Form */}
      <div className="neural-card">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-neural-blue" />
          Quick Activity Logger
        </h2>

        {/* Timer */}
        <div className="mb-6 p-4 bg-neural-darker rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neural-blue" />
              <span className="font-medium">Timer</span>
            </div>
            <div className="text-3xl font-mono font-bold text-neural-blue">
              {formatTime(elapsedSeconds)}
            </div>
          </div>
          <div className="flex gap-2">
            {timerStatus === 'idle' && (
              <button
                type="button"
                onClick={startTimer}
                className="neural-button flex-1"
              >
                Start Timer
              </button>
            )}
            {timerStatus === 'running' && (
              <button
                type="button"
                onClick={stopTimer}
                className="neural-button-secondary flex-1"
              >
                Stop Timer
              </button>
            )}
          </div>
        </div>

        <form onSubmit={saveLog} className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium mb-2">
              What are you working on? *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
              placeholder="e.g., Studying calculus, Reading chapter 5, Coding project..."
              className="neural-input w-full"
              required
            />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Energy Level */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Energy Level: <span className={getMetricColor(energy)}>{energy}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={energy}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEnergy(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Motivation */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Motivation: <span className={getMetricColor(motivation)}>{motivation}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={motivation}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMotivation(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Focus */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-400" />
                Focus: <span className={getMetricColor(focus)}>{focus}/10</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={focus}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFocus(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Any observations, challenges, or insights..."
              className="neural-textarea min-h-[80px]"
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="neural-button w-full">
            <Activity className="w-4 h-4 inline mr-2" />
            Log Activity
          </button>
        </form>
      </div>

      {/* Activity Log History */}
      {logs.length > 0 && (
        <div className="neural-card">
          <h3 className="text-xl font-bold mb-4">Activity History ({logs.length})</h3>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4 p-4 bg-neural-darker rounded-lg border border-gray-800">
            <div>
              <div className="text-xs text-gray-500 mb-1">Avg Energy</div>
              <div className={`text-2xl font-bold ${getMetricColor(Math.round(logs.reduce((sum, log) => sum + log.energy, 0) / logs.length))}`}>
                {(logs.reduce((sum, log) => sum + log.energy, 0) / logs.length).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Avg Motivation</div>
              <div className={`text-2xl font-bold ${getMetricColor(Math.round(logs.reduce((sum, log) => sum + log.motivation, 0) / logs.length))}`}>
                {(logs.reduce((sum, log) => sum + log.motivation, 0) / logs.length).toFixed(1)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Avg Focus</div>
              <div className={`text-2xl font-bold ${getMetricColor(Math.round(logs.reduce((sum, log) => sum + (log.focus ?? 0), 0) / logs.length))}`}>
                {(logs.reduce((sum, log) => sum + (log.focus ?? 0), 0) / logs.length).toFixed(1)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-neural-purple transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center gap-3 flex-1 text-left group"
                  >
                    <Activity className="w-5 h-5 text-neural-blue flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-lg group-hover:text-neural-purple transition-colors">
                        {log.subject}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(log.startTime)} • {Math.floor(log.duration / 60)}m {log.duration % 60}s
                      </div>
                    </div>
                    {expandedLogId === log.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Metrics Preview */}
                <div className="flex gap-4 text-sm mb-2">
                  <div className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className={getMetricColor(log.energy)}>{log.energy}/10</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className={getMetricColor(log.motivation)}>{log.motivation}/10</span>
                  </div>
                  {log.focus !== undefined && (
                    <div className="flex items-center gap-1">
                      <Target className="w-4 h-4 text-purple-400" />
                      <span className={getMetricColor(log.focus)}>{log.focus}/10</span>
                    </div>
                  )}
                </div>

                {/* Expanded Content */}
                {expandedLogId === log.id && log.notes && (
                  <div className="pt-3 border-t border-gray-800 animate-slide-in">
                    <div className="text-sm font-medium text-gray-400 mb-1">Notes:</div>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{log.notes}</p>
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

export default QuickLogger;
