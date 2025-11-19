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

import { useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { Play, Pause, Square, Save, History, Clock, Sparkles, TrendingUp, X, ChevronDown, ChevronUp, Edit2, Trash2, BarChart3 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type NoiseType = 'pink' | 'brown' | 'gamma';
type ModulationType = 'AM' | 'FM' | 'none';
type AlternationMode = 'two-way' | 'three-way' | 'pink-only' | 'brown-only' | 'gamma-only';
type DurationType = 'indefinite' | 'time' | 'cycles';
type AudioContextState = 'suspended' | 'running' | 'closed' | 'checking';

interface NoiseParameters {
  // Original 8 parameters
  frequency: number;
  rate: number;
  depth: number;
  carrier: number;
  volume: number;
  filterCutoff: number;
  stereoWidth: number;
  phase: number;

  // Standard parameters (7)
  bassBand: number;
  midBand: number;
  trebleBand: number;
  attackTime: number;
  releaseTime: number;
  modulationType: ModulationType;
  binauralOffset: number;
  resonanceFreq: number;
  resonanceQ: number;

  // Brown-specific parameters (5)
  integrationConst?: number;
  leakFactor?: number;
  bassBoost?: number;
  rumbleIntensity?: number;
  driftRate?: number;
}

interface GammaVariation {
  carrierFreq: number;
}

interface VariationMetrics {
  nearestVariation: string | null;
  nearestDistance: number | null;
  avgDistanceToAll: number;
}

interface Variation {
  id: string;
  type: NoiseType;
  variationNumber: number;
  parameters: NoiseParameters | GammaVariation | null;
  distanceFromPrevious: number | null;
  distanceMetrics: VariationMetrics | null;
  timestamp: string;
  durationMinutes: number;
}

interface SessionSettings {
  pinkDuration: number;
  brownDuration: number;
  gammaDuration: number;
  silenceDelay: number;
  totalDuration: number | null;
  totalCycles: number | null;
  alternationMode: AlternationMode;
}

interface Session {
  id: number;
  title: string;
  createdAt: string;
  completedAt: string | null;
  variations: Variation[];
  currentType: NoiseType;
  currentVariation?: Variation;
  currentVariationStart: number;
  sessionStartTime: number;
  totalElapsed: number;
  totalElapsedMs: number;
  isIndefinite: boolean;
  inDelay: boolean;
  settings: SessionSettings;
  isPaused: boolean;
  pauseStartTime?: number;
  gammaWasEnabled?: boolean;
}

interface Statistics {
  avgDistancePink: string;
  avgDistanceBrown: string;
  totalVariations: number;
  pinkCount: number;
  brownCount: number;
}

interface CurrentProgress {
  elapsed: number;
  total: number;
  remaining: number;
  percentage: number;
  isDelay: boolean;
}

interface AdvancedNoiseGeneratorProps {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  activeSession: Session | null;
  setActiveSession: (session: Session | null) => void;
}

// ============================================================================
// WEB AUDIO API NOISE GENERATOR CLASS
// ============================================================================

class NoiseGenerator {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSource | null = null;
  private gainNode: GainNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private resonanceFilter: BiquadFilterNode | null = null;
  private brownLowpass: BiquadFilterNode | null = null;
  private currentParams: NoiseParameters | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;
  private isPlaying: boolean = false;
  private intentionallyStopping: boolean = false;

  // Gamma wave properties
  private gammaSource: AudioBufferSource | null = null;
  private gammaGain: GainNode | null = null;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  initialize(initialVolume: number = 50): void {
    if (!this.audioContext) {
      throw new Error('AudioContext must be provided to NoiseGenerator');
    }

    if (this.audioContext.state === 'closed') {
      console.error('AudioContext is closed - cannot initialize noise generator');
      throw new Error('AudioContext is closed');
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    if (!this.gainNode) {
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = initialVolume / 100;
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  createEQFilters(params: NoiseParameters): void {
    // Bass filter (20-250 Hz)
    this.bassFilter = this.audioContext.createBiquadFilter();
    this.bassFilter.type = 'peaking';
    this.bassFilter.frequency.value = 135;
    this.bassFilter.Q.value = 0.7;
    this.bassFilter.gain.value = (params.bassBand - 1) * 12;

    // Mid filter (250-4000 Hz)
    this.midFilter = this.audioContext.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 0.7;
    this.midFilter.gain.value = (params.midBand - 1) * 12;

    // Treble filter (4000-20000 Hz)
    this.trebleFilter = this.audioContext.createBiquadFilter();
    this.trebleFilter.type = 'peaking';
    this.trebleFilter.frequency.value = 8000;
    this.trebleFilter.Q.value = 0.7;
    this.trebleFilter.gain.value = (params.trebleBand - 1) * 12;

    // Resonance peak filter
    this.resonanceFilter = this.audioContext.createBiquadFilter();
    this.resonanceFilter.type = 'peaking';
    this.resonanceFilter.frequency.value = params.resonanceFreq;
    this.resonanceFilter.Q.value = params.resonanceQ;
    this.resonanceFilter.gain.value = 6;
  }

  generatePinkNoise(params: NoiseParameters): AudioBuffer {
    console.log('🎵 Generating PINK noise with params:', { frequency: params.frequency, depth: params.depth, rate: params.rate });
    const bufferSize = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(2, bufferSize, this.audioContext.sampleRate);

    const sampleRate = this.audioContext.sampleRate;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      const channelFreqOffset = channel === 0 ? -params.binauralOffset / 2 : params.binauralOffset / 2;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const time = i / sampleRate;

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

        if (params.modulationType === 'AM') {
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = 0.5 + 0.5 * Math.sin(2 * Math.PI * carrierFreq * time);
          pink *= modulator;
        } else if (params.modulationType === 'FM') {
          const carrierFreq = params.carrier + channelFreqOffset;
          const modulator = Math.sin(2 * Math.PI * carrierFreq * time);
          pink *= (1 + modulator * 0.3);
        }

        pink *= 0.15 * params.volume / 100;

        const pan = channel === 0 ? -params.stereoWidth / 200 : params.stereoWidth / 200;
        data[i] = pink * (1 + pan);
      }
    }

    return buffer;
  }

  generateBrownNoise(params: NoiseParameters): AudioBuffer {
    console.log('═══ BROWN NOISE DEBUG START ═══');
    console.log('PARAMS RECEIVED:', JSON.stringify(params, null, 2));

    if (!this.audioContext) {
      console.error('❌ FATAL: audioContext is null');
      throw new Error('AudioContext is null');
    }

    console.log('AudioContext state:', this.audioContext.state);
    console.log('AudioContext sample rate:', this.audioContext.sampleRate);

    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = Math.floor(sampleRate * 2);

    console.log('Sample rate:', sampleRate);
    console.log('Duration: 2 seconds');
    console.log('Buffer size:', bufferSize);

    const buffer = this.audioContext.createBuffer(2, bufferSize, sampleRate);

    const integrationConst = params.integrationConst || 0.02;
    const leakFactor = params.leakFactor || 0.998;
    const bassBoost = params.bassBoost || 1.0;
    const rumbleIntensity = params.rumbleIntensity || 1.0;
    const driftRate = params.driftRate || 0.0;
    const frequency = params.frequency || 1000;
    const volume = params.volume || 50;
    const depth = params.depth || 50;
    const rate = params.rate || 5;
    const stereoWidth = params.stereoWidth || 50;

    console.log('CALCULATED VALUES:', {
      integrationConst,
      leakFactor,
      bassBoost,
      rumbleIntensity,
      driftRate,
      frequency,
      volume,
      depth,
      rate,
      stereoWidth
    });

    let globalMaxValue = 0;
    let globalNonZeroCount = 0;
    let totalSamples = 0;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let lastOut = 0;
      let driftPhase = 0;

      const channelFreqOffset = channel === 0 ? -(params.binauralOffset || 0) / 2 : (params.binauralOffset || 0) / 2;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const time = i / sampleRate;

        const depthMod = depth / 100;
        const rateMod = rate / 10;

        const driftMod = driftRate > 0 ? Math.sin(driftPhase) * driftRate : 0;
        driftPhase += 0.001;

        lastOut = lastOut + (white * integrationConst * rateMod * depthMod * (1 + driftMod));
        lastOut = lastOut * leakFactor;

        const freqFactor = 0.5 + (frequency / 3000) * 0.5;
        let brown = lastOut * freqFactor;

        brown *= bassBoost;
        brown *= (0.6 + rumbleIntensity * 0.4);

        if (params.modulationType === 'AM') {
          const carrierFreq = (params.carrier || 250) + channelFreqOffset;
          const modulator = 0.5 + 0.5 * Math.sin(2 * Math.PI * carrierFreq * time);
          brown *= modulator;
        } else if (params.modulationType === 'FM') {
          const carrierFreq = (params.carrier || 250) + channelFreqOffset;
          const modulator = Math.sin(2 * Math.PI * carrierFreq * time);
          brown *= (1 + modulator * 0.3);
        }

        brown *= 10.0 * volume / 100;

        const pan = channel === 0 ? -stereoWidth / 200 : stereoWidth / 200;
        data[i] = brown * (1 + pan);

        totalSamples++;
        const absValue = Math.abs(data[i]);
        if (absValue > 0.0001) {
          globalNonZeroCount++;
          globalMaxValue = Math.max(globalMaxValue, absValue);
        }
      }
    }

    console.log('═══ BROWN NOISE GENERATION STATS ═══');
    console.log('Total samples:', totalSamples);
    console.log('Non-zero samples:', globalNonZeroCount);
    console.log('Percent non-zero:', (globalNonZeroCount / totalSamples * 100).toFixed(2) + '%');
    console.log('Max absolute value:', globalMaxValue.toFixed(6));

    if (globalMaxValue === 0) {
      console.error('❌ CRITICAL: ALL SAMPLES ARE ZERO - NO AUDIO WILL PLAY');
    } else if (globalMaxValue < 0.001) {
      console.warn('⚠️ WARNING: Samples are very quiet (max:', globalMaxValue, ')');
    } else {
      console.log('✅ Audio samples look good (max:', globalMaxValue, ')');
    }

    console.log('═══ BROWN NOISE DEBUG END ═══');
    return buffer;
  }

  async playNoise(type: NoiseType, params: NoiseParameters, volume: number = 50): Promise<void> {
    try {
      console.log('═══ PLAY NOISE DEBUG START ═══');
      console.log('Type:', type);
      console.log('Volume param:', volume);
      console.log('Params object keys:', Object.keys(params));

      this.initialize(volume);

      if (this.audioContext.state === 'closed') {
        console.error('❌ Cannot play - AudioContext is closed');
        throw new Error('AudioContext is closed');
      }

      if (this.audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext suspended, resuming...');
        await this.audioContext.resume();
        console.log('✅ AudioContext resumed, state:', this.audioContext.state);
      }

      this.stop(false);
      this.currentParams = params;

      console.log(`→ Generating ${type} noise buffer...`);
      const buffer = type === 'pink' ? this.generatePinkNoise(params) : this.generateBrownNoise(params);

      if (!buffer) {
        console.error('❌ BUFFER IS NULL - CANNOT PLAY');
        throw new Error('Buffer generation returned null');
      }

      console.log('✓ Buffer received:', {
        channels: buffer.numberOfChannels,
        length: buffer.length,
        duration: buffer.duration.toFixed(2) + 's',
        sampleRate: buffer.sampleRate
      });

      const channel0 = buffer.getChannelData(0);
      let maxInBuffer = 0;
      let nonZeroInBuffer = 0;
      const samplesToCheck = Math.min(1000, channel0.length);
      for (let i = 0; i < samplesToCheck; i++) {
        const abs = Math.abs(channel0[i]);
        if (abs > 0.0001) nonZeroInBuffer++;
        maxInBuffer = Math.max(maxInBuffer, abs);
      }
      console.log(`Buffer sample check (first ${samplesToCheck} samples):`, {
        max: maxInBuffer.toFixed(6),
        nonZero: nonZeroInBuffer,
        percentNonZero: ((nonZeroInBuffer / samplesToCheck) * 100).toFixed(1) + '%'
      });

      if (maxInBuffer === 0) {
        console.error('❌❌❌ BUFFER CONTAINS ONLY ZEROS - THIS IS WHY YOU HEAR NOTHING ❌❌❌');
      }

      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = buffer;
      this.sourceNode.loop = true;

      const currentNode = this.sourceNode;
      this.sourceNode.onended = () => {
        if (this.intentionallyStopping) {
          console.log('✓ Source node stopped as expected (switching variations)');
          this.intentionallyStopping = false;
        } else if (currentNode.loop && currentNode === this.sourceNode) {
          console.error('❌ CRITICAL: Looped source node ended unexpectedly! This should not happen.');
        }
      };

      this.createEQFilters(params);

      if (type === 'brown') {
        this.brownLowpass = this.audioContext.createBiquadFilter();
        this.brownLowpass.type = 'lowpass';
        this.brownLowpass.frequency.value = 1800;
        this.brownLowpass.Q.value = 0.7;
        console.log('🟤 Applied brown noise low-pass filter (1800Hz cutoff) for deeper bass');

        this.sourceNode.connect(this.brownLowpass);
        this.brownLowpass.connect(this.bassFilter!);
      } else {
        this.sourceNode.connect(this.bassFilter!);
      }

      this.bassFilter!.connect(this.midFilter!);
      this.midFilter!.connect(this.trebleFilter!);
      this.trebleFilter!.connect(this.resonanceFilter!);
      this.resonanceFilter!.connect(this.gainNode!);

      console.log('✓ Audio node chain connected:', type === 'brown' ?
        'source → brownLowpass → bass → mid → treble → resonance → gain → destination' :
        'source → bass → mid → treble → resonance → gain → destination'
      );

      console.log('GainNode state:', {
        exists: !!this.gainNode,
        currentValue: this.gainNode?.gain?.value,
        connected: !!this.gainNode
      });

      const now = this.audioContext.currentTime;
      const attackTime = params.attackTime / 1000;

      this.gainNode!.gain.cancelScheduledValues(now);
      this.gainNode!.gain.setValueAtTime(0, now);
      this.gainNode!.gain.linearRampToValueAtTime(volume / 100, now + attackTime);

      console.log(`🎚️ Attack envelope: ${(attackTime * 1000).toFixed(1)}ms fade-in, target gain: ${(volume / 100).toFixed(2)}`);

      if (attackTime > 0.15) {
        console.warn(`⚠️ Long attack time: ${(attackTime * 1000).toFixed(0)}ms - may cause initial silence`);
      }

      console.log('→ Starting playback NOW...');
      this.sourceNode.start(0);
      this.isPlaying = true;

      console.log(`✅ PLAYBACK STARTED - ${type} noise - Context: ${this.audioContext.state}, Volume: ${volume}%, Buffer: ${buffer.duration.toFixed(2)}s, Attack: ${(attackTime * 1000).toFixed(1)}ms`);
      console.log('═══ PLAY NOISE DEBUG END ═══');
    } catch (error) {
      console.error(`❌ Error playing ${type} noise:`, error);
      throw error;
    }
  }

  stop(applyRelease: boolean = true): void {
    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    if (this.sourceNode) {
      if (applyRelease && this.currentParams && this.gainNode) {
        const now = this.audioContext.currentTime;
        const releaseTime = this.currentParams.releaseTime / 1000;
        const currentGain = this.gainNode.gain.value;

        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(currentGain, now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + releaseTime);

        const oldSourceNode = this.sourceNode;
        const oldBrownLowpass = this.brownLowpass;
        const oldBassFilter = this.bassFilter;
        const oldMidFilter = this.midFilter;
        const oldTrebleFilter = this.trebleFilter;
        const oldResonanceFilter = this.resonanceFilter;

        this.sourceNode = null;
        this.brownLowpass = null;
        this.bassFilter = null;
        this.midFilter = null;
        this.trebleFilter = null;
        this.resonanceFilter = null;

        this.stopTimeout = setTimeout(() => {
          if (oldSourceNode) {
            try {
              this.intentionallyStopping = true;
              oldSourceNode.stop();
              oldSourceNode.disconnect();
            } catch (e) {
              this.intentionallyStopping = false;
            }
          }
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
        try {
          this.intentionallyStopping = true;
          this.sourceNode.stop();
          this.sourceNode.disconnect();
        } catch (e) {
          this.intentionallyStopping = false;
        }
        this.sourceNode = null;

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

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = volume / 100;
    }
  }

  generateGammaWave(duration: number, carrierFreq: number = 200, gammaOffset: number = 40): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(2, bufferSize, sampleRate);

    const leftFreq = carrierFreq;
    const rightFreq = carrierFreq + gammaOffset;

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const freq = channel === 0 ? leftFreq : rightFreq;

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(2 * Math.PI * freq * i / sampleRate) * 0.3;
      }
    }

    return buffer;
  }

  startGammaWave(carrierFreq: number, gammaOffset: number, volume: number): void {
    if (this.gammaSource) {
      this.stopGammaWave();
    }

    const gammaBuffer = this.generateGammaWave(10, carrierFreq, gammaOffset);

    this.gammaSource = this.audioContext.createBufferSource();
    this.gammaSource.buffer = gammaBuffer;
    this.gammaSource.loop = true;

    this.gammaGain = this.audioContext.createGain();
    this.gammaGain.gain.value = volume / 100;

    this.gammaSource.connect(this.gammaGain);
    this.gammaGain.connect(this.audioContext.destination);
    this.gammaSource.start();

    console.log(`🌊 Started 40Hz gamma wave (${carrierFreq}Hz carrier, ${volume}% volume)`);
  }

  stopGammaWave(): void {
    if (this.gammaSource) {
      try {
        this.gammaSource.stop();
        this.gammaSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.gammaSource = null;
      console.log('🛑 Stopped gamma wave');
    }
    if (this.gammaGain) {
      try {
        this.gammaGain.disconnect();
      } catch (e) {}
      this.gammaGain = null;
    }
  }

  setGammaVolume(volume: number): void {
    if (this.gammaGain) {
      this.gammaGain.gain.value = volume / 100;
    }
  }

  async playGamma(carrierFreq: number, gammaOffset: number, volume: number, durationMinutes: number): Promise<void> {
    console.log(`🌊 Playing alternating gamma wave: ${carrierFreq}Hz carrier, ${gammaOffset}Hz offset, ${volume}% volume, ${durationMinutes.toFixed(4)} min (${(durationMinutes * 60).toFixed(2)}s)`);

    const durationSeconds = durationMinutes * 60;

    if (this.sourceNode) {
      this.intentionallyStopping = true;
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.sourceNode = null;
    }

    [this.bassFilter, this.midFilter, this.trebleFilter, this.resonanceFilter].forEach(filter => {
      if (filter) {
        try {
          filter.disconnect();
        } catch (e) {}
      }
    });
    this.bassFilter = this.midFilter = this.trebleFilter = this.resonanceFilter = null;

    const gammaBuffer = this.generateGammaWave(durationSeconds, carrierFreq, gammaOffset);

    const source = this.audioContext.createBufferSource();
    source.buffer = gammaBuffer;
    source.loop = false;

    const gain = this.audioContext.createGain();
    gain.gain.value = volume / 100;

    const attackTime = (Math.random() * 80 + 20) / 1000;
    gain.gain.setValueAtTime(0, this.audioContext.currentTime);
    gain.gain.linearRampToValueAtTime(volume / 100, this.audioContext.currentTime + attackTime);

    source.connect(gain);
    gain.connect(this.audioContext.destination);

    this.sourceNode = source;
    this.gainNode = gain;
    this.isPlaying = true;
    this.intentionallyStopping = false;

    source.start(0);

    console.log(`✅ Alternating gamma playback started (duration: ${durationSeconds.toFixed(2)}s)`);

    return new Promise((resolve) => {
      source.onended = () => {
        console.log('🎵 Alternating gamma playback ended');
        this.isPlaying = false;
        resolve();
      };
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const calculateEuclideanDistance = (params1: NoiseParameters, params2: NoiseParameters): number => {
  const modTypeToNum = (type: ModulationType): number => type === 'AM' ? 0 : type === 'FM' ? 0.5 : 1;

  const normalizedDiff = {
    frequency: (params1.frequency - params2.frequency) / 20000,
    rate: (params1.rate - params2.rate) / 10,
    depth: (params1.depth - params2.depth) / 100,
    carrier: (params1.carrier - params2.carrier) / 1000,
    volume: (params1.volume - params2.volume) / 100,
    filterCutoff: (params1.filterCutoff - params2.filterCutoff) / 20000,
    stereoWidth: (params1.stereoWidth - params2.stereoWidth) / 100,
    phase: (params1.phase - params2.phase) / (2 * Math.PI),
    bassBand: (params1.bassBand - params2.bassBand) / 1.0,
    midBand: (params1.midBand - params2.midBand) / 1.0,
    trebleBand: (params1.trebleBand - params2.trebleBand) / 1.0,
    attackTime: (params1.attackTime - params2.attackTime) / 500,
    releaseTime: (params1.releaseTime - params2.releaseTime) / 500,
    modulationType: (modTypeToNum(params1.modulationType) - modTypeToNum(params2.modulationType)) / 1.0,
    binauralOffset: (params1.binauralOffset - params2.binauralOffset) / 20,
    resonanceFreq: (params1.resonanceFreq - params2.resonanceFreq) / 5000,
    resonanceQ: (params1.resonanceQ - params2.resonanceQ) / 4.5,
    integrationConst: ((params1.integrationConst || 0.02) - (params2.integrationConst || 0.02)) / 0.06,
    leakFactor: ((params1.leakFactor || 0.998) - (params2.leakFactor || 0.998)) / 0.015,
    bassBoost: ((params1.bassBoost || 1.0) - (params2.bassBoost || 1.0)) / 1.0,
    rumbleIntensity: ((params1.rumbleIntensity || 1.0) - (params2.rumbleIntensity || 1.0)) / 0.8,
    driftRate: ((params1.driftRate || 0.0) - (params2.driftRate || 0.0)) / 0.5,
  };

  return Math.sqrt(
    Object.values(normalizedDiff).reduce((sum, diff) => sum + diff * diff, 0)
  );
};

let randomSeed = Date.now();
const seededRandom = (): number => {
  randomSeed = (randomSeed * 9301 + 49297) % 233280;
  return randomSeed / 233280;
};

const generateRandomParameters = (): NoiseParameters => {
  const rand = () => (seededRandom() + Math.random()) / 2;

  return {
    frequency: rand() * 19500 + 500,
    rate: rand() * 9.5 + 0.5,
    depth: rand() * 95 + 5,
    carrier: rand() * 950 + 50,
    volume: rand() * 60 + 40,
    filterCutoff: rand() * 19500 + 500,
    stereoWidth: rand() * 90 + 10,
    phase: rand() * 2 * Math.PI,
    bassBand: rand() * 1.0 + 0.5,
    midBand: rand() * 1.0 + 0.5,
    trebleBand: rand() * 1.0 + 0.5,
    attackTime: rand() * 80 + 20,
    releaseTime: rand() * 80 + 20,
    modulationType: ['AM', 'FM', 'none'][Math.floor(rand() * 3)] as ModulationType,
    binauralOffset: rand() * 20,
    resonanceFreq: rand() * 4900 + 100,
    resonanceQ: rand() * 4.5 + 0.5,
  };
};

const generateBrownNoiseParameters = (): NoiseParameters => {
  const rand = () => (seededRandom() + Math.random()) / 2;

  return {
    frequency: rand() * 1450 + 50,
    rate: rand() * 9.5 + 0.5,
    depth: rand() * 95 + 5,
    carrier: rand() * 450 + 50,
    volume: rand() * 70 + 30,
    filterCutoff: rand() * 800 + 200,
    stereoWidth: rand() * 90 + 10,
    phase: rand() * 2 * Math.PI,
    integrationConst: rand() * 0.06 + 0.01,
    leakFactor: rand() * 0.015 + 0.985,
    bassBoost: rand() * 1.0 + 0.5,
    rumbleIntensity: rand() * 0.8 + 0.2,
    driftRate: rand() * 0.5 + 0.1,
    bassBand: rand() * 1.0 + 0.5,
    midBand: rand() * 1.0 + 0.5,
    trebleBand: rand() * 1.0 + 0.5,
    attackTime: rand() * 80 + 20,
    releaseTime: rand() * 80 + 20,
    modulationType: ['AM', 'FM', 'none'][Math.floor(rand() * 3)] as ModulationType,
    binauralOffset: rand() * 20,
    resonanceFreq: rand() * 1400 + 100,
    resonanceQ: rand() * 4.5 + 0.5,
  };
};

const generateVariedGammaCarrier = (variationNumber: number): GammaVariation => {
  randomSeed = Date.now() + variationNumber * 1000;
  const carrierFreq = Math.floor(seededRandom() * (400 - 150 + 1)) + 150;

  return {
    carrierFreq: carrierFreq,
  };
};

interface GeneratedVariation {
  parameters: NoiseParameters;
  distanceFromPrevious: number | null;
  nearestVariation: string | null;
  nearestDistance: number | null;
  avgDistanceToAll?: number;
}

const generateMaximallyDifferentVariation = (type: NoiseType, previousVariations: Variation[], variationNumber: number): GeneratedVariation => {
  randomSeed = Date.now() + variationNumber * 1000;

  const sameTypeVariations = previousVariations.filter(v => v.type === type);

  if (sameTypeVariations.length === 0) {
    const parameters = type === 'brown' ? generateBrownNoiseParameters() : generateRandomParameters();
    return {
      parameters: parameters,
      distanceFromPrevious: null,
      nearestVariation: null,
      nearestDistance: null,
    };
  }

  const recentSameTypeVariations = sameTypeVariations.slice(-100);
  const candidateCount = type === 'brown' ? 500 : 200;

  const candidates: NoiseParameters[] = [];
  for (let i = 0; i < candidateCount; i++) {
    randomSeed = Date.now() + variationNumber * 1000 + i * 17;

    if (type === 'brown') {
      candidates.push(generateBrownNoiseParameters());
    } else {
      candidates.push(generateRandomParameters());
    }
  }

  interface CandidateScore {
    minDistance: number;
    avgDistance: number;
    nearestIndex: number;
  }

  const candidateScores: CandidateScore[] = candidates.map(candidate => {
    const distances = recentSameTypeVariations.map(prev =>
      calculateEuclideanDistance(candidate, prev.parameters as NoiseParameters)
    );
    return {
      minDistance: Math.min(...distances),
      avgDistance: distances.reduce((a, b) => a + b, 0) / distances.length,
      nearestIndex: distances.indexOf(Math.min(...distances))
    };
  });

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

const formatTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const ms = Math.floor((milliseconds % 1000) / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

// ============================================================================
// REACT COMPONENT
// ============================================================================

export default function AdvancedNoiseGenerator({
  audioContextRef,
  activeSession,
  setActiveSession
}: AdvancedNoiseGeneratorProps): ReactNode {
  const [savedPlaylists, setSavedPlaylists] = useLocalStorage('neural-noise-playlists', []);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [audioContextState, setAudioContextState] = useState<AudioContextState>('checking');
  const [renderTick, setRenderTick] = useState(0);

  // Settings
  const [pinkDuration, setPinkDuration] = useLocalStorage('neural-noise-pink-duration', 3);
  const [brownDuration, setBrownDuration] = useLocalStorage('neural-noise-brown-duration', 3);
  const [gammaDuration, setGammaDuration] = useLocalStorage('neural-noise-gamma-duration', 3);
  const [silenceDelay, setSilenceDelay] = useLocalStorage('neural-noise-silence-delay', 0);
  const [useSameDuration, setUseSameDuration] = useLocalStorage('neural-noise-same-duration', true);
  const [durationType, setDurationType] = useLocalStorage('neural-noise-duration-type', 'indefinite' as DurationType);
  const [fixedTime, setFixedTime] = useLocalStorage('neural-noise-fixed-time', 60);
  const [fixedCycles, setFixedCycles] = useLocalStorage('neural-noise-fixed-cycles', 10);
  const [masterVolume, setMasterVolume] = useLocalStorage('neural-noise-master-volume', 50);

  const [alternationMode, setAlternationMode] = useLocalStorage('neural-noise-alternation-mode', 'two-way' as AlternationMode);

  const [overlayGammaEnabled, setOverlayGammaEnabled] = useLocalStorage('neural-noise-overlay-gamma-enabled', false);
  const [overlayGammaVolume, setOverlayGammaVolume] = useLocalStorage('neural-noise-overlay-gamma-volume', 30);
  const [overlayGammaCarrier, setOverlayGammaCarrier] = useLocalStorage('neural-noise-overlay-gamma-carrier', 200);

  const [alternatingGammaVolume, setAlternatingGammaVolume] = useLocalStorage('neural-noise-alternating-gamma-volume', 40);
  const [alternatingGammaCarrier, setAlternatingGammaCarrier] = useLocalStorage('neural-noise-alternating-gamma-carrier', 200);
  const [varyGammaCarrier, setVaryGammaCarrier] = useLocalStorage('neural-noise-vary-gamma-carrier', false);

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useLocalStorage('neural-noise-auto-refresh', true);
  const [refreshInterval, setRefreshInterval] = useLocalStorage('neural-noise-refresh-interval', 1500);

  const noiseGeneratorRef = useRef<NoiseGenerator | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const masterVolumeRef = useRef(masterVolume);
  const overlayGammaVolumeRef = useRef(overlayGammaVolume);
  const alternatingGammaVolumeRef = useRef(alternatingGammaVolume);
  const alternatingGammaCarrierRef = useRef(alternatingGammaCarrier);
  const varyGammaCarrierRef = useRef(varyGammaCarrier);
  const lastRefreshVariation = useRef(0);

  const MAX_VARIATIONS_IN_MEMORY = 100;

  // Force re-renders for millisecond display
  useEffect(() => {
    if (!activeSession || activeSession.isPaused || activeSession.completedAt) return;

    const renderInterval = setInterval(() => {
      setRenderTick(prev => prev + 1);
    }, 100);

    return () => clearInterval(renderInterval);
  }, [activeSession?.isPaused, activeSession?.completedAt, activeSession]);

  // Initialize noise generator
  useEffect(() => {
    if (audioContextRef?.current && !noiseGeneratorRef.current) {
      noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
      console.log('🔊 Noise generator created with app-level audio context');
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [audioContextRef]);

  // Update volume
  useEffect(() => {
    masterVolumeRef.current = masterVolume;
    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.setVolume(masterVolume);
    }
  }, [masterVolume]);

  // Update overlay gamma volume
  useEffect(() => {
    overlayGammaVolumeRef.current = overlayGammaVolume;
    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.setGammaVolume(overlayGammaVolume);
    }
  }, [overlayGammaVolume]);

  // Monitor overlay gamma enabled state during active sessions
  useEffect(() => {
    // Only react to changes during an active session (not paused, not completed)
    if (activeSession && !activeSession.isPaused && !activeSession.completedAt && noiseGeneratorRef.current) {
      if (overlayGammaEnabled) {
        // User turned on gamma overlay during session - start it
        const isGammaPlaying = !!noiseGeneratorRef.current['gammaSource'];
        if (!isGammaPlaying) {
          noiseGeneratorRef.current.startGammaWave(overlayGammaCarrier, 40, overlayGammaVolumeRef.current);
          console.log('🌊 Gamma overlay enabled during session');
        }
      } else {
        // User turned off gamma overlay during session - stop it
        const isGammaPlaying = !!noiseGeneratorRef.current['gammaSource'];
        if (isGammaPlaying) {
          noiseGeneratorRef.current.stopGammaWave();
          console.log('⏹️ Gamma overlay disabled during session');
        }
      }
    }
  }, [overlayGammaEnabled, activeSession, overlayGammaCarrier]);

  // Update alternating gamma settings
  useEffect(() => {
    alternatingGammaVolumeRef.current = alternatingGammaVolume;
  }, [alternatingGammaVolume]);

  useEffect(() => {
    alternatingGammaCarrierRef.current = alternatingGammaCarrier;
  }, [alternatingGammaCarrier]);

  useEffect(() => {
    varyGammaCarrierRef.current = varyGammaCarrier;
  }, [varyGammaCarrier]);

  // Sync brown duration with pink
  useEffect(() => {
    if (useSameDuration) {
      setBrownDuration(pinkDuration);
    }
  }, [useSameDuration, pinkDuration, setBrownDuration]);

  // Keep audio playing in background tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (noiseGeneratorRef.current && noiseGeneratorRef.current.audioContext) {
        const ctx = noiseGeneratorRef.current.audioContext;

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

    const handleUserInteraction = () => {
      if (noiseGeneratorRef.current?.audioContext?.state === 'suspended') {
        noiseGeneratorRef.current.audioContext.resume().then(() => {
          console.log('🔊 Audio resumed by user interaction');
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);

    let lastDiagnosticLog = Date.now();
    const keepAliveInterval = setInterval(() => {
      if (activeSession && !activeSession.isPaused && noiseGeneratorRef.current?.audioContext) {
        const ctx = noiseGeneratorRef.current.audioContext;
        const gen = noiseGeneratorRef.current;

        setAudioContextState(ctx.state as AudioContextState);

        const now = Date.now();
        if (now - lastDiagnosticLog >= 10000) {
          console.log(`📊 Health check: Variations=${activeSession.variations.length}, State=${ctx.state}, Playing=${gen.isPlaying}, Node=${!!gen['sourceNode']}`);
          lastDiagnosticLog = now;
        }

        if (gen.isPlaying && !gen['sourceNode']) {
          console.error('❌ CRITICAL: Audio marked as playing but no source node!');
          alert('⚠️ AUDIO STOPPED UNEXPECTEDLY!\n\nThe audio generator lost its connection.\n\nClick OK to continue. Consider refreshing if this happens repeatedly.');
        }

        if (ctx.state === 'suspended') {
          console.warn('⚠️ Audio context suspended, attempting resume...');
          ctx.resume().catch(err => console.error('Keep-alive resume failed:', err));
        }
      }
    }, 1000);

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
    console.log('  Alternation mode:', alternationMode);
    console.log('  Overlay gamma enabled:', overlayGammaEnabled);

    if (!audioContextRef.current) {
      console.error('❌ AudioContext not initialized!');
      alert('Audio system not initialized. Please refresh the page.');
      return;
    }

    if (audioContextRef.current.state === 'closed') {
      console.error('❌ AudioContext is closed! Recreating...');
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
      console.log('✅ New AudioContext created');
    }

    if (audioContextRef.current.state === 'suspended') {
      console.warn('⚠️ AudioContext suspended, resuming...');
      await audioContextRef.current.resume();
      console.log('✅ AudioContext resumed');
      setAudioContextState(audioContextRef.current.state as AudioContextState);
    }

    const actualPinkDuration = pinkDuration;
    const actualBrownDuration = useSameDuration ? pinkDuration : brownDuration;
    const actualGammaDuration = useSameDuration ? pinkDuration : gammaDuration;

    if (alternationMode === 'pink-only' && actualPinkDuration <= 0) {
      alert('❌ Pink duration must be greater than 0 when Pink Only mode is selected.');
      return;
    }
    if (alternationMode === 'brown-only' && actualBrownDuration <= 0) {
      alert('❌ Brown duration must be greater than 0 when Brown Only mode is selected.');
      return;
    }
    if (alternationMode === 'gamma-only' && actualGammaDuration <= 0) {
      alert('❌ Gamma duration must be greater than 0 when Gamma Only mode is selected.');
      return;
    }
    if (alternationMode === 'two-way' && actualPinkDuration <= 0 && actualBrownDuration <= 0) {
      alert('❌ At least one duration must be greater than 0 in Two-way mode.');
      return;
    }
    if (alternationMode === 'three-way' && actualPinkDuration <= 0 && actualBrownDuration <= 0 && actualGammaDuration <= 0) {
      alert('❌ At least one duration must be greater than 0 in Three-way mode.');
      return;
    }

    const startTime = Date.now();

    let firstType: NoiseType;
    if (alternationMode === 'pink-only') {
      firstType = 'pink';
    } else if (alternationMode === 'brown-only') {
      firstType = 'brown';
    } else if (alternationMode === 'gamma-only') {
      firstType = 'gamma';
    } else if (alternationMode === 'two-way') {
      firstType = actualPinkDuration > 0 ? 'pink' : 'brown';
    } else {
      if (actualPinkDuration > 0) {
        firstType = 'pink';
      } else if (actualBrownDuration > 0) {
        firstType = 'brown';
      } else {
        firstType = 'gamma';
      }
    }

    const session: Session = {
      id: startTime,
      title: `Session ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      completedAt: null,
      variations: [],
      currentType: firstType,
      currentVariationStart: startTime,
      sessionStartTime: startTime,
      totalElapsed: 0,
      totalElapsedMs: 0,
      isIndefinite: durationType === 'indefinite',
      inDelay: false,
      settings: {
        pinkDuration: actualPinkDuration,
        brownDuration: actualBrownDuration,
        gammaDuration: actualGammaDuration,
        silenceDelay,
        totalDuration: durationType === 'time' ? fixedTime : null,
        totalCycles: durationType === 'cycles' ? fixedCycles : null,
        alternationMode,
      },
      isPaused: false,
    };

    let variationObj: Variation;
    let gammaCarrierToUse = alternatingGammaCarrier;

    if (firstType === 'gamma') {
      let gammaParams = null;
      if (varyGammaCarrier) {
        gammaParams = generateVariedGammaCarrier(1);
        gammaCarrierToUse = gammaParams.carrierFreq;
      }

      variationObj = {
        id: `${session.id}-1`,
        type: 'gamma',
        variationNumber: 1,
        parameters: gammaParams,
        distanceFromPrevious: null,
        distanceMetrics: null,
        timestamp: new Date().toISOString(),
        durationMinutes: actualGammaDuration,
      };
    } else {
      const variation = generateMaximallyDifferentVariation(firstType, [], 1);
      variationObj = {
        id: `${session.id}-1`,
        type: firstType,
        variationNumber: 1,
        parameters: variation.parameters,
        distanceFromPrevious: variation.distanceFromPrevious,
        distanceMetrics: {
          nearestVariation: variation.nearestVariation,
          nearestDistance: variation.nearestDistance,
          avgDistanceToAll: variation.avgDistanceToAll || 0,
        },
        timestamp: new Date().toISOString(),
        durationMinutes: firstType === 'pink' ? actualPinkDuration : actualBrownDuration,
      };
    }

    session.variations.push(variationObj);
    session.currentVariation = variationObj;

    setActiveSession(session);

    if (noiseGeneratorRef.current) {
      try {
        if (firstType === 'gamma') {
          await noiseGeneratorRef.current.playGamma(
            gammaCarrierToUse,
            40,
            alternatingGammaVolume,
            actualGammaDuration
          );
        } else {
          await noiseGeneratorRef.current.playNoise(firstType, variationObj.parameters as NoiseParameters, masterVolume);
        }
        console.log('✅ Session started successfully');
        // Update audio context state immediately after successful start
        setAudioContextState(audioContextRef.current.state as AudioContextState);
      } catch (error) {
        console.error('❌ Failed to start audio:', error);
        alert(`Failed to start audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setActiveSession(null);
        return;
      }
    }

    if (overlayGammaEnabled && noiseGeneratorRef.current) {
      try {
        noiseGeneratorRef.current.startGammaWave(overlayGammaCarrier, 40, overlayGammaVolume);
        console.log('✅ Overlay gamma wave started');
      } catch (error) {
        console.error('❌ Failed to start overlay gamma wave:', error);
      }
    }

    startTimer(session);
  }, [pinkDuration, brownDuration, gammaDuration, silenceDelay, useSameDuration, durationType, fixedTime, fixedCycles, masterVolume, alternationMode, overlayGammaEnabled, overlayGammaVolume, overlayGammaCarrier, alternatingGammaVolume, alternatingGammaCarrier, varyGammaCarrier, audioContextRef, setActiveSession]);

  // Get next type
  const getNextType = useCallback((currentType: NoiseType, settings: SessionSettings): NoiseType | null => {
    const mode = settings.alternationMode;
    const pinkDur = settings.pinkDuration || 0;
    const brownDur = settings.brownDuration || 0;
    const gammaDur = settings.gammaDuration || 0;

    if (mode === 'pink-only') {
      return 'pink';
    } else if (mode === 'brown-only') {
      return 'brown';
    } else if (mode === 'gamma-only') {
      return 'gamma';
    } else if (mode === 'two-way') {
      if (pinkDur <= 0 && brownDur <= 0) {
        console.error('❌ Both pink and brown durations are 0');
        return null;
      }
      if (pinkDur <= 0) return 'brown';
      if (brownDur <= 0) return 'pink';
      return currentType === 'pink' ? 'brown' : 'pink';
    } else if (mode === 'three-way') {
      const validTypes: NoiseType[] = [];
      if (pinkDur > 0) validTypes.push('pink');
      if (brownDur > 0) validTypes.push('brown');
      if (gammaDur > 0) validTypes.push('gamma');

      if (validTypes.length === 0) {
        console.error('❌ All durations are 0 in three-way mode');
        return null;
      }

      if (validTypes.length === 1) return validTypes[0];

      if (currentType === 'pink') {
        if (brownDur > 0) return 'brown';
        if (gammaDur > 0) return 'gamma';
        return 'pink';
      } else if (currentType === 'brown') {
        if (gammaDur > 0) return 'gamma';
        if (pinkDur > 0) return 'pink';
        return 'brown';
      } else {
        if (pinkDur > 0) return 'pink';
        if (brownDur > 0) return 'brown';
        return 'gamma';
      }
    }

    return 'pink';
  }, []);

  // Start timer
  const startTimer = useCallback((session: Session) => {
    intervalRef.current = setInterval(() => {
      setActiveSession(prev => {
        if (!prev || prev.isPaused) return prev;

        const elapsedMs = Date.now() - prev.currentVariationStart;
        const elapsed = Math.floor(elapsedMs / 1000);
        const totalElapsedMs = Date.now() - prev.sessionStartTime;
        const newTotalElapsed = Math.floor(totalElapsedMs / 1000);

        if (prev.inDelay) {
          const delayDurationMs = prev.settings.silenceDelay * 60 * 1000;

          if (elapsedMs >= delayDurationMs) {
            const nextType = getNextType(prev.currentType, prev.settings);

            if (!nextType) {
              console.error('❌ Cannot determine next type, stopping session');
              stopGeneration();
              return prev;
            }

            const nextVariationNumber = prev.variations.length + 1;

            if (prev.settings.totalCycles && nextVariationNumber > prev.settings.totalCycles * 2) {
              stopGeneration();
              return prev;
            }

            if (prev.settings.totalDuration && newTotalElapsed >= prev.settings.totalDuration * 60) {
              stopGeneration();
              return prev;
            }

            let variationObj: Variation;
            let nextDurationMin: number;
            let gammaCarrierToUse = alternatingGammaCarrierRef.current;

            if (nextType === 'gamma') {
              nextDurationMin = prev.settings.gammaDuration;
              let gammaParams = null;
              if (varyGammaCarrierRef.current) {
                gammaParams = generateVariedGammaCarrier(nextVariationNumber);
                gammaCarrierToUse = gammaParams.carrierFreq;
              }

              variationObj = {
                id: `${prev.id}-${nextVariationNumber}`,
                type: 'gamma',
                variationNumber: nextVariationNumber,
                parameters: gammaParams,
                distanceFromPrevious: null,
                distanceMetrics: null,
                timestamp: new Date().toISOString(),
                durationMinutes: nextDurationMin,
              };
            } else {
              const variation = generateMaximallyDifferentVariation(nextType, prev.variations, nextVariationNumber);
              nextDurationMin = nextType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration;
              variationObj = {
                id: `${prev.id}-${nextVariationNumber}`,
                type: nextType,
                variationNumber: nextVariationNumber,
                parameters: variation.parameters,
                distanceFromPrevious: variation.distanceFromPrevious,
                distanceMetrics: {
                  nearestVariation: variation.nearestVariation,
                  nearestDistance: variation.nearestDistance,
                  avgDistanceToAll: variation.avgDistanceToAll || 0,
                },
                timestamp: new Date().toISOString(),
                durationMinutes: nextDurationMin,
              };
            }

            if (noiseGeneratorRef.current) {
              try {
                if (nextType === 'gamma') {
                  noiseGeneratorRef.current.playGamma(
                    gammaCarrierToUse,
                    40,
                    alternatingGammaVolumeRef.current,
                    nextDurationMin
                  );
                } else {
                  noiseGeneratorRef.current.playNoise(nextType, variationObj.parameters as NoiseParameters, masterVolumeRef.current);
                }
                console.log(`🔊 Delay complete, playing ${nextType} ${nextType === 'gamma' ? 'wave' : 'noise'} #${nextVariationNumber}, duration: ${(nextDurationMin * 60).toFixed(3)}s`);

                if (autoRefreshEnabled && refreshInterval > 0) {
                  const variationsSinceLastRefresh = nextVariationNumber - lastRefreshVariation.current;
                  if (variationsSinceLastRefresh >= refreshInterval) {
                    console.log(`🔄 Auto-refresh triggered at variation ${nextVariationNumber} (interval: ${refreshInterval})`);
                    lastRefreshVariation.current = nextVariationNumber;
                    performAutoRefresh();
                  }
                }
              } catch (error) {
                console.error('❌ CRITICAL: Failed to play next variation:', error);
                alert(`⚠️ AUDIO STOPPED!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nClick OK to attempt restart, or refresh the page.`);
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
              inDelay: false,
            };
          }

          return {
            ...prev,
            totalElapsed: newTotalElapsed,
            totalElapsedMs: totalElapsedMs,
          };
        }

        let currentDurationMs: number;
        if (prev.currentType === 'pink') {
          currentDurationMs = prev.settings.pinkDuration * 60 * 1000;
        } else if (prev.currentType === 'brown') {
          currentDurationMs = prev.settings.brownDuration * 60 * 1000;
        } else {
          currentDurationMs = prev.settings.gammaDuration * 60 * 1000;
        }

        if (elapsedMs >= currentDurationMs) {
          let durationMin: number;
          if (prev.currentType === 'pink') {
            durationMin = prev.settings.pinkDuration;
          } else if (prev.currentType === 'brown') {
            durationMin = prev.settings.brownDuration;
          } else {
            durationMin = prev.settings.gammaDuration;
          }

          console.log(`⏱️ ${prev.currentType} variation #${prev.currentVariation?.variationNumber} complete:`);
          console.log(`   Expected: ${(currentDurationMs / 1000).toFixed(3)}s (${durationMin.toFixed(4)} min)`);
          console.log(`   Actual: ${(elapsedMs / 1000).toFixed(3)}s`);
          console.log(`   Difference: ${((elapsedMs - currentDurationMs) / 1000).toFixed(3)}s`);

          if (prev.settings.silenceDelay > 0) {
            if (noiseGeneratorRef.current) {
              noiseGeneratorRef.current.stop();
              console.log(`🔇 Entering silence delay for ${prev.settings.silenceDelay * 60}s`);
            }

            return {
              ...prev,
              inDelay: true,
              currentVariationStart: Date.now(),
              totalElapsed: newTotalElapsed,
              totalElapsedMs: totalElapsedMs,
            };
          }

          const nextType = getNextType(prev.currentType, prev.settings);

          if (!nextType) {
            console.error('❌ Cannot determine next type, stopping session');
            stopGeneration();
            return prev;
          }

          const nextVariationNumber = prev.variations.length + 1;

          if (prev.settings.totalCycles && nextVariationNumber > prev.settings.totalCycles * 2) {
            stopGeneration();
            return prev;
          }

          if (prev.settings.totalDuration && newTotalElapsed >= prev.settings.totalDuration * 60) {
            stopGeneration();
            return prev;
          }

          let variationObj: Variation;
          let nextDurationMin: number;

          if (nextType === 'gamma') {
            nextDurationMin = prev.settings.gammaDuration;
            variationObj = {
              id: `${prev.id}-${nextVariationNumber}`,
              type: 'gamma',
              variationNumber: nextVariationNumber,
              parameters: null,
              distanceFromPrevious: null,
              distanceMetrics: null,
              timestamp: new Date().toISOString(),
              durationMinutes: nextDurationMin,
            };
          } else {
            const variation = generateMaximallyDifferentVariation(nextType, prev.variations, nextVariationNumber);
            nextDurationMin = nextType === 'pink' ? prev.settings.pinkDuration : prev.settings.brownDuration;
            variationObj = {
              id: `${prev.id}-${nextVariationNumber}`,
              type: nextType,
              variationNumber: nextVariationNumber,
              parameters: variation.parameters,
              distanceFromPrevious: variation.distanceFromPrevious,
              distanceMetrics: {
                nearestVariation: variation.nearestVariation,
                nearestDistance: variation.nearestDistance,
                avgDistanceToAll: variation.avgDistanceToAll || 0,
              },
              timestamp: new Date().toISOString(),
              durationMinutes: nextDurationMin,
            };
          }

          if (noiseGeneratorRef.current) {
            try {
              if (nextType === 'gamma') {
                noiseGeneratorRef.current.playGamma(
                  alternatingGammaCarrierRef.current,
                  40,
                  alternatingGammaVolumeRef.current,
                  nextDurationMin
                );
              } else {
                noiseGeneratorRef.current.playNoise(nextType, variationObj.parameters as NoiseParameters, masterVolumeRef.current);
              }
              console.log(`🔊 Switched to ${nextType} noise #${nextVariationNumber}, duration: ${(nextDurationMin * 60).toFixed(3)}s`);

              if (autoRefreshEnabled && refreshInterval > 0) {
                const variationsSinceLastRefresh = nextVariationNumber - lastRefreshVariation.current;
                if (variationsSinceLastRefresh >= refreshInterval) {
                  console.log(`🔄 Auto-refresh triggered at variation ${nextVariationNumber} (interval: ${refreshInterval})`);
                  lastRefreshVariation.current = nextVariationNumber;
                  performAutoRefresh();
                }
              }
            } catch (error) {
              console.error('❌ CRITICAL: Failed to play next variation:', error);
              alert(`⚠️ AUDIO STOPPED!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}\n\nClick OK to attempt restart, or refresh the page.`);
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

        return {
          ...prev,
          totalElapsed: newTotalElapsed,
          totalElapsedMs: totalElapsedMs,
        };
      });
    }, 100);
  }, [getNextType, autoRefreshEnabled, refreshInterval, setActiveSession]);

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

      noiseGeneratorRef.current.stopGammaWave();
      console.log('  ✅ Gamma wave stopped');
    }

    if (activeSession) {
      const completedSession: Session = {
        ...activeSession,
        completedAt: new Date().toISOString(),
      };
      setActiveSession(completedSession);
      console.log('  ✅ Session marked complete');
    }

    console.log('🏁 Session stopped, AudioContext final state:', audioContextRef.current?.state);
  }, [activeSession, audioContextRef, setActiveSession]);

  // Pause/Resume
  const togglePause = useCallback(() => {
    setActiveSession(prev => {
      if (!prev) return prev;

      if (prev.isPaused) {
        const pausedDuration = Date.now() - (prev.pauseStartTime || Date.now());
        const newSessionStartTime = prev.sessionStartTime + pausedDuration;
        const newCurrentVariationStart = prev.currentVariationStart + pausedDuration;

        if (noiseGeneratorRef.current && prev.currentVariation) {
          noiseGeneratorRef.current.playNoise(prev.currentType, prev.currentVariation.parameters as NoiseParameters, masterVolumeRef.current);

          if (prev.gammaWasEnabled) {
            noiseGeneratorRef.current.startGammaWave(overlayGammaCarrier, 40, overlayGammaVolumeRef.current);
          }
        }

        const resumed: Session = {
          ...prev,
          sessionStartTime: newSessionStartTime,
          currentVariationStart: newCurrentVariationStart,
          isPaused: false,
          pauseStartTime: undefined,
          gammaWasEnabled: undefined,
        };

        startTimer(resumed);
        return resumed;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (noiseGeneratorRef.current) {
          noiseGeneratorRef.current.stop();
          noiseGeneratorRef.current.stopGammaWave();

          return {
            ...prev,
            isPaused: true,
            pauseStartTime: Date.now(),
            gammaWasEnabled: overlayGammaEnabled, // Use user preference, not physical state
          };
        }

        return {
          ...prev,
          isPaused: true,
          pauseStartTime: Date.now(),
          gammaWasEnabled: overlayGammaEnabled, // Use user preference, not physical state
        };
      }
    });
  }, [overlayGammaCarrier, overlayGammaEnabled, startTimer, setActiveSession]);

  // Auto-refresh
  const performAutoRefresh = useCallback(async () => {
    console.log('🔄 AUTO-REFRESHING AudioContext (preventing corruption)...');

    // Use user's overlay gamma preference, not just physical state
    const shouldRestoreGamma = overlayGammaEnabled;

    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.stop();
      noiseGeneratorRef.current.stopGammaWave();
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
        console.log('  ✅ Old AudioContext closed');
      } catch (e) {
        console.warn('  ⚠️ Error closing old AudioContext:', e);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    await audioContextRef.current.resume();
    console.log('  ✅ New AudioContext created, state:', audioContextRef.current.state);

    noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
    console.log('  ✅ Noise generator recreated');

    if (activeSession && !activeSession.completedAt && !activeSession.isPaused && activeSession.currentVariation) {
      try {
        await noiseGeneratorRef.current.playNoise(
          activeSession.currentType,
          activeSession.currentVariation.parameters as NoiseParameters,
          masterVolumeRef.current
        );
        console.log('  ✅ Resumed current variation');

        if (shouldRestoreGamma) {
          noiseGeneratorRef.current.startGammaWave(overlayGammaCarrier, 40, overlayGammaVolumeRef.current);
          console.log('  ✅ Resumed gamma wave overlay');
        }
      } catch (error) {
        console.error('  ❌ Failed to resume audio after auto-refresh:', error);
      }
    }

    console.log('✅ Auto-refresh complete - session continues seamlessly');
  }, [activeSession, overlayGammaCarrier, overlayGammaEnabled, audioContextRef]);

  // Force restart audio
  const forceRestartAudio = useCallback(async () => {
    console.log('🔧 FORCE RESTARTING AUDIO SYSTEM (manual trigger)...');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (noiseGeneratorRef.current) {
      noiseGeneratorRef.current.stop();
      noiseGeneratorRef.current.stopGammaWave();
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
        console.log('  ✅ Old AudioContext closed');
      } catch (e) {
        console.warn('  ⚠️ Error closing old AudioContext:', e);
      }
    }

    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log('  ✅ New AudioContext created, state:', audioContextRef.current.state);

    noiseGeneratorRef.current = new NoiseGenerator(audioContextRef.current);
    console.log('  ✅ Noise generator recreated');

    if (activeSession && !activeSession.completedAt) {
      const wasGammaEnabled = activeSession.gammaWasEnabled || overlayGammaEnabled;

      if (activeSession.currentVariation) {
        try {
          await noiseGeneratorRef.current.playNoise(
            activeSession.currentType,
            activeSession.currentVariation.parameters as NoiseParameters,
            masterVolumeRef.current
          );
          console.log('  ✅ Resumed current variation');

          if (wasGammaEnabled) {
            noiseGeneratorRef.current.startGammaWave(overlayGammaCarrier, 40, overlayGammaVolumeRef.current);
            console.log('  ✅ Resumed gamma wave');
          }

          if (!activeSession.isPaused) {
            startTimer(activeSession);
            console.log('  ✅ Timer restarted');
          }
        } catch (error) {
          console.error('  ❌ Failed to resume audio:', error);
          alert('Failed to resume audio. You may need to stop and start a new session.');
        }
      }
    }

    alert('✅ Audio system restarted! You should hear audio now.');
    console.log('🔧 FORCE RESTART COMPLETE');
  }, [activeSession, overlayGammaEnabled, overlayGammaCarrier, startTimer, audioContextRef]);

  // Save to history
  const saveToHistory = useCallback((title: string) => {
    if (!activeSession) return;

    const playlist: Session = {
      ...activeSession,
      title: title || activeSession.title,
    };

    setSavedPlaylists(prev => [playlist, ...(prev || [])]);
    setActiveSession(null);
  }, [activeSession, setSavedPlaylists, setActiveSession]);

  // Calculate statistics
  const statistics = useMemo((): Statistics | null => {
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
  const currentProgress = useMemo((): CurrentProgress | null => {
    if (!activeSession || !activeSession.currentVariation) return null;

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
  }, [activeSession, renderTick]);

  // Render history view
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
              {(savedPlaylists || []).length} saved session{(savedPlaylists || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="neural-button-secondary"
          >
            Back
          </button>
        </div>

        {(!savedPlaylists || savedPlaylists.length === 0) ? (
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
        {(savedPlaylists && savedPlaylists.length > 0) && (
          <button
            onClick={() => setShowHistory(true)}
            className="neural-button-secondary flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            History ({(savedPlaylists || []).length})
          </button>
        )}
      </div>

      {/* Active session display */}
      {activeSession && !activeSession.completedAt ? (
        <div className="space-y-6">
          {/* Audio Context Status Indicator */}
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

          {/* Long session warning */}
          {activeSession.variations.length >= 5000 && (
            <div className="px-3 py-2 rounded-lg border bg-orange-950/30 border-orange-500/50 text-orange-400 text-sm">
              ⚠️ Long session detected ({activeSession.variations.length.toLocaleString()} variations).
              If audio stops working, click the <strong>🔧 button</strong> to force restart audio.
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
                      <>{activeSession.currentType === 'pink' ? '🩷' : activeSession.currentType === 'brown' ? '🤎' : '🌊'} {activeSession.currentType === 'pink' ? 'Pink' : activeSession.currentType === 'brown' ? 'Brown' : 'Gamma'} {activeSession.currentType !== 'gamma' ? `Noise #${activeSession.currentVariation?.variationNumber}` : `Wave #${activeSession.currentVariation?.variationNumber}`}</>
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
                  title="Pause/Resume"
                >
                  {activeSession.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  onClick={stopGeneration}
                  className="neural-button-secondary"
                  title="Stop Session"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button
                  onClick={forceRestartAudio}
                  className="neural-button-secondary bg-orange-900/30 border-orange-500/50 hover:bg-orange-900/50"
                  title="Force restart audio if you can't hear anything"
                >
                  🔧
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

            {/* Volume Control */}
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

            {activeSession.currentVariation && activeSession.currentVariation.distanceFromPrevious !== null && (
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
                  <span className="ml-2 font-bold text-pink-400">{statistics.avgDistancePink}/3.87 ({Math.round((parseFloat(statistics.avgDistancePink) / 3.87) * 100)}%)</span>
                </div>
                <div>
                  <span className="text-gray-400">Avg Brown Distance:</span>
                  <span className="ml-2 font-bold text-amber-400">{statistics.avgDistanceBrown}/3.87 ({Math.round((parseFloat(statistics.avgDistanceBrown) / 3.87) * 100)}%)</span>
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
                      {variation.type === 'pink' ? '🩷' : variation.type === 'brown' ? '🤎' : '🌊'} {variation.type === 'pink' ? 'Pink' : variation.type === 'brown' ? 'Brown' : 'Gamma'} #{variation.variationNumber}
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
                  <span className="text-pink-400">Pink: {statistics.avgDistancePink}/3.87 ({Math.round((parseFloat(statistics.avgDistancePink) / 3.87) * 100)}%)</span>
                  <span className="mx-2">|</span>
                  <span className="text-amber-400">Brown: {statistics.avgDistanceBrown}/3.87 ({Math.round((parseFloat(statistics.avgDistanceBrown) / 3.87) * 100)}%)</span>
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
                {/* Alternation Mode */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Alternation Mode (Sequential):</label>
                  <div className="flex flex-col gap-2">
                    {(['two-way', 'three-way', 'pink-only', 'brown-only', 'gamma-only'] as AlternationMode[]).map((mode) => (
                      <label key={mode} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value={mode}
                          checked={alternationMode === mode}
                          onChange={(e) => setAlternationMode(e.target.value as AlternationMode)}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span className="text-sm">
                          {mode === 'two-way' ? '🔄 Two-way (Pink ↔ Brown)' :
                           mode === 'three-way' ? '🔄 Three-way (Pink → Brown → Gamma)' :
                           mode === 'pink-only' ? '🩷 Pink only' :
                           mode === 'brown-only' ? '🤎 Brown only' :
                           '🌊 Gamma only'}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {alternationMode === 'pink-only' ? 'Only pink noise variations will play' :
                     alternationMode === 'brown-only' ? 'Only brown noise variations will play' :
                     alternationMode === 'gamma-only' ? 'Only 40Hz gamma waves will play' :
                     alternationMode === 'two-way' ? 'Alternates between pink and brown noise' :
                     'Cycles through pink → brown → gamma in sequence'}
                  </p>
                </div>

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

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Pink Duration (minutes)
                        <span className="text-xs text-gray-500 ml-2">
                          = {(pinkDuration * 60).toFixed(2)}s
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
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
                        min="0"
                        max="180"
                        step="0.001"
                        value={brownDuration}
                        onChange={(e) => setBrownDuration(parseFloat(e.target.value))}
                        disabled={useSameDuration}
                        className="neural-input disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Gamma Duration (minutes)
                        <span className="text-xs text-gray-500 ml-2">
                          = {(gammaDuration * 60).toFixed(2)}s
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        step="0.001"
                        value={gammaDuration}
                        onChange={(e) => setGammaDuration(parseFloat(e.target.value))}
                        disabled={useSameDuration}
                        className="neural-input disabled:opacity-50"
                      />
                    </div>
                  </div>
                  {(alternationMode === 'two-way' || alternationMode === 'three-way') && (
                    <p className="text-xs text-gray-500 italic">
                      💡 Tip: Set duration to 0 to skip that noise type in the rotation
                    </p>
                  )}

                  {/* Silence Delay */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Silence Delay (gap between variations)
                      <span className="text-xs text-gray-500 ml-2">
                        = {(silenceDelay * 60).toFixed(2)}s
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <button onClick={() => setSilenceDelay(0)} className="neural-button-secondary text-xs px-2 py-1">0s (none)</button>
                      <button onClick={() => setSilenceDelay(0.00167)} className="neural-button-secondary text-xs px-2 py-1">0.1s</button>
                      <button onClick={() => setSilenceDelay(0.0083)} className="neural-button-secondary text-xs px-2 py-1">0.5s</button>
                      <button onClick={() => setSilenceDelay(0.0167)} className="neural-button-secondary text-xs px-2 py-1">1s</button>
                      <button onClick={() => setSilenceDelay(0.0333)} className="neural-button-secondary text-xs px-2 py-1">2s</button>
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
                  <span className="text-sm">Use same duration for all types</span>
                </label>

                {/* Alternating Gamma Settings */}
                {(alternationMode === 'three-way' || alternationMode === 'gamma-only') && (
                  <div className="space-y-3 border-t border-gray-700 pt-4">
                    <h4 className="text-sm font-medium text-gray-300">Alternating Gamma Settings:</h4>
                    <p className="text-xs text-gray-500">
                      Settings for gamma wave when it plays as part of the rotation sequence (not continuous overlay).
                    </p>
                    <div className="space-y-3 pl-4 border-l-2 border-indigo-500/30">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Alternating Gamma Volume</label>
                          <span className="text-sm font-medium">{alternatingGammaVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={alternatingGammaVolume}
                          onChange={(e) => setAlternatingGammaVolume(parseInt(e.target.value))}
                          className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Carrier Frequency: {alternatingGammaCarrier} Hz
                        </label>
                        <input
                          type="range"
                          min="100"
                          max="500"
                          value={alternatingGammaCarrier}
                          onChange={(e) => setAlternatingGammaCarrier(parseInt(e.target.value))}
                          className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Left ear: {alternatingGammaCarrier} Hz | Right ear: {alternatingGammaCarrier + 40} Hz = 40 Hz beat
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={varyGammaCarrier}
                            onChange={(e) => setVaryGammaCarrier(e.target.checked)}
                            className="w-4 h-4 accent-indigo-500"
                          />
                          <span className="text-sm">🎲 Vary carrier frequency (150-400 Hz)</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                          When enabled, each gamma iteration uses a randomly varied carrier frequency while maintaining the 40Hz beat. Disabled uses the fixed carrier above.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overlay Gamma Settings */}
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overlayGammaEnabled}
                        onChange={(e) => setOverlayGammaEnabled(e.target.checked)}
                        className="w-4 h-4 accent-blue-500"
                      />
                      <span className="text-sm font-medium">🌊 40Hz Gamma Wave Overlay (continuous on top)</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Adds a continuous 40Hz binaural beat that plays on top of all noise types. Independent from alternating gamma.
                  </p>

                  {overlayGammaEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-blue-500/30">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm text-gray-400">Overlay Gamma Volume</label>
                          <span className="text-sm font-medium">{overlayGammaVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={overlayGammaVolume}
                          onChange={(e) => setOverlayGammaVolume(parseInt(e.target.value))}
                          className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Carrier Frequency: {overlayGammaCarrier} Hz
                        </label>
                        <input
                          type="range"
                          min="100"
                          max="500"
                          value={overlayGammaCarrier}
                          onChange={(e) => setOverlayGammaCarrier(parseInt(e.target.value))}
                          className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Left ear: {overlayGammaCarrier} Hz | Right ear: {overlayGammaCarrier + 40} Hz = 40 Hz beat
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Auto-Refresh Settings */}
                <div className="space-y-3 border-t border-gray-700 pt-4">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRefreshEnabled}
                        onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                        className="w-4 h-4 accent-green-500"
                      />
                      <span className="text-sm font-medium">🔄 Auto-Refresh AudioContext (Recommended for overnight sessions)</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Automatically recreates the audio system every N variations to prevent corruption during long sessions.
                    Creates a brief (100ms) silence but prevents audio from dying after several hours.
                  </p>

                  {autoRefreshEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-green-500/30">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          Refresh Interval: Every {refreshInterval} variations
                        </label>
                        <input
                          type="range"
                          min="500"
                          max="5000"
                          step="100"
                          value={refreshInterval}
                          onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                          className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>500 (~17 min)</span>
                          <span>5000 (~2.8 hrs)</span>
                        </div>
                      </div>

                      <div className="bg-neural-darker rounded-lg p-3 text-xs text-gray-400">
                        <p className="mb-1"><strong>Recommended intervals:</strong></p>
                        <ul className="space-y-1 ml-4">
                          <li>• <strong>1000-1500 variations</strong> (~30-50 min) - Best for overnight sessions</li>
                          <li>• <strong>2000-3000 variations</strong> (~1-1.5 hrs) - Balanced</li>
                          <li>• <strong>500 variations</strong> (~17 min) - Very frequent (safest but more interruptions)</li>
                        </ul>
                        <p className="mt-2 text-xs text-gray-500">
                          At {refreshInterval} variations (2s each), refresh happens every <strong>~{Math.round(refreshInterval * 2 / 60)} minutes</strong>
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => setRefreshInterval(1000)} className="neural-button-secondary text-xs px-2 py-1">1000 (33min)</button>
                        <button onClick={() => setRefreshInterval(1500)} className="neural-button-secondary text-xs px-2 py-1">1500 (50min) ⭐</button>
                        <button onClick={() => setRefreshInterval(2000)} className="neural-button-secondary text-xs px-2 py-1">2000 (67min)</button>
                        <button onClick={() => setRefreshInterval(3000)} className="neural-button-secondary text-xs px-2 py-1">3000 (100min)</button>
                      </div>
                    </div>
                  )}
                </div>

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
              <li>• <strong>Noise Modes:</strong> Choose Pink Only, Brown Only, or Alternating modes</li>
              <li>• <strong>Smart Duration:</strong> Set duration to 0 to skip that noise type in Alternating mode</li>
              <li>• <strong>40Hz Gamma Wave:</strong> Optional binaural beat overlay for enhanced focus/cognition</li>
              <li>• <strong>Auto-Refresh:</strong> Automatically recreates audio every N variations to prevent corruption on overnight sessions (enabled by default)</li>
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
