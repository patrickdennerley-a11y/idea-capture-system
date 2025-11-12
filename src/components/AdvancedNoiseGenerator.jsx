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
  constructor(audioContext = null) {
    this.audioContext = audioContext;
    this.sourceNode = null;
    this.gainNode = null;
    this.bassFilter = null;
    this.midFilter = null;
    this.trebleFilter = null;
    this.resonanceFilter = null;
    this.currentParams = null; // Store current parameters for release envelope
    this.stopTimeout = null; // Track pending cleanup timeout
    this.isPlaying = false;
  }

  initialize(initialVolume = 50) {
    if (!this.audioContext) {
      throw new Error('AudioContext must be provided to NoiseGenerator');
    }

    // Check if AudioContext is in a usable state
    if (this.audioContext.state === 'closed') {
      console.error('AudioContext is closed - cannot initialize noise generator');
      throw new Error('AudioContext is closed');
    }

    // Resume if suspended (can happen on page load)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (!this.gainNode) {
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = initialVolume / 100; // Set initial volume
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  createEQFilters(params) {
    // Bass filter (20-250 Hz)
    this.bassFilter = this.audioContext.createBiquadFilter();
    this.bassFilter.type = 'peaking';
    this.bassFilter.frequency.value = 135; // Center of 20-250 Hz range
    this.bassFilter.Q.value = 0.7;
    this.bassFilter.gain.value = (params.bassBand - 1) * 12; // Convert 0.5-1.5x to -6 to +6 dB

    // Mid filter (250-4000 Hz)
    this.midFilter = this.audioContext.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000; // Center of 250-4000 Hz range
    this.midFilter.Q.value = 0.7;
    this.midFilter.gain.value = (params.midBand - 1) * 12;

    // Treble filter (4000-20000 Hz)
    this.trebleFilter = this.audioContext.createBiquadFilter();
    this.trebleFilter.type = 'peaking';
    this.trebleFilter.frequency.value = 8000; // Center of 4000-20000 Hz range
    this.trebleFilter.Q.value = 0.7;
    this.trebleFilter.gain.value = (params.trebleBand - 1) * 12;

    // Resonance peak filter
    this.resonanceFilter = this.audioContext.createBiquadFilter();
    this.resonanceFilter.type = 'peaking';
    this.resonanceFilter.frequency.value = params.resonanceFreq;
    this.resonanceFilter.Q.value = params.resonanceQ;
    this.resonanceFilter.gain.value = 6; // Fixed gain for resonance peak
  }

  generatePinkNoise(params) {
    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds buffer
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    const sampleRate = this.audioContext.sampleRate;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      // Binaural offset: slightly different frequency for each channel
      const channelFreqOffset = channel === 0 ? -params.binauralOffset / 2 : params.binauralOffset / 2;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const time = i / sampleRate;

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

        // Apply modulation
        if (params.modulationType === 'AM') {
          // Amplitude Modulation: modulate amplitude with carrier frequency
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = 0.5 + 0.5 * Math.sin(2 * Math.PI * carrierFreq * time);
          pink *= modulator;
        } else if (params.modulationType === 'FM') {
          // Frequency Modulation: modulate with carrier frequency
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = Math.sin(2 * Math.PI * carrierFreq * time);
          pink *= (1 + modulator * 0.3); // 30% modulation depth
        }
        // 'none' = no modulation applied

        // Normalized volume: 0.15 base multiplier for consistent loudness
        pink *= 0.15 * params.volume / 100;

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

    const sampleRate = this.audioContext.sampleRate;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;

      // Binaural offset: slightly different frequency for each channel
      const channelFreqOffset = channel === 0 ? -params.binauralOffset / 2 : params.binauralOffset / 2;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const time = i / sampleRate;

        // Brown noise = integrated white noise with parameter modulation
        const depthMod = params.depth / 100;
        const rateMod = params.rate / 10;

        // Integration with decay to prevent DC drift
        // Higher rate = faster changes, higher depth = more integration
        lastOut = lastOut * 0.996 + white * 0.004 * rateMod * depthMod;

        // Apply frequency modulation as a subtle filter
        const freqFactor = 0.5 + (params.frequency / 20000) * 0.5; // 0.5 to 1.0

        let brown = lastOut * freqFactor;

        // Apply modulation
        if (params.modulationType === 'AM') {
          // Amplitude Modulation: modulate amplitude with carrier frequency
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = 0.5 + 0.5 * Math.sin(2 * Math.PI * carrierFreq * time);
          brown *= modulator;
        } else if (params.modulationType === 'FM') {
          // Frequency Modulation: modulate with carrier frequency
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = Math.sin(2 * Math.PI * carrierFreq * time);
          brown *= (1 + modulator * 0.3); // 30% modulation depth
        }
        // 'none' = no modulation applied

        // Normalized volume: 0.15 base multiplier (matching pink noise)
        brown *= 0.15 * params.volume / 100;

        // Apply stereo width
        const pan = channel === 0 ? -params.stereoWidth / 200 : params.stereoWidth / 200;
        data[i] = brown * (1 + pan);
      }
    }

    return buffer;
  }

  playNoise(type, params, volume = 50) {
    try {
      this.initialize(volume);

      // Check AudioContext state before playing
      if (this.audioContext.state === 'closed') {
        console.error('❌ Cannot play - AudioContext is closed');
        throw new Error('AudioContext is closed');
      }

      if (this.audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext suspended, resuming...');
        this.audioContext.resume();
      }

      // Stop immediately without release envelope (we're switching variations)
      this.stop(false);

      // Store params for later use (e.g., release envelope)
      this.currentParams = params;

      const buffer = type === 'pink' ? this.generatePinkNoise(params) : this.generateBrownNoise(params);

      // Create source node
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.loop = true;

      // Add error handler for source node
      this.sourceNode.onended = () => {
        console.warn('⚠️ Source node ended unexpectedly');
      };

      // Create EQ filters
      this.createEQFilters(params);

      // Create audio chain: source -> bass -> mid -> treble -> resonance -> gain -> destination
      this.sourceNode.connect(this.bassFilter);
      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.resonanceFilter);
      this.resonanceFilter.connect(this.gainNode);

      // Apply envelope (attack)
      const now = this.audioContext.currentTime;
      const attackTime = params.attackTime / 1000; // Convert ms to seconds

      // Attack: fade in from 0 to target volume
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(volume / 100, now + attackTime);

      // Note: Release will be applied in stop() method when explicitly stopped

      this.sourceNode.start(0);
      this.isPlaying = true;

      console.log(`🔊 Playing ${type} noise - Context: ${this.audioContext.state}, Volume: ${volume}%, Buffer: ${buffer.duration.toFixed(2)}s`);
    } catch (error) {
      console.error(`❌ Error playing ${type} noise:`, error);
      throw error;
    }
  }

  stop(applyRelease = true) {
    // Clear any pending cleanup timeout
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    if (this.sourceNode) {
      if (applyRelease && this.currentParams && this.gainNode) {
        // Apply release envelope only when explicitly stopping (not when switching variations)
        const now = this.audioContext.currentTime;
        const releaseTime = this.currentParams.releaseTime / 1000; // Convert ms to seconds
        const currentGain = this.gainNode.gain.value;

        // Release: fade out from current volume to 0
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(currentGain, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

        // Store references to OLD nodes that need to be cleaned up
        const oldSourceNode = this.sourceNode;
        const oldBassFilter = this.bassFilter;
        const oldMidFilter = this.midFilter;
        const oldTrebleFilter = this.trebleFilter;
        const oldResonanceFilter = this.resonanceFilter;

        // Clear current references immediately
        this.sourceNode = null;
        this.bassFilter = null;
        this.midFilter = null;
        this.trebleFilter = null;
        this.resonanceFilter = null;

        // Schedule cleanup of OLD nodes after release time
        this.stopTimeout = setTimeout(() => {
          if (oldSourceNode) {
            try {
              oldSourceNode.stop();
              oldSourceNode.disconnect();
            } catch (e) {
              // Node may already be stopped, ignore error
            }
          }
          // Disconnect and clean up OLD filters
          if (oldBassFilter) {
            try { oldBassFilter.disconnect(); } catch (e) {}
          }
          if (oldMidFilter) {
            try { oldMidFilter.disconnect(); } catch (e) {}
          }
          if (oldTrebleFilter) {
            try { oldTrebleFilter.disconnect(); } catch (e) {}
          }
          if (oldResonanceFilter) {
            try { oldResonanceFilter.disconnect(); } catch (e) {}
          }
          this.stopTimeout = null;
        }, releaseTime * 1000);
      } else {
        // No release envelope - stop immediately (when switching variations)
        try {
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {
          // Node may already be stopped, ignore error
        }
        this.sourceNode = null;

        // Disconnect and clean up filters immediately
        if (this.bassFilter) {
          try { this.bassFilter.disconnect(); } catch (e) {}
          this.bassFilter = null;
        }
        if (this.midFilter) {
          try { this.midFilter.disconnect(); } catch (e) {}
          this.midFilter = null;
        }
        if (this.trebleFilter) {
          try { this.trebleFilter.disconnect(); } catch (e) {}
          this.trebleFilter = null;
        }
        if (this.resonanceFilter) {
          try { this.resonanceFilter.disconnect(); } catch (e) {}
          this.resonanceFilter = null;
        }
      }
    }
    this.isPlaying = false;
  }

  setVolume(volume) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume / 100;
    }
  }
}

