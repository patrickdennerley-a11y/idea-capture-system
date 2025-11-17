import { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, Radio, Sparkles } from 'lucide-react';
import AdvancedNoiseGenerator from './AdvancedNoiseGenerator';

type NoiseType = 'pink' | 'brown' | 'gamma40';

interface NoiseTypeInfo {
  name: string;
  color: string;
  description: string;
  url: string;
}

interface NoiseHubProps {
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  activeSession: any; // Session type from AdvancedNoiseGenerator
  setActiveSession: (session: any) => void;
}

const NOISE_TYPES: Record<NoiseType, NoiseTypeInfo> = {
  pink: {
    name: 'Pink Noise',
    color: 'pink',
    description: 'Balanced frequency for focus and calm',
    url: 'https://www.youtube.com/embed/ZXtimhT-ff4?autoplay=1&loop=1&playlist=ZXtimhT-ff4',
  },
  brown: {
    name: 'Brown Noise',
    color: 'amber',
    description: 'Deep, rumbling sound for deep focus',
    url: 'https://www.youtube.com/embed/RqzGzwTY-6w?autoplay=1&loop=1&playlist=RqzGzwTY-6w',
  },
  gamma40: {
    name: '40Hz Gamma Waves',
    color: 'purple',
    description: 'Brain entrainment for mental clarity',
    url: 'https://www.youtube.com/embed/iAYcY4XTmLY?autoplay=1&loop=1&playlist=iAYcY4XTmLY',
  },
};

export default function NoiseHub({ audioContextRef, activeSession, setActiveSession }: NoiseHubProps) {
  const [currentView, setCurrentView] = useState<'simple' | 'advanced'>('simple');
  const [activeNoise, setActiveNoise] = useState<NoiseType | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(50);
  const [showHub, setShowHub] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const startNoise = (type: NoiseType): void => {
    setActiveNoise(type);
    setIsPlaying(true);
    setIframeKey(prev => prev + 1);
  };

  const stopNoise = (): void => {
    setActiveNoise(null);
    setIsPlaying(false);
  };

  const togglePlayPause = (): void => {
    setIsPlaying(!isPlaying);
  };

  // Cleanup effect for iframe
  useEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = 'about:blank';
        iframeRef.current = null;
      }
    };
  }, []);

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Radio className="w-6 h-6 text-pink-400" />
            Sensory Management Hub
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Pink/Brown noise & 40Hz gamma waves for mental health
          </p>
        </div>
        {activeNoise && currentView === 'simple' && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-neural-darker rounded-lg">
              <div className={`w-2 h-2 rounded-full bg-${NOISE_TYPES[activeNoise].color}-400 ${isPlaying ? 'animate-pulse' : ''}`} />
              <span className="text-sm font-medium">{NOISE_TYPES[activeNoise].name}</span>
            </div>
            <button
              onClick={stopNoise}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <VolumeX className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-800">
        <button
          onClick={() => setCurrentView('simple')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'simple'
              ? 'text-pink-400 border-pink-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Radio className="w-4 h-4 inline mr-2" />
          Simple Player
        </button>
        <button
          onClick={() => setCurrentView('advanced')}
          className={`px-4 py-2 font-medium transition-colors border-b-2 ${
            currentView === 'advanced'
              ? 'text-pink-400 border-pink-400'
              : 'text-gray-400 border-transparent hover:text-gray-300'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Advanced Generator
        </button>
      </div>

      {/* Conditional View Rendering */}
      {currentView === 'advanced' ? (
        <AdvancedNoiseGenerator
          audioContextRef={audioContextRef}
          activeSession={activeSession}
          setActiveSession={setActiveSession}
        />
      ) : (
        <>
      {/* Quick Access Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(Object.entries(NOISE_TYPES) as [NoiseType, NoiseTypeInfo][]).map(([key, noise]) => (
          <button
            key={key}
            onClick={() => startNoise(key)}
            disabled={activeNoise === key && isPlaying}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              activeNoise === key
                ? `border-${noise.color}-400 bg-${noise.color}-900/20`
                : 'border-gray-800 bg-neural-darker hover:border-gray-700'
            } disabled:opacity-75`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-full bg-${noise.color}-400/20 flex items-center justify-center`}>
                <Volume2 className={`w-5 h-5 text-${noise.color}-400`} />
              </div>
              <div>
                <h3 className="font-bold">{noise.name}</h3>
                {activeNoise === key && isPlaying && (
                  <span className="text-xs text-green-400">● Playing</span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-400">{noise.description}</p>
          </button>
        ))}
      </div>

      {/* Volume Control (when playing) */}
      {activeNoise && (
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-4 mb-6 animate-slide-in">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="neural-button-secondary"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Volume</span>
                <span className="text-sm font-medium">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-full h-2 bg-neural-dark rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${volume}%, #1a1a1f ${volume}%, #1a1a1f 100%)`
                }}
              />
            </div>

            <VolumeX className="w-5 h-5 text-gray-600" />
          </div>
        </div>
      )}

      {/* Embedded Player */}
      {activeNoise && isPlaying && (
        <div className="mb-6">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={NOISE_TYPES[activeNoise].url}
              title={NOISE_TYPES[activeNoise].name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Tip: Use YouTube Premium to avoid ads, or download local audio files for offline use
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-neural-darker border border-blue-800/30 rounded-lg p-4">
        <h3 className="font-bold mb-2 text-blue-400">How to Use</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Click a noise type to start playing</li>
          <li>• Pink noise: General focus and background ambiance</li>
          <li>• Brown noise: Deep focus, blocks distractions</li>
          <li>• 40Hz Gamma: Mental clarity and cognitive enhancement</li>
          <li>• Keep playing in background while using other sections</li>
          <li>• Adjust volume to comfortable level (not too loud)</li>
        </ul>
      </div>

      <div className="mt-4 p-3 bg-yellow-900/10 border border-yellow-800/30 rounded-lg">
        <p className="text-sm text-yellow-400">
          <strong>Important:</strong> These are critical mental health resources for you.
          Consider saving local copies and/or getting YouTube Premium to ensure uninterrupted access.
        </p>
      </div>
        </>
      )}
    </div>
  );
}
