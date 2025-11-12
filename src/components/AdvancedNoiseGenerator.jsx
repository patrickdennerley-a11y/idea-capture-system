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
    this.intentionallyStopping = false; // Track if we're stopping intentionally (not an error)
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
    console.log('🎵 Generating PINK noise with params:', { frequency: params.frequency, depth: params.depth, rate: params.rate });
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
    console.log('🟤 Generating BROWN noise with params:', {
      frequency: params.frequency,
      depth: params.depth,
      rate: params.rate,
      volume: params.volume,
      integrationConst: params.integrationConst,
      leakFactor: params.leakFactor,
      bassBoost: params.bassBoost,
      rumbleIntensity: params.rumbleIntensity,
      driftRate: params.driftRate,
      bassBand: params.bassBand,
      midBand: params.midBand,
      trebleBand: params.trebleBand
    });

    // DIAGNOSTIC: Check for NaN values in params
    if (isNaN(params.depth) || isNaN(params.rate) || isNaN(params.volume)) {
      console.error('❌ BROWN NOISE: Invalid params detected!', {
        depthIsNaN: isNaN(params.depth),
        rateIsNaN: isNaN(params.rate),
        volumeIsNaN: isNaN(params.volume)
      });
    }

    const bufferSize = this.audioContext.sampleRate * 2; // 2 seconds buffer
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    const sampleRate = this.audioContext.sampleRate;

    // Use brown-specific parameters or fall back to defaults
    const integrationConst = params.integrationConst || 0.02;
    const leakFactor = params.leakFactor || 0.998;
    const bassBoost = params.bassBoost || 1.0;
    const rumbleIntensity = params.rumbleIntensity || 1.0;
    const driftRate = params.driftRate || 0.0;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;
      let driftPhase = 0; // For drift modulation
      let maxSample = 0;
      let minSample = 0;
      let sampleSum = 0;
      let nonZeroCount = 0;

      // Binaural offset: slightly different frequency for each channel
      const channelFreqOffset = channel === 0 ? -params.binauralOffset / 2 : params.binauralOffset / 2;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const time = i / sampleRate;

        // Brown noise = integrated white noise with parameter modulation
        const depthMod = params.depth / 100;
        const rateMod = params.rate / 10;

        // Add drift modulation for variety (oscillates the integration)
        const driftMod = driftRate > 0 ? Math.sin(driftPhase) * driftRate : 0;
        driftPhase += 0.001;

        // Integration with VARIABLE parameters (not hardcoded!)
        // integrationConst: 0.01-0.07 (how much white noise accumulates)
        // Higher rate = faster changes, higher depth = more integration
        lastOut = lastOut + (white * integrationConst * rateMod * depthMod * (1 + driftMod));

        // Apply VARIABLE leak factor (not hardcoded!)
        // leakFactor: 0.985-1.000 (how fast it returns to center)
        lastOut = lastOut * leakFactor;

        // Apply frequency modulation - adjusted for bass-focused range (50-1500 Hz)
        // Instead of 0.8-1.2 range, use frequency to shape the character
        const freqFactor = 0.5 + (params.frequency / 3000) * 0.5; // Adjusted for lower frequencies

        let brown = lastOut * freqFactor;

        // Apply VARIABLE bass boost (not hardcoded!)
        // bassBoost: 0.5-1.5x (additional bass multiplier)
        brown *= bassBoost;

        // Apply VARIABLE rumble intensity (not hardcoded!)
        // rumbleIntensity: 0.2-1.0 (sub-bass character)
        brown *= rumbleIntensity;

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

        // CRITICAL: Brown noise needs HIGHER gain to compensate for bass-heavy character
        // Normalized to 0.35 base multiplier (2.3x louder than pink)
        brown *= 0.35 * params.volume / 100;

        // Apply stereo width
        const pan = channel === 0 ? -params.stereoWidth / 200 : params.stereoWidth / 200;
        data[i] = brown * (1 + pan);

        // Track sample statistics for diagnostics
        if (Math.abs(data[i]) > 0.0001) nonZeroCount++;
        maxSample = Math.max(maxSample, data[i]);
        minSample = Math.min(minSample, data[i]);
        sampleSum += Math.abs(data[i]);
      }

      const avgSample = sampleSum / bufferSize;
      console.log(`🟤 Channel ${channel} brown noise stats:`, {
        maxSample: maxSample.toFixed(6),
        minSample: minSample.toFixed(6),
        avgAbsSample: avgSample.toFixed(6),
        nonZeroSamples: nonZeroCount,
        percentNonZero: ((nonZeroCount / bufferSize) * 100).toFixed(1) + '%'
      });

      if (maxSample === 0 && minSample === 0) {
        console.error(`❌ Channel ${channel}: ALL SAMPLES ARE ZERO - BROWN NOISE WILL BE SILENT!`);
      }
    }

    console.log('🟤 Brown noise buffer generation complete');
    return buffer;
  }

  async playNoise(type, params, volume = 50) {
    try {
      this.initialize(volume);

      // Check AudioContext state before playing
      if (this.audioContext.state === 'closed') {
        console.error('❌ Cannot play - AudioContext is closed');
        throw new Error('AudioContext is closed');
      }

      if (this.audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext suspended, resuming...');
        await this.audioContext.resume(); // CRITICAL: Must await resume!
        console.log('✅ AudioContext resumed, state:', this.audioContext.state);
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

      // Add handler for source node ending
      // Note: This fires when source stops (either intentionally or due to error)
      this.sourceNode.onended = () => {
        if (this.intentionallyStopping) {
          console.log('✓ Source node stopped as expected (switching variations)');
          this.intentionallyStopping = false;
        } else if (this.sourceNode.loop) {
          // If loop=true and we didn't intentionally stop, this IS unexpected
          console.error('❌ CRITICAL: Looped source node ended unexpectedly! This should not happen.');
          console.error('   This may indicate buffer issues or AudioContext problems.');
        }
      };

      // Create EQ filters
      this.createEQFilters(params);

      // For brown noise, add extra low-pass filter to emphasize bass character
      if (type === 'brown') {
        this.brownLowpass = this.audioContext.createBiquadFilter();
        this.brownLowpass.type = 'lowpass';
        this.brownLowpass.frequency.value = 1800; // Cut frequencies above 1800Hz (was 1200Hz - too aggressive)
        this.brownLowpass.Q.value = 0.7;
        console.log('🟤 Applied brown noise low-pass filter (1800Hz cutoff) for deeper bass');

        // Create audio chain with brown filter: source -> brownLowpass -> bass -> mid -> treble -> resonance -> gain -> destination
        this.sourceNode.connect(this.brownLowpass);
        this.brownLowpass.connect(this.bassFilter);
      } else {
        // Pink noise: standard chain without extra low-pass
        this.sourceNode.connect(this.bassFilter);
      }

      // Rest of chain (same for both):
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

      console.log(`🎚️ Attack envelope: ${(attackTime * 1000).toFixed(1)}ms fade-in`);

      // Warn if attack time seems excessive
      if (attackTime > 0.3) {
        console.warn(`⚠️ Long attack time: ${(attackTime * 1000).toFixed(0)}ms - may cause initial silence`);
      }

      // Note: Release will be applied in stop() method when explicitly stopped

      this.sourceNode.start(0);
      this.isPlaying = true;

      console.log(`🔊 Playing ${type} noise - Context: ${this.audioContext.state}, Volume: ${volume}%, Buffer: ${buffer.duration.toFixed(2)}s, Attack: ${(attackTime * 1000).toFixed(1)}ms`);
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
        const oldBrownLowpass = this.brownLowpass;
        const oldBassFilter = this.bassFilter;
        const oldMidFilter = this.midFilter;
        const oldTrebleFilter = this.trebleFilter;
        const oldResonanceFilter = this.resonanceFilter;

        // Clear current references immediately
        this.sourceNode = null;
        this.brownLowpass = null;
        this.bassFilter = null;
        this.midFilter = null;
        this.trebleFilter = null;
        this.resonanceFilter = null;

        // Schedule cleanup of OLD nodes after release time
        this.stopTimeout = setTimeout(() => {
          if (oldSourceNode) {
            try {
              this.intentionallyStopping = true; // Mark as intentional before stopping
              oldSourceNode.stop();
              oldSourceNode.disconnect();
            } catch (e) {
              // Node may already be stopped, ignore error
              this.intentionallyStopping = false;
            }
          }
          // Disconnect and clean up OLD filters
          if (oldBrownLowpass) {
            try { oldBrownLowpass.disconnect(); } catch (e) {}
          }
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
          this.intentionallyStopping = true; // Mark as intentional before stopping
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {
          // Node may already be stopped, ignore error
          this.intentionallyStopping = false;
        }
        this.sourceNode = null;

        // Disconnect and clean up filters immediately
        if (this.brownLowpass) {
          try { this.brownLowpass.disconnect(); } catch (e) {}
          this.brownLowpass = null;
        }
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

// Maximum Distance Algorithm - Now 20D Euclidean space (added 5 brown-specific parameters)
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

    // Standard parameters (7)
    bassBand: (params1.bassBand - params2.bassBand) / 1.0, // 0.5-1.5 range = 1.0 spread
    midBand: (params1.midBand - params2.midBand) / 1.0,
    trebleBand: (params1.trebleBand - params2.trebleBand) / 1.0,
    attackTime: (params1.attackTime - params2.attackTime) / 500,
    releaseTime: (params1.releaseTime - params2.releaseTime) / 500,
    modulationType: (modTypeToNum(params1.modulationType) - modTypeToNum(params2.modulationType)) / 1.0,
    binauralOffset: (params1.binauralOffset - params2.binauralOffset) / 20,
    resonanceFreq: (params1.resonanceFreq - params2.resonanceFreq) / 5000,
    resonanceQ: (params1.resonanceQ - params2.resonanceQ) / 4.5,

    // Brown-specific parameters (5) - expanding to 20D space
    integrationConst: ((params1.integrationConst || 0.02) - (params2.integrationConst || 0.02)) / 0.06, // 0.01-0.07 range
    leakFactor: ((params1.leakFactor || 0.998) - (params2.leakFactor || 0.998)) / 0.015, // 0.985-1.000 range
    bassBoost: ((params1.bassBoost || 1.0) - (params2.bassBoost || 1.0)) / 1.0, // 0.5-1.5 range
    rumbleIntensity: ((params1.rumbleIntensity || 1.0) - (params2.rumbleIntensity || 1.0)) / 0.8, // 0.2-1.0 range
    driftRate: ((params1.driftRate || 0.0) - (params2.driftRate || 0.0)) / 0.5, // 0.1-0.6 range
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

// Brown-noise-specific parameter generation for maximum perceptible variation
const generateBrownNoiseParameters = () => {
  // Mix seeded random with Math.random for extra entropy
  const rand = () => (seededRandom() + Math.random()) / 2;

  return {
    // Bass-focused frequency range (where brown noise lives)
    frequency: rand() * 1450 + 50, // 50-1500 Hz (bass range only)

    // Rate and depth affect drift character
    rate: rand() * 9.5 + 0.5, // 0.5-10 cycles/sec (same as pink)
    depth: rand() * 95 + 5, // 5-100% (same as pink)

    // Carrier for modulation
    carrier: rand() * 450 + 50, // 50-500 Hz (lower than pink)

    // Wider volume range for brown (bass needs more dynamic range)
    volume: rand() * 70 + 30, // 30-100% (wider than pink)

    // Lower filter cutoff for brown (emphasize bass)
    filterCutoff: rand() * 800 + 200, // 200-1000 Hz (much lower than pink)

    // Stereo width
    stereoWidth: rand() * 90 + 10, // 10-100% (same as pink)

    // Phase
    phase: rand() * 2 * Math.PI, // 0-2π (same as pink)

    // BROWN-SPECIFIC PARAMETERS (NEW)
    // Integration constant - how much white noise accumulates (affects "drift" speed)
    integrationConst: rand() * 0.06 + 0.01, // 0.01-0.07 (was hardcoded 0.02)

    // Leak factor - how fast it returns to center (affects settling behavior)
    leakFactor: rand() * 0.015 + 0.985, // 0.985-1.000 (was hardcoded 0.998)

    // Bass boost multiplier - additional bass emphasis
    bassBoost: rand() * 1.0 + 0.5, // 0.5-1.5x (NEW)

    // Rumble intensity - sub-bass character
    rumbleIntensity: rand() * 0.8 + 0.2, // 0.2-1.0 (NEW)

    // Drift rate - oscillation in the drift pattern
    driftRate: rand() * 0.5 + 0.1, // 0.1-0.6 (NEW)

    // EQ bands (same as pink)
    bassBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 20-250 Hz
    midBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 250-4000 Hz
    trebleBand: rand() * 1.0 + 0.5, // 0.5-1.5x multiplier for 4000-20000 Hz

    // Envelope (same as pink)
    attackTime: rand() * 500, // 0-500ms fade in
    releaseTime: rand() * 500, // 0-500ms fade out

    // Modulation type
    modulationType: ['AM', 'FM', 'none'][Math.floor(rand() * 3)],

    // Binaural offset
    binauralOffset: rand() * 20, // 0-20 Hz L/R frequency difference

    // Resonance peak (lower frequencies for brown)
    resonanceFreq: rand() * 1400 + 100, // 100-1500 Hz (lower than pink)
    resonanceQ: rand() * 4.5 + 0.5, // 0.5-5.0 Q factor
  };
};

const generateMaximallyDifferentVariation = (type, previousVariations, variationNumber) => {
  // Update seed with timestamp and variation number for extra randomness
  randomSeed = Date.now() + variationNumber * 1000;

  const sameTypeVariations = previousVariations.filter(v => v.type === type);

  if (sameTypeVariations.length === 0) {
    // First variation: use type-specific parameter generation
    const parameters = type === 'brown' ? generateBrownNoiseParameters() : generateRandomParameters();
    return {
      parameters: parameters,
      distanceFromPrevious: null,
      nearestVariation: null,
      nearestDistance: null,
    };
  }

  // Memory management: only use last 100 variations of same type for distance calculation
  const recentSameTypeVariations = sameTypeVariations.slice(-100);

  // Brown noise needs MORE candidates to escape local optimum (higher dimensionality)
  // Pink noise: 200 candidates, Brown noise: 500 candidates
  const candidateCount = type === 'brown' ? 500 : 200;

  // Generate candidates using TYPE-SPECIFIC parameter generation
  const candidates = [];
  for (let i = 0; i < candidateCount; i++) {
    // Reseed for each candidate to maximize diversity
    randomSeed = Date.now() + variationNumber * 1000 + i * 17; // Prime number offset

    // Use brown-specific parameters for brown noise, standard for pink
    if (type === 'brown') {
      candidates.push(generateBrownNoiseParameters());
    } else {
      candidates.push(generateRandomParameters());
    }
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

  console.log(`📊 ${type === 'brown' ? '🟤' : '🩷'} Generated variation #${variationNumber} from ${candidateCount} candidates, best distance: ${bestScore.minDistance.toFixed(2)}`);

  return {
    parameters: candidates[bestCandidateIndex],
    distanceFromPrevious: bestScore.minDistance,
    nearestVariation: nearestVariation.id,
    nearestDistance: bestScore.minDistance,
    avgDistanceToAll: bestScore.avgDistance,
  };
};

// Format time display with milliseconds for better bug detection
const formatTime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10); // Show centiseconds (0-99)
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export default function AdvancedNoiseGenerator({ audioContextRef, activeSession, setActiveSession }) {
  const [savedPlaylists, setSavedPlaylists] = useLocalStorage('neural-noise-playlists', []);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [audioContextState, setAudioContextState] = useState('checking');
  const [renderTick, setRenderTick] = useState(0); // Force re-renders for millisecond display

  // Settings - now persisted in localStorage with safety checks
  const [pinkDuration, setPinkDuration] = useLocalStorage('neural-noise-pink-duration', 3);
  const [brownDuration, setBrownDuration] = useLocalStorage('neural-noise-brown-duration', 3);
  const [silenceDelay, setSilenceDelay] = useLocalStorage('neural-noise-silence-delay', 0);
  const [useSameDuration, setUseSameDuration] = useLocalStorage('neural-noise-same-duration', true);
  const [durationType, setDurationType] = useLocalStorage('neural-noise-duration-type', 'indefinite');
  const [fixedTime, setFixedTime] = useLocalStorage('neural-noise-fixed-time', 60);
  const [fixedCycles, setFixedCycles] = useLocalStorage('neural-noise-fixed-cycles', 10);
  const [masterVolume, setMasterVolume] = useLocalStorage('neural-noise-master-volume', 50);

  const noiseGeneratorRef = useRef(null);
  const intervalRef = useRef(null);
  const masterVolumeRef = useRef(masterVolume); // Track volume for timer callbacks

  // Memory management: keep only last 100 variations for distance calculation
  const MAX_VARIATIONS_IN_MEMORY = 100;

  // Force re-renders every 100ms for millisecond display when session is active
  useEffect(() => {
    if (!activeSession || activeSession.isPaused || activeSession.completedAt) return;

    const renderInterval = setInterval(() => {
      setRenderTick(prev => prev + 1);
    }, 100);

    return () => clearInterval(renderInterval);
  }, [activeSession?.isPaused, activeSession?.completedAt, activeSession]);

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
    let lastDiagnosticLog = Date.now();
    const keepAliveInterval = setInterval(() => {
      if (activeSession && !activeSession.isPaused && noiseGeneratorRef.current?.audioContext) {
        const ctx = noiseGeneratorRef.current.audioContext;
        const gen = noiseGeneratorRef.current;

        // Update visual indicator
        setAudioContextState(ctx.state);

        // Diagnostic logging every 10 seconds for long-session debugging
        const now = Date.now();
        if (now - lastDiagnosticLog >= 10000) {
          console.log(`📊 Health check: Variations=${activeSession.variations.length}, State=${ctx.state}, Playing=${gen.isPlaying}, Node=${!!gen.sourceNode}`);
          lastDiagnosticLog = now;
        }

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
  const startGeneration = useCallback(async () => {
    console.log('🎬 Starting new session...');
    console.log('  AudioContext state:', audioContextRef.current?.state);
    console.log('  Sample rate:', audioContextRef.current?.sampleRate);
    console.log('  Current time:', audioContextRef.current?.currentTime);

    // Diagnostic: Check AudioContext health
    if (!audioContextRef.current) {
      console.error('❌ AudioContext not initialized!');
      alert('Audio system not initialized. Please refresh the page.');
      return;
    }

    if (audioContextRef.current.state === 'closed') {
      console.error('❌ AudioContext is closed! Recreating...');
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      // Recreate noise generator with new context
      noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
      console.log('✅ New AudioContext created');
    }

    if (audioContextRef.current.state === 'suspended') {
      console.warn('⚠️ AudioContext suspended, resuming...');
      await audioContextRef.current.resume();
      console.log('✅ AudioContext resumed');
    }

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
      totalElapsedMs: 0, // Track milliseconds for precise timing
      isIndefinite: durationType === 'indefinite',
      inDelay: false, // Track if we're in silence delay period
      settings: {
        pinkDuration,
        brownDuration: useSameDuration ? pinkDuration : brownDuration,
        silenceDelay, // Delay in minutes between variations
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

    // Play the noise (now async)
    if (noiseGeneratorRef.current) {
      try {
        await noiseGeneratorRef.current.playNoise('pink', variation.parameters, masterVolume);
        console.log('✅ Session started successfully');
      } catch (error) {
        console.error('❌ Failed to start audio:', error);
        alert(`Failed to start audio: ${error.message}`);
        setActiveSession(null);
        return;
      }
    }

    // Start timer
    startTimer(session);
  }, [pinkDuration, brownDuration, silenceDelay, useSameDuration, durationType, fixedTime, fixedCycles, masterVolume]);

  // Timer logic - runs every 100ms for millisecond precision
  const startTimer = useCallback((session) => {
    intervalRef.current = setInterval(() => {
      setActiveSession(prev => {
        if (!prev || prev.isPaused) return prev;

        const elapsedMs = Date.now() - prev.currentVariationStart;
        const elapsed = Math.floor(elapsedMs / 1000);
        // Calculate total elapsed from session start time, not from tick count
        const totalElapsedMs = Date.now() - prev.sessionStartTime;
        const newTotalElapsed = Math.floor(totalElapsedMs / 1000);

        // Handle delay period (silence between variations)
        if (prev.inDelay) {
          const delayDurationMs = prev.settings.silenceDelay * 60 * 1000; // Convert minutes to ms

          // Check if delay is complete (using milliseconds for precision)
          if (elapsedMs >= delayDurationMs) {
            // Exit delay, play next variation
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
                const nextDurationMin = nextType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration;
                noiseGeneratorRef.current.playNoise(nextType, variation.parameters, masterVolumeRef.current);
                console.log(`🔊 Delay complete, playing ${nextType} noise #${nextVariationNumber}, duration: ${(nextDurationMin * 60).toFixed(3)}s`);
              } catch (error) {
                console.error('❌ CRITICAL: Failed to play next variation:', error);
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
              totalElapsedMs: totalElapsedMs,
              inDelay: false, // Exit delay mode
            };
          }

          // Still in delay, just update timers
          return {
            ...prev,
            totalElapsed: newTotalElapsed,
            totalElapsedMs: totalElapsedMs,
          };
        }

        // Handle normal playback (not in delay)
        const currentDurationMs = (prev.currentType === 'pink'
          ? prev.settings.pinkDuration
          : prev.settings.brownDuration) * 60 * 1000; // Convert minutes to ms

        // Check if current variation is complete (using milliseconds for precision)
        if (elapsedMs >= currentDurationMs) {
          // TIMING DIAGNOSTIC: Log expected vs actual duration
          const durationMin = prev.currentType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration;
          console.log(`⏱️ Variation #${prev.currentVariation.variationNumber} complete:`);
          console.log(`   Expected: ${(currentDurationMs / 1000).toFixed(3)}s (${durationMin.toFixed(4)} min)`);
          console.log(`   Actual: ${(elapsedMs / 1000).toFixed(3)}s`);
          console.log(`   Difference: ${((elapsedMs - currentDurationMs) / 1000).toFixed(3)}s`);
          // Check if we have a delay configured
          if (prev.settings.silenceDelay > 0) {
            // Enter delay mode (silence)
            if (noiseGeneratorRef.current) {
              noiseGeneratorRef.current.stop();
              console.log(`🔇 Entering silence delay for ${prev.settings.silenceDelay * 60}s`);
            }

            return {
              ...prev,
              inDelay: true,
              currentVariationStart: Date.now(), // Reset timer for delay period
              totalElapsed: newTotalElapsed,
              totalElapsedMs: totalElapsedMs,
            };
          }

          // No delay configured, immediately switch to next variation
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
              const nextDurationMin = nextType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration;
              noiseGeneratorRef.current.playNoise(nextType, variation.parameters, masterVolumeRef.current);
              console.log(`🔊 Switched to ${nextType} noise #${nextVariationNumber}, duration: ${(nextDurationMin * 60).toFixed(3)}s`);
            } catch (error) {
              console.error('❌ CRITICAL: Failed to play next variation:', error);
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
            totalElapsedMs: totalElapsedMs,
          };
        }

        // Normal playback, just update timers
        return {
          ...prev,
          totalElapsed: newTotalElapsed,
          totalElapsedMs: totalElapsedMs,
        };
      });
    }, 100); // Update every 100ms for millisecond precision
  }, []);

  // Stop generation
  const stopGeneration = useCallback(() => {
    console.log('🛑 Stopping session...');
    console.log('  Variations played:', activeSession?.variations?.length || 0);
    console.log('  Total elapsed:', activeSession?.totalElapsedMs ? `${(activeSession.totalElapsedMs / 1000).toFixed(1)}s` : '0s');
    console.log('  AudioContext state:', audioContextRef.current?.state);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('  ✅ Timer cleared');
    }

    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.stop();
      console.log('  ✅ Audio stopped');
    }

    if (activeSession) {
      const completedSession = {
        ...activeSession,
        completedAt: new Date().toISOString(),
      };
      setActiveSession(completedSession);
      console.log('  ✅ Session marked complete');
    }

    console.log('🏁 Session stopped, AudioContext final state:', audioContextRef.current?.state);
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

  // Current progress - uses milliseconds for precise tracking
  const currentProgress = useMemo(() => {
    if (!activeSession || !activeSession.currentVariation) return null;

    // If in delay mode, show delay progress instead
    const currentDuration = activeSession.inDelay
      ? activeSession.settings.silenceDelay
      : (activeSession.currentType === 'pink'
          ? activeSession.settings.pinkDuration
          : activeSession.settings.brownDuration);

    const elapsedMs = Date.now() - activeSession.currentVariationStart;
    const totalMs = currentDuration * 60 * 1000;
    const remainingMs = totalMs - elapsedMs;

    return {
      elapsed: elapsedMs,
      total: totalMs,
      remaining: remainingMs,
      percentage: (elapsedMs / totalMs) * 100,
      isDelay: activeSession.inDelay,
    };
  }, [activeSession, renderTick]); // Update with renderTick for millisecond precision

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
                <div className={`w-3 h-3 rounded-full ${
                  activeSession.isPaused ? 'bg-yellow-400' :
                  activeSession.inDelay ? 'bg-gray-400 animate-pulse' :
                  'bg-green-400 animate-pulse'
                }`} />
                <div>
                  <h3 className="text-2xl font-bold">
                    {activeSession.inDelay ? (
                      <>🔇 Silence Delay</>
                    ) : (
                      <>{activeSession.currentType === 'pink' ? '🩷' : '🤎'} {activeSession.currentType === 'pink' ? 'Pink' : 'Brown'} Noise #{activeSession.currentVariation.variationNumber}</>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {activeSession.isPaused ? 'Paused' : activeSession.inDelay ? 'Silent Gap' : 'Playing'}
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
                  <span>
                    {currentProgress.isDelay ? 'Silence Delay: ' : 'Time in Current: '}
                    {formatTime(currentProgress.elapsed)} / {formatTime(currentProgress.total)}
                  </span>
                  <span>{formatTime(currentProgress.remaining)} remaining</span>
                </div>
                <div className="h-2 bg-neural-darker rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      currentProgress.isDelay
                        ? 'bg-gradient-to-r from-gray-600 to-gray-400'
                        : 'bg-gradient-to-r from-pink-500 to-amber-500'
                    }`}
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
                <span className="ml-2 font-bold">{formatTime(activeSession.totalElapsedMs || 0)}</span>
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
                <span className="ml-2 font-bold">{formatTime(activeSession.totalElapsedMs || (activeSession.totalElapsed * 1000))}</span>
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
                <div className="space-y-3">
                  {/* Quick Presets */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Quick Presets:</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => { setPinkDuration(0.00167); setBrownDuration(0.00167); }}
                        className="neural-button-secondary text-xs px-2 py-1"
                        title="0.1 seconds each"
                      >
                        0.1s (rapid)
                      </button>
                      <button
                        onClick={() => { setPinkDuration(0.0033); setBrownDuration(0.0033); }}
                        className="neural-button-secondary text-xs px-2 py-1"
                        title="0.2 seconds each"
                      >
                        0.2s (fast)
                      </button>
                      <button
                        onClick={() => { setPinkDuration(0.0167); setBrownDuration(0.0167); }}
                        className="neural-button-secondary text-xs px-2 py-1"
                        title="1 second each"
                      >
                        1s
                      </button>
                      <button
                        onClick={() => { setPinkDuration(0.0833); setBrownDuration(0.0833); }}
                        className="neural-button-secondary text-xs px-2 py-1"
                        title="5 seconds each"
                      >
                        5s
                      </button>
                      <button
                        onClick={() => { setPinkDuration(3); setBrownDuration(3); }}
                        className="neural-button-secondary text-xs px-2 py-1"
                        title="3 minutes each"
                      >
                        3min (default)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Pink Duration (minutes)
                        <span className="text-xs text-gray-500 ml-2">
                          = {(pinkDuration * 60).toFixed(2)}s
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        max="180"
                        step="0.001"
                        value={pinkDuration}
                        onChange={(e) => setPinkDuration(parseFloat(e.target.value))}
                        className="neural-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Brown Duration (minutes)
                        <span className="text-xs text-gray-500 ml-2">
                          = {(brownDuration * 60).toFixed(2)}s
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0.001"
                        max="180"
                        step="0.001"
                        value={brownDuration}
                        onChange={(e) => setBrownDuration(parseFloat(e.target.value))}
                        disabled={useSameDuration}
                        className="neural-input disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Silence Delay Setting */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Silence Delay (gap between variations)
                      <span className="text-xs text-gray-500 ml-2">
                        = {(silenceDelay * 60).toFixed(2)}s
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button
                        onClick={() => setSilenceDelay(0)}
                        className="neural-button-secondary text-xs px-2 py-1"
                      >
                        0s (none)
                      </button>
                      <button
                        onClick={() => setSilenceDelay(0.00167)}
                        className="neural-button-secondary text-xs px-2 py-1"
                      >
                        0.1s
                      </button>
                      <button
                        onClick={() => setSilenceDelay(0.0083)}
                        className="neural-button-secondary text-xs px-2 py-1"
                      >
                        0.5s
                      </button>
                      <button
                        onClick={() => setSilenceDelay(0.0167)}
                        className="neural-button-secondary text-xs px-2 py-1"
                      >
                        1s
                      </button>
                      <button
                        onClick={() => setSilenceDelay(0.0333)}
                        className="neural-button-secondary text-xs px-2 py-1"
                      >
                        2s
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      step="0.001"
                      value={silenceDelay}
                      onChange={(e) => setSilenceDelay(parseFloat(e.target.value) || 0)}
                      className="neural-input"
                      placeholder="Custom delay (minutes)"
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
              <li>• Uses Euclidean distance in 20-dimensional parameter space for brown noise (15D for pink)</li>
              <li>• Parameters: frequency, rate, depth, carrier, volume, filter, stereo, phase, EQ (3 bands), envelope, modulation, binaural offset, resonance + brown-specific (integration, leak, bass boost, rumble, drift)</li>
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