// Maximum Distance Algorithm - 15D Euclidean space
const calculateEuclideanDistance = (params1, params2) => {
  // Normalize modulation type to numeric: AM=0, FM=0.5, none=1
  const modTypeToNum = (type) => type === 'AM' ? 0 : type === 'FM' ? 0.5 : 1;

  const normalizedDiff = {
    // Original 8 parameters
    frequency: (params1.frequency - params2.frequency) / 20000,
    rate: (params1.rate - params2.rate) / 10,
    depth: (params1.depth - params2.depth) / 100,
    carrier: (params1.carrier - params2.carrier) / 1000,
    volume: (params1.volume - params2.volume) / 100,
    filterCutoff: (params1.filterCutoff - params2.filterCutoff) / 20000,
    stereoWidth: (params1.stereoWidth - params2.stereoWidth) / 100,
    phase: (params1.phase - params2.phase) / (2 * Math.PI),

    // New 7 parameters (expanding to 15D space)
    bassBand: (params1.bassBand - params2.bassBand) / 1.0, // 0.5-1.5 range = 1.0 spread
    midBand: (params1.midBand - params2.midBand) / 1.0,
    trebleBand: (params1.trebleBand - params2.trebleBand) / 1.0,
    attackTime: (params1.attackTime - params2.attackTime) / 500,
    releaseTime: (params1.releaseTime - params2.releaseTime) / 500,
    modulationType: (modTypeToNum(params1.modulationType) - modTypeToNum(params2.modulationType)) / 1.0,
    binauralOffset: (params1.binauralOffset - params2.binauralOffset) / 20,
    resonanceFreq: (params1.resonanceFreq - params2.resonanceFreq) / 5000,
    resonanceQ: (params1.resonanceQ - params2.resonanceQ) / 4.5,
  };

  return Math.sqrt(
    Object.values(normalizedDiff).reduce((sum, diff) => sum + diff * diff, 0)
  );
};

