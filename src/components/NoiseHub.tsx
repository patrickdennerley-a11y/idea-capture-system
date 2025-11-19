import React, { useState, FC, MutableRefObject } from 'react';
import { Radio, Sparkles } from 'lucide-react';
import AdvancedNoiseGenerator from './AdvancedNoiseGenerator';

// ========== TYPE DEFINITIONS ==========

export interface NoiseSession {
  id: number;
  startTime: string;
  duration: number;
  type: string;
  variations: number;
}

interface NoiseHubProps {
  audioContextRef: MutableRefObject<AudioContext | null>;
  activeSession: NoiseSession | null;
  setActiveSession: React.Dispatch<React.SetStateAction<NoiseSession | null>>;
}

// ========== COMPONENT ==========

const NoiseHub: FC<NoiseHubProps> = ({ audioContextRef, activeSession, setActiveSession }) => {
  const [currentView, setCurrentView] = useState<'generator'>('generator');

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-neural-pink" />
            Noise Hub
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Background noise for focus and productivity
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setCurrentView('generator')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'generator'
              ? 'text-neural-purple border-neural-purple'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Advanced Generator
        </button>
      </div>

      {/* Generator View */}
      {currentView === 'generator' && (
        <AdvancedNoiseGenerator
          audioContextRef={audioContextRef}
          activeSession={activeSession}
          setActiveSession={setActiveSession}
        />
      )}
    </div>
  );
};

export default NoiseHub;
