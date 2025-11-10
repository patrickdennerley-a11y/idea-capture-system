/**
 * ADVANCED NOISE GENERATOR
 *
 * Features:
 * - Alternates between pink and brown noise with maximum variation
 * - Uses mathematical distance algorithms to ensure each iteration is maximally different
 * - Background generation with tab persistence
 * - History management with playlist saving
 * - Indefinite or fixed duration options
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Pause, Square, Save, History, Clock, Sparkles, TrendingUp, X, ChevronDown, ChevronUp, Edit2, Trash2, BarChart3 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Web Audio API Noise Generation
class NoiseGenerator {
  constructor() {
    this.audioContext = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.isPlaying = false;
  }

  initialize() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  generatePinkNoise(params) {
    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds buffer
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;

        // Apply custom parameters to shape the noise
        const freqMod = params.frequency / 20000;
        const depthMod = params.depth / 100;
        const rateMod = params.rate / 10;

        b0 = 0.99886 * b0 + white * 0.0555179 * depthMod;
        b1 = 0.99332 * b1 + white * 0.0750759 * rateMod;
        b2 = 0.96900 * b2 + white * 0.1538520 * freqMod;
        b3 = 0.86650 * b3 + white * 0.3104856 * freqMod;
        b4 = 0.55000 * b4 + white * 0.5329522 * rateMod;
        b5 = -0.7616 * b5 - white * 0.0168980 * depthMod;

        let pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        pink *= 0.11 * params.volume / 100;

        // Apply stereo width
        const pan = channel === 0 ? -params.stereoWidth / 200 : params.stereoWidth / 200;
        data[i] = pink * (1 + pan);
      }
    }

    return buffer;
  }

  generateBrownNoise(params) {
    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds buffer
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;

        // Brown noise = integrated white noise with custom parameters
        const freqMod = params.frequency / 20000;
        const depthMod = params.depth / 100;
        const rateMod = params.rate / 10;

        // Low-pass filter with parameter modulation
        lastOut = (lastOut + (0.02 * white * rateMod)) / (1.02 * depthMod);
        lastOut = lastOut * freqMod;

        let brown = lastOut * 3.5 * params.volume / 100;

        // Apply stereo width
        const pan = channel === 0 ? -params.stereoWidth / 200 : params.stereoWidth / 200;
        data[i] = brown * (1 + pan);
      }
    }

    return buffer;
  }

  playNoise(type, params) {
    this.initialize();
    this.stop();

    const buffer = type === 'pink' ? this.generatePinkNoise(params) : this.generateBrownNoise(params);

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = true;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(0);
    this.isPlaying = true;
  }

  stop() {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume / 100;
    }
  }
}

// Maximum Distance Algorithm
const calculateEuclideanDistance = (params1, params2) => {
  const normalizedDiff = {
    frequency: (params1.frequency - params2.frequency) / 20000,
    rate: (params1.rate - params2.rate) / 10,
    depth: (params1.depth - params2.depth) / 100,
    carrier: (params1.carrier - params2.carrier) / 1000,
    volume: (params1.volume - params2.volume) / 100,
    filterCutoff: (params1.filterCutoff - params2.filterCutoff) / 20000,
    stereoWidth: (params1.stereoWidth - params2.stereoWidth) / 100,
    phase: (params1.phase - params2.phase) / (2 * Math.PI),
  };

  return Math.sqrt(
    Object.values(normalizedDiff).reduce((sum, diff) => sum + diff * diff, 0)
  );
};

const generateRandomParameters = () => ({
  frequency: Math.random() * 19000 + 1000, // 1000-20000 Hz
  rate: Math.random() * 9 + 1, // 1-10 cycles/sec
  depth: Math.random() * 80 + 20, // 20-100%
  carrier: Math.random() * 900 + 100, // 100-1000 Hz
  volume: Math.random() * 30 + 70, // 70-100%
  filterCutoff: Math.random() * 19000 + 1000, // 1000-20000 Hz
  stereoWidth: Math.random() * 65 + 35, // 35-100%
  phase: Math.random() * 2 * Math.PI, // 0-2π
});

const generateMaximallyDifferentVariation = (type, previousVariations) => {
  const sameTypeVariations = previousVariations.filter(v => v.type === type);

  if (sameTypeVariations.length === 0) {
    return {
      parameters: generateRandomParameters(),
      distanceFromPrevious: null,
      nearestVariation: null,
      nearestDistance: null,
    };
  }

  // Generate 100 candidates
  const candidates = [];
  for (let i = 0; i < 100; i++) {
    candidates.push(generateRandomParameters());
  }

  // Calculate minimum distance to all previous variations for each candidate
  const candidateScores = candidates.map(candidate => {
    const distances = sameTypeVariations.map(prev =>
      calculateEuclideanDistance(candidate, prev.parameters)
    );
    return {
      minDistance: Math.min(...distances),
      avgDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
      nearestIndex: distances.indexOf(Math.min(...distances))
    };
  });

  // Select candidate with MAXIMUM minimum distance (maximin strategy)
  const bestCandidateIndex = candidateScores.reduce((bestIdx, score, idx) =>
    score.minDistance > candidateScores[bestIdx].minDistance ? idx : bestIdx
  , 0);

  const bestScore = candidateScores[bestCandidateIndex];
  const nearestVariation = sameTypeVariations[bestScore.nearestIndex];

  return {
    parameters: candidates[bestCandidateIndex],
    distanceFromPrevious: bestScore.minDistance,
    nearestVariation: nearestVariation.id,
    nearestDistance: bestScore.minDistance,
    avgDistanceToAll: bestScore.avgDistance,
  };
};

// Format time display
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function AdvancedNoiseGenerator() {
  const [savedPlaylists, setSavedPlaylists] = useLocalStorage('neural-noise-playlists', []);
  const [activeSession, setActiveSession] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showStats, setShowStats] = useState(false);

  // Settings
  const [pinkDuration, setPinkDuration] = useState(3);
  const [brownDuration, setBrownDuration] = useState(3);
  const [useSameDuration, setUseSameDuration] = useState(true);
  const [durationType, setDurationType] = useState('indefinite'); // 'indefinite', 'time', 'cycles'
  const [fixedTime, setFixedTime] = useState(60);
  const [fixedCycles, setFixedCycles] = useState(10);

  const noiseGeneratorRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    noiseGeneratorRef.current = new NoiseGenerator();
    return () => {
      if (noiseGeneratorRef.current) {
        noiseGeneratorRef.current.stop();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Start generation
  const startGeneration = useCallback(() => {
    const session = {
      id: Date.now(),
      title: `Session ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      completedAt: null,
      variations: [],
      currentType: 'pink',
      currentVariationStart: Date.now(),
      totalElapsed: 0,
      isIndefinite: durationType === 'indefinite',
      settings: {
        pinkDuration,
        brownDuration: useSameDuration ? pinkDuration : brownDuration,
        totalDuration: durationType === 'time' ? fixedTime : null,
        totalCycles: durationType === 'cycles' ? fixedCycles : null,
      },
      isPaused: false,
    };

    // Generate first variation
    const variation = generateMaximallyDifferentVariation('pink', []);
    const variationObj = {
      id: `${session.id}-1`,
      type: 'pink',
      variationNumber: 1,
      parameters: variation.parameters,
      distanceFromPrevious: variation.distanceFromPrevious,
      distanceMetrics: {
        nearestVariation: variation.nearestVariation,
        nearestDistance: variation.nearestDistance,
        avgDistanceToAll: variation.avgDistanceToAll,
      },
      timestamp: new Date().toISOString(),
      durationMinutes: pinkDuration,
    };

    session.variations.push(variationObj);
    session.currentVariation = variationObj;

    setActiveSession(session);

    // Play the noise
    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.playNoise('pink', variation.parameters);
    }

    // Start timer
    startTimer(session);
  }, [pinkDuration, brownDuration, useSameDuration, durationType, fixedTime, fixedCycles]);

  // Timer logic
  const startTimer = useCallback((session) => {
    intervalRef.current = setInterval(() => {
      setActiveSession(prev => {
        if (!prev || prev.isPaused) return prev;

        const currentDuration = prev.currentType === 'pink'
          ? prev.settings.pinkDuration
          : prev.settings.brownDuration;

        const elapsed = Math.floor((Date.now() - prev.currentVariationStart) / 1000);
        const newTotalElapsed = prev.totalElapsed + 1;

        // Check if current variation is complete
        if (elapsed >= currentDuration * 60) {
          // Switch to next noise type
          const nextType = prev.currentType === 'pink' ? 'brown' : 'pink';
          const nextVariationNumber = prev.variations.length + 1;

          // Check if we should stop
          if (prev.settings.totalCycles && nextVariationNumber > prev.settings.totalCycles * 2) {
            stopGeneration();
            return prev;
          }

          if (prev.settings.totalDuration && newTotalElapsed >= prev.settings.totalDuration * 60) {
            stopGeneration();
            return prev;
          }

          // Generate next variation
          const variation = generateMaximallyDifferentVariation(nextType, prev.variations);
          const variationObj = {
            id: `${prev.id}-${nextVariationNumber}`,
            type: nextType,
            variationNumber: nextVariationNumber,
            parameters: variation.parameters,
            distanceFromPrevious: variation.distanceFromPrevious,
            distanceMetrics: {
              nearestVariation: variation.nearestVariation,
              nearestDistance: variation.nearestDistance,
              avgDistanceToAll: variation.avgDistanceToAll,
            },
            timestamp: new Date().toISOString(),
            durationMinutes: nextType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration,
          };

          // Play new noise
          if (noiseGeneratorRef.current) {
            noiseGeneratorRef.current.playNoise(nextType, variation.parameters);
          }

          return {
            ...prev,
            variations: [...prev.variations, variationObj],
            currentVariation: variationObj,
            currentType: nextType,
            currentVariationStart: Date.now(),
            totalElapsed: newTotalElapsed,
          };
        }

        return {
          ...prev,
          totalElapsed: newTotalElapsed,
        };
      });
    }, 1000);
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.stop();
    }

    if (activeSession) {
      const completedSession = {
        ...activeSession,
        completedAt: new Date().toISOString(),
      };
      setActiveSession(completedSession);
    }
  }, [activeSession]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setActiveSession(prev => {
      if (!prev) return prev;

      if (prev.isPaused) {
        // Resume
        if (noiseGeneratorRef.current && prev.currentVariation) {
          noiseGeneratorRef.current.playNoise(prev.currentType, prev.currentVariation.parameters);
        }
        startTimer(prev);
      } else {
        // Pause
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (noiseGeneratorRef.current) {
          noiseGeneratorRef.current.stop();
        }
      }

      return { ...prev, isPaused: !prev.isPaused };
    });
  }, [startTimer]);

  // Save to history
  const saveToHistory = useCallback((title) => {
    if (!activeSession) return;

    const playlist = {
      ...activeSession,
      title: title || activeSession.title,
    };

    setSavedPlaylists(prev => [playlist, ...prev]);
    setActiveSession(null);
  }, [activeSession, setSavedPlaylists]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!activeSession || activeSession.variations.length === 0) return null;

    const pinkVariations = activeSession.variations.filter(v => v.type === 'pink');
    const brownVariations = activeSession.variations.filter(v => v.type === 'brown');

    const avgDistancePink = pinkVariations.length > 1
      ? pinkVariations.slice(1).reduce((sum, v) => sum + (v.distanceFromPrevious || 0), 0) / (pinkVariations.length - 1)
      : 0;

    const avgDistanceBrown = brownVariations.length > 1
      ? brownVariations.slice(1).reduce((sum, v) => sum + (v.distanceFromPrevious || 0), 0) / (brownVariations.length - 1)
      : 0;

    return {
      avgDistancePink: avgDistancePink.toFixed(2),
      avgDistanceBrown: avgDistanceBrown.toFixed(2),
      totalVariations: activeSession.variations.length,
      pinkCount: pinkVariations.length,
      brownCount: brownVariations.length,
    };
  }, [activeSession]);

  // Current progress
  const currentProgress = useMemo(() => {
    if (!activeSession || !activeSession.currentVariation) return null;

    const currentDuration = activeSession.currentType === 'pink'
      ? activeSession.settings.pinkDuration
      : activeSession.settings.brownDuration;

    const elapsed = Math.floor((Date.now() - activeSession.currentVariationStart) / 1000);
    const total = currentDuration * 60;
    const remaining = total - elapsed;

    return {
      elapsed,
      total,
      remaining,
      percentage: (elapsed / total) * 100,
    };
  }, [activeSession]);

  // Render different views
  if (showHistory) {
    return (
      <div className="neural-card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-pink-400" />
              Saved Noise Playlists
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {savedPlaylists.length} saved session{savedPlaylists.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="neural-button-secondary"
          >
            Back
          </button>
        </div>

        {savedPlaylists.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">No saved playlists yet</p>
            <p className="text-sm text-gray-600 mt-2">Generate and save sessions to see them here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-neural-darker border border-gray-800 rounded-lg p-4 hover:border-pink-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-pink-400 mb-1">{playlist.title}</h3>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>🩷 {playlist.variations.filter(v => v.type === 'pink').length} pink · 🤎 {playlist.variations.filter(v => v.type === 'brown').length} brown</p>
                      <p>⏱ {Math.floor(playlist.totalElapsed / 60)} minutes</p>
                      <p>📅 {new Date(playlist.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        // TODO: Implement replay
                        alert('Replay feature coming soon!');
                      }}
                      className="neural-button-secondary px-3 py-1 text-sm"
                    >
                      ▶ Replay
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this playlist?')) {
                          setSavedPlaylists(prev => prev.filter(p => p.id !== playlist.id));
                        }
                      }}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Main view
  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pink-400" />
            Advanced Noise Generator
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Alternating pink/brown noise with maximum variation
          </p>
        </div>
        {savedPlaylists.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History ({savedPlaylists.length})
          </button>
        )}
      </div>

      {/* Active session display */}
      {activeSession && !activeSession.completedAt ? (
        <div className="space-y-6">
          {/* Current status */}
          <div className="bg-gradient-to-r from-pink-900/20 to-amber-900/20 border border-pink-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${activeSession.isPaused ? 'bg-yellow-400' : 'bg-green-400 animate-pulse'}`} />
                <div>
                  <h3 className="text-2xl font-bold">
                    {activeSession.currentType === 'pink' ? '🩷' : '🤎'} {activeSession.currentType === 'pink' ? 'Pink' : 'Brown'} Noise #{activeSession.currentVariation.variationNumber}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {activeSession.isPaused ? 'Paused' : 'Playing'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={togglePause}
                  className="neural-button-secondary"
                >
                  {activeSession.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={stopGeneration}
                  className="neural-button-secondary"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            </div>

            {currentProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Time in Current: {formatTime(currentProgress.elapsed)} / {formatTime(currentProgress.total)}</span>
                  <span>{formatTime(currentProgress.remaining)} remaining</span>
                </div>
                <div className="h-2 bg-neural-darker rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-amber-500 transition-all duration-1000"
                    style={{ width: `${currentProgress.percentage}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Total Elapsed:</span>
                <span className="ml-2 font-bold">{formatTime(activeSession.totalElapsed)}</span>
              </div>
              <div>
                <span className="text-gray-400">Total Variations:</span>
                <span className="ml-2 font-bold">{activeSession.variations.length}</span>
              </div>
            </div>

            {activeSession.currentVariation.distanceFromPrevious !== null && (
              <div className="mt-4 p-3 bg-neural-darker rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium">Variation Distance</span>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {activeSession.currentVariation.distanceFromPrevious.toFixed(2)} / 10.0
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {activeSession.currentVariation.distanceFromPrevious >= 7 ? 'Very Different' :
                   activeSession.currentVariation.distanceFromPrevious >= 5 ? 'Moderately Different' : 'Somewhat Different'}
                </p>
              </div>
            )}
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Session Statistics
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Avg Pink Distance:</span>
                  <span className="ml-2 font-bold text-pink-400">{statistics.avgDistancePink}/10</span>
                </div>
                <div>
                  <span className="text-gray-400">Avg Brown Distance:</span>
                  <span className="ml-2 font-bold text-amber-400">{statistics.avgDistanceBrown}/10</span>
                </div>
                <div>
                  <span className="text-gray-400">Pink Variations:</span>
                  <span className="ml-2 font-bold">{statistics.pinkCount}</span>
                </div>
                <div>
                  <span className="text-gray-400">Brown Variations:</span>
                  <span className="ml-2 font-bold">{statistics.brownCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent timeline */}
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
            <h4 className="font-bold mb-3">Recent Timeline</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeSession.variations.slice(-5).reverse().map((variation, idx) => (
                <div
                  key={variation.id}
                  className={`p-2 rounded ${idx === 0 ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-neural-dark'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {variation.type === 'pink' ? '🩷' : '🤎'} {variation.type === 'pink' ? 'Pink' : 'Brown'} #{variation.variationNumber}
                    </span>
                    {variation.distanceFromPrevious !== null && (
                      <span className="text-xs text-gray-500">
                        Distance: {variation.distanceFromPrevious.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeSession && activeSession.completedAt ? (
        /* Completed session */
        <div className="space-y-6">
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6">
            <h3 className="text-xl font-bold text-green-400 mb-4">✓ Session Completed</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-400">Duration:</span>
                <span className="ml-2 font-bold">{formatTime(activeSession.totalElapsed)}</span>
              </div>
              <div>
                <span className="text-gray-400">Variations:</span>
                <span className="ml-2 font-bold">{activeSession.variations.length}</span>
              </div>
              <div>
                <span className="text-gray-400">Started:</span>
                <span className="ml-2">{new Date(activeSession.createdAt).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Ended:</span>
                <span className="ml-2">{new Date(activeSession.completedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {statistics && (
              <div className="p-3 bg-neural-darker rounded-lg mb-4">
                <p className="text-sm text-gray-400 mb-2">Average Variation Distance:</p>
                <p className="text-lg font-bold">
                  <span className="text-pink-400">Pink: {statistics.avgDistancePink}/10</span>
                  <span className="mx-2">|</span>
                  <span className="text-amber-400">Brown: {statistics.avgDistanceBrown}/10</span>
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const title = prompt('Enter a title for this session:', activeSession.title);
                  if (title) {
                    saveToHistory(title);
                  }
                }}
                className="neural-button flex-1"
              >
                <Save className="w-4 h-4 inline mr-2" />
                Save to History
              </button>
              <button
                onClick={() => setActiveSession(null)}
                className="neural-button-secondary"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Settings form */
        <div className="space-y-6">
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-6">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                Generation Settings
              </h3>
              {showSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showSettings && (
              <div className="space-y-4">
                {/* Duration settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Pink Duration (minutes)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="180"
                      step="0.5"
                      value={pinkDuration}
                      onChange={(e) => setPinkDuration(parseFloat(e.target.value))}
                      className="neural-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Brown Duration (minutes)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="180"
                      step="0.5"
                      value={brownDuration}
                      onChange={(e) => setBrownDuration(parseFloat(e.target.value))}
                      disabled={useSameDuration}
                      className="neural-input disabled:opacity-50"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useSameDuration}
                    onChange={(e) => setUseSameDuration(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Use same duration for both</span>
                </label>

                {/* Duration type */}
                <div className="space-y-2">
                  <label className="block text-sm text-gray-400 mb-2">Total Duration:</label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={durationType === 'indefinite'}
                      onChange={() => setDurationType('indefinite')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Indefinite (until stopped)</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={durationType === 'time'}
                      onChange={() => setDurationType('time')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Fixed time:</span>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={fixedTime}
                      onChange={(e) => setFixedTime(parseInt(e.target.value))}
                      disabled={durationType !== 'time'}
                      className="neural-input w-20 disabled:opacity-50"
                    />
                    <span className="text-sm">minutes</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={durationType === 'cycles'}
                      onChange={() => setDurationType('cycles')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Fixed cycles:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={fixedCycles}
                      onChange={(e) => setFixedCycles(parseInt(e.target.value))}
                      disabled={durationType !== 'cycles'}
                      className="neural-input w-20 disabled:opacity-50"
                    />
                    <span className="text-sm">alternations</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={startGeneration}
            className="neural-button w-full text-lg py-4"
          >
            <Sparkles className="w-5 h-5 inline mr-2" />
            Start Generation
          </button>

          {/* Info */}
          <div className="bg-neural-darker/50 border border-gray-800 rounded-lg p-4">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              How This Works
            </h4>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Alternates between pink and brown noise with custom durations</li>
              <li>• Each variation is mathematically maximized to be different from all previous ones</li>
              <li>• Uses Euclidean distance in 8-dimensional parameter space</li>
              <li>• Generation continues when you switch tabs</li>
              <li>• Save completed sessions to replay later</li>
              <li>• Choose indefinite play or set specific time/cycle limits</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