// Seeded random number generator for reproducibility and extra randomness
let randomSeed = Date.now();
const seededRandom = () => {
  randomSeed = (randomSeed * 9301 + 49297) % 233280;
  return randomSeed / 233280;
};

const generateRandomParameters = () => {
  // Mix seeded random with Math.random for extra entropy
  const rand = () => (seededRandom() + Math.random()) / 2;

  return {
    // Original 8 parameters
    frequency: rand() * 19500 + 500, // 500-20000 Hz (wider range)
    rate: rand() * 9.5 + 0.5, // 0.5-10 cycles/sec (wider range)
    depth: rand() * 95 + 5, // 5-100% (much wider range)
    carrier: rand() * 950 + 50, // 50-1000 Hz (wider range)
    volume: rand() * 60 + 40, // 40-100% (much wider range, but not too quiet)
    filterCutoff: rand() * 19500 + 500, // 500-20000 Hz (wider range)
    stereoWidth: rand() * 90 + 10, // 10-100% (much wider range)
    phase: rand() * 2 * Math.PI, // 0-2π (unchanged)

    // New 7 independent parameters (expanding to 15D space)
    bassBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 20-250 Hz
    midBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 250-4000 Hz
    trebleBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 4000-20000 Hz
    attackTime: rand() * 500, // 0-500ms fade in
    releaseTime: rand() * 500, // 0-500ms fade out
    modulationType: ['AM', 'FM', 'none'][Math.floor(rand() * 3)], // Modulation type
    binauralOffset: rand() * 20, // 0-20 Hz L/R frequency difference
    resonanceFreq: rand() * 4900 + 100, // 100-5000 Hz peak frequency
    resonanceQ: rand() * 4.5 + 0.5, // 0.5-5.0 Q factor (peak width)
  };
};

const generateMaximallyDifferentVariation = (type, previousVariations, variationNumber) => {
  // Update seed with timestamp and variation number for extra randomness
  randomSeed = Date.now() + variationNumber * 1000;

  const sameTypeVariations = previousVariations.filter(v => v.type === type);

  if (sameTypeVariations.length === 0) {
    return {
      parameters: generateRandomParameters(),
      distanceFromPrevious: null,
      nearestVariation: null,
      nearestDistance: null,
    };
  }

  // Memory management: only use last 100 variations of same type for distance calculation
  const recentSameTypeVariations = sameTypeVariations.slice(-100);

  // Generate 200 candidates (increased from 100 for better diversity)
  const candidates = [];
  for (let i = 0; i < 200; i++) {
    // Reseed for each candidate to maximize diversity
    randomSeed = Date.now() + variationNumber * 1000 + i * 17; // Prime number offset
    candidates.push(generateRandomParameters());
  }

  // Calculate minimum distance to all recent previous variations for each candidate
  const candidateScores = candidates.map(candidate => {
    const distances = recentSameTypeVariations.map(prev =>
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
  const nearestVariation = recentSameTypeVariations[bestScore.nearestIndex];

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

export default function AdvancedNoiseGenerator({ audioContextRef, activeSession, setActiveSession }) {
  const [savedPlaylists, setSavedPlaylists] = useLocalStorage('neural-noise-playlists', []);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [audioContextState, setAudioContextState] = useState('checking');

  // Settings
  const [pinkDuration, setPinkDuration] = useState(3);
  const [brownDuration, setBrownDuration] = useState(3);
  const [useSameDuration, setUseSameDuration] = useState(true);
  const [durationType, setDurationType] = useState('indefinite'); // 'indefinite', 'time', 'cycles'
  const [fixedTime, setFixedTime] = useState(60);
  const [fixedCycles, setFixedCycles] = useState(10);
  const [masterVolume, setMasterVolume] = useState(50); // 0-100

  const noiseGeneratorRef = useRef(null);
  const intervalRef = useRef(null);
  const masterVolumeRef = useRef(masterVolume); // Track volume for timer callbacks

  // Memory management: keep only last 100 variations for distance calculation
  const MAX_VARIATIONS_IN_MEMORY = 100;

  useEffect(() => {
    // Only create noise generator if we have an audioContext and don't already have one
    if (audioContextRef?.current && !noiseGeneratorRef.current) {
      noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
      console.log('🔊 Noise generator created with app-level audio context');
    }

    // Important: Don't destroy audio on unmount!
    // The audioContext lives at app level, so we keep it running
    return () => {
      // Only clean up the interval, not the audio
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Audio continues playing even when component unmounts
    };
  }, [audioContextRef]);

  // Update volume when changed
  useEffect(() => {
    masterVolumeRef.current = masterVolume; // Update ref
    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.setVolume(masterVolume);
    }
  }, [masterVolume]);

  // Sync brown duration with pink when "use same duration" is enabled
  useEffect(() => {
    if (useSameDuration) {
      setBrownDuration(pinkDuration);
    }
  }, [useSameDuration, pinkDuration]);

  // Keep audio playing in background tabs - CRITICAL FOR FOCUS
  useEffect(() => {
    const handleVisibilityChange = () => {
      // When tab becomes visible or hidden, check audio context state
      if (noiseGeneratorRef.current && noiseGeneratorRef.current.audioContext) {
        const ctx = noiseGeneratorRef.current.audioContext;

        // Resume audio context if it's suspended (browser may auto-suspend in background)
        if (ctx.state === 'suspended') {
          ctx.resume().then(() => {
            console.log('🔊 Audio context resumed after visibility change');
          }).catch(err => {
            console.error('❌ Failed to resume audio context:', err);
            alert('Audio was paused by the browser. Click anywhere to resume.');
          });
        }
      }
    };

    // User interaction handler to resume suspended audio
    const handleUserInteraction = () => {
      if (noiseGeneratorRef.current?.audioContext?.state === 'suspended') {
        noiseGeneratorRef.current.audioContext.resume().then(() => {
          console.log('🔊 Audio resumed by user interaction');
        });
      }
    };

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for user interactions (click, key) to auto-resume if suspended
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    // Also check periodically in case browser suspends without visibility change
    const keepAliveInterval = setInterval(() => {
      if (activeSession && !activeSession.isPaused && noiseGeneratorRef.current?.audioContext) {
        const ctx = noiseGeneratorRef.current.audioContext;
        const gen = noiseGeneratorRef.current;

        // Update visual indicator
        setAudioContextState(ctx.state);

        // Check if audio is actually playing
        if (gen.isPlaying && !gen.sourceNode) {
          console.error('❌ CRITICAL: Audio marked as playing but no source node!');
          alert('⚠️ AUDIO STOPPED UNEXPECTEDLY!\n\nThe audio generator lost its connection.\n\nClick OK to continue. Consider refreshing if this happens repeatedly.');
        }

        if (ctx.state === 'suspended') {
          console.warn('⚠️ Audio context suspended, attempting resume...');
          ctx.resume().catch(err => console.error('Keep-alive resume failed:', err));
        }
      }
    }, 1000); // Check every 1 second (more aggressive)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      clearInterval(keepAliveInterval);
    };
  }, [activeSession]);

  // Start generation
  const startGeneration = useCallback(() => {
    const startTime = Date.now();
    const session = {
      id: startTime,
      title: `Session ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      completedAt: null,
      variations: [],
      currentType: 'pink',
      currentVariationStart: startTime,
      sessionStartTime: startTime, // Track absolute session start for accurate elapsed time
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
    const variation = generateMaximallyDifferentVariation('pink', [], 1);
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
      noiseGeneratorRef.current.playNoise('pink', variation.parameters, masterVolume);
    }

    // Start timer
    startTimer(session);
  }, [pinkDuration, brownDuration, useSameDuration, durationType, fixedTime, fixedCycles, masterVolume]);

  // Timer logic
  const startTimer = useCallback((session) => {
    intervalRef.current = setInterval(() => {
      setActiveSession(prev => {
        if (!prev || prev.isPaused) return prev;

        const currentDuration = prev.currentType === 'pink'
          ? prev.settings.pinkDuration
          : prev.settings.brownDuration;

        const elapsed = Math.floor((Date.now() - prev.currentVariationStart) / 1000);
        // Calculate total elapsed from session start time, not from tick count
        const newTotalElapsed = Math.floor((Date.now() - prev.sessionStartTime) / 1000);

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
          const variation = generateMaximallyDifferentVariation(nextType, prev.variations, nextVariationNumber);
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
            try {
              noiseGeneratorRef.current.playNoise(nextType, variation.parameters, masterVolumeRef.current);
            } catch (error) {
              console.error('❌ CRITICAL: Failed to play next variation:', error);
              // Alert user that audio stopped
              alert(`⚠️ AUDIO STOPPED!\n\nError: ${error.message}\n\nClick OK to attempt restart, or refresh the page.`);
              stopGeneration();
            }
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
        // Resume - adjust sessionStartTime to account for paused duration
        const pausedDuration = Date.now() - prev.pauseStartTime;
        const newSessionStartTime = prev.sessionStartTime + pausedDuration;
        const newCurrentVariationStart = prev.currentVariationStart + pausedDuration;

        if (noiseGeneratorRef.current && prev.currentVariation) {
          noiseGeneratorRef.current.playNoise(prev.currentType, prev.currentVariation.parameters, masterVolumeRef.current);
        }

        const resumed = {
          ...prev,
          sessionStartTime: newSessionStartTime,
          currentVariationStart: newCurrentVariationStart,
          isPaused: false,
          pauseStartTime: null,
        };

        startTimer(resumed);
        return resumed;
      } else {
        // Pause - record pause time
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (noiseGeneratorRef.current) {
          noiseGeneratorRef.current.stop();
        }

        return {
          ...prev,
          isPaused: true,
          pauseStartTime: Date.now(),
        };
      }
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
          {/* Audio Context Status Indicator - CRITICAL FOR ADHD FOCUS */}
          {audioContextRef?.current && (
            <div className={`px-3 py-2 rounded-lg border text-sm font-medium ${
              audioContextState === 'running'
                ? 'bg-green-950/30 border-green-800 text-green-400'
                : audioContextState === 'suspended'
                ? 'bg-yellow-950/30 border-yellow-800 text-yellow-400 animate-pulse'
                : 'bg-red-950/30 border-red-800 text-red-400'
            }`}>
              🔊 Audio: {audioContextState === 'running' ? '✓ Active & Playing' :
                       audioContextState === 'suspended' ? '⚠️ SUSPENDED - Click anywhere to resume!' :
                       audioContextState === 'closed' ? '❌ Closed - Refresh page' :
                       'Checking...'}
            </div>
          )}

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

            {/* Volume Control During Playback */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Volume</label>
                <span className="text-sm font-medium">{masterVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-neural-darker rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

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
                  {activeSession.currentVariation.distanceFromPrevious.toFixed(2)} / 3.87 ({Math.round((activeSession.currentVariation.distanceFromPrevious / 3.87) * 100)}%)
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {activeSession.currentVariation.distanceFromPrevious >= 1.2 ? 'Very Different' :
                   activeSession.currentVariation.distanceFromPrevious >= 0.8 ? 'Moderately Different' : 'Somewhat Different'}
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
                  <span className="ml-2 font-bold text-pink-400">{statistics.avgDistancePink}/3.87 ({Math.round((statistics.avgDistancePink / 3.87) * 100)}%)</span>
                </div>
                <div>
                  <span className="text-gray-400">Avg Brown Distance:</span>
                  <span className="ml-2 font-bold text-amber-400">{statistics.avgDistanceBrown}/3.87 ({Math.round((statistics.avgDistanceBrown / 3.87) * 100)}%)</span>
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
                  <span className="text-pink-400">Pink: {statistics.avgDistancePink}/3.87 ({Math.round((statistics.avgDistancePink / 3.87) * 100)}%)</span>
                  <span className="mx-2">|</span>
                  <span className="text-amber-400">Brown: {statistics.avgDistanceBrown}/3.87 ({Math.round((statistics.avgDistanceBrown / 3.87) * 100)}%)</span>
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

                {/* Volume Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">Master Volume</label>
                    <span className="text-sm font-medium">{masterVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Silent</span>
                    <span>Loud</span>
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
              <li>• Uses Euclidean distance in 15-dimensional parameter space (max 3.87, target 1.0-1.2)</li>
              <li>• Parameters: frequency, rate, depth, carrier, volume, filter, stereo, phase, EQ (3 bands), envelope, modulation, binaural offset, resonance</li>
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
