/**
 * ICON CUSTOMIZER COMPONENT
 *
 * Purpose: Customize the app logo/icon with different designs, colors, and gradients
 *
 * Features:
 * - Multiple icon designs (brain, sine wave, neuralink-style, rocket, wind, meditation, angel, uni)
 * - Stroke color customization
 * - Background color customization
 * - Gradient options (solid or gradient backgrounds)
 * - Reset to default theme
 * - Saved in localStorage
 */

import { useState, FC, SVGProps, ChangeEvent } from 'react';
import { X, Palette, RotateCcw, Brain as LucideBrain } from 'lucide-react';

// Type definitions
interface IconTheme {
  icon: string;
  strokeColor: string;
  bgType: 'solid' | 'gradient';
  bgColor: string;
  bgGradientEnd: string;
}

type IconProps = SVGProps<SVGSVGElement>;

type IconComponent = (props: IconProps) => JSX.Element;

interface IconOption {
  id: string;
  name: string;
  description: string;
}

interface IconCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: IconTheme;
  setTheme: (theme: IconTheme) => void;
}

// Default theme
const DEFAULT_THEME: IconTheme = {
  icon: 'brain-lucide',
  strokeColor: '#ffffff',
  bgType: 'gradient', // 'solid' or 'gradient'
  bgColor: '#a855f7', // solid bg or gradient start
  bgGradientEnd: '#ec4899', // gradient end
};

// Icon SVG components
const ICONS: Record<string, IconComponent> = {
  'brain-lucide': (props: IconProps) => (
    <LucideBrain {...props} />
  ),

  brain: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 5c-2.5 0-4 2-4 4 0 1 .5 2 1 2.5C8 12 7 13 7 14.5c0 1.5 1 3 2.5 3 .5 0 1-.2 1.5-.5.5 1.5 2 2.5 3.5 2.5s3-1 3.5-2.5c.5.3 1 .5 1.5.5 1.5 0 2.5-1.5 2.5-3 0-1.5-1-2.5-2-3 .5-.5 1-1.5 1-2.5 0-2-1.5-4-4-4-1 0-2 .5-2.5 1-.5-.5-1.5-1-2.5-1z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ),

  sine: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* X-axis */}
      <path
        d="M2 13h20"
        strokeLinecap="round"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* Sine wave - 2 complete oscillations, centered */}
      <path
        d="M2 13Q5 7 8 13T14 13Q17 7 20 13T22 13"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  ),

  neuralink: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="8" strokeWidth="2" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
      <circle cx="10" cy="15" r="1.5" fill="currentColor" />
      <circle cx="14" cy="15" r="1.5" fill="currentColor" />
      <path d="M12 8v4m-4-4v8m8-8v8m-6 0v-3m4 3v-3" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),

  rocket: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* Rocket body */}
      <path
        d="M12 2v8m0 0l-3 3v5l3 2 3-2v-5l-3-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      {/* Fins */}
      <path d="M9 13l-3 2v3l3-2m6 0l3 2v3l-3-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Window */}
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      {/* Flames */}
      <path d="M10.5 20v2m3-2v2m-1.5 0v1.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  wind: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 6h10a3 3 0 0 1 0 6H9" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12h14a3 3 0 0 1 0 6H5" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18H5a3 3 0 0 1 0-6h7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  meditation: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* Head */}
      <circle cx="12" cy="8" r="2.5" strokeWidth="2" />
      {/* Body in lotus position */}
      <path
        d="M12 10.5c-3 0-5 2-5 4.5v1.5h10V15c0-2.5-2-4.5-5-4.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Crossed legs */}
      <path d="M7 16c-1.5 1-2.5 2-3 3m13-3c1.5 1 2.5 2 3 3" strokeWidth="2" strokeLinecap="round" />
      {/* Energy/aura above head */}
      <path d="M12 5.5v-1m-2 1l1-2m3 2l-1-2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),

  angel: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      {/* Halo */}
      <circle cx="12" cy="4" r="2" strokeWidth="1.5" />

      {/* Head */}
      <circle cx="12" cy="9" r="2.5" strokeWidth="2" />

      {/* Body */}
      <path
        d="M12 11.5c-3.5 0-5.5 2.5-5.5 5.5v2h11v-2c0-3-2-5.5-5.5-5.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Left wing - detailed feathers */}
      <path
        d="M6.5 14c-1.5-1-2.5-2-3.5-3.5-0.8-1.2-1-2.5-0.5-3.5 0.4-0.8 1.2-1 2-0.8 1 0.3 2 1.2 2.5 2.3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 13c-1-0.8-1.8-1.5-2.5-2.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M7 14.5c-0.8-0.5-1.5-1-2-1.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Right wing - detailed feathers */}
      <path
        d="M17.5 14c1.5-1 2.5-2 3.5-3.5 0.8-1.2 1-2.5 0.5-3.5-0.4-0.8-1.2-1-2-0.8-1 0.3-2 1.2-2.5 2.3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 13c1-0.8 1.8-1.5 2.5-2.5"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M17 14.5c0.8-0.5 1.5-1 2-1.8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  ),

  uni: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3l9 4.5v5.5c0 4-2.5 6.5-9 9.5-6.5-3-9-5.5-9-9.5V7.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9v7m-3-5h6m-6 3h6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  // Neuralink-style icons
  constellation: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      {/* Constellation nodes */}
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      <circle cx="8" cy="14" r="1.5" fill="currentColor" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      {/* Connecting lines */}
      <path d="M12 7l4 3m0 4l-4 3m0 0l-4-3m0-4l4-3m0 10V7M8 10l8 4m0-4l-8 4" strokeWidth="1.2" opacity="0.4" />
    </svg>
  ),

  molecule: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      {/* Central node */}
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      {/* Orbiting nodes */}
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      {/* Connections to center */}
      <path d="M12 10V6m2 6h6m-2 6v-6m-6 2h-6" strokeWidth="1.5" />
      {/* Orbital rings */}
      <ellipse cx="12" cy="12" rx="6" ry="3" strokeWidth="1" opacity="0.3" transform="rotate(45 12 12)" />
      <ellipse cx="12" cy="12" rx="6" ry="3" strokeWidth="1" opacity="0.3" transform="rotate(-45 12 12)" />
    </svg>
  ),

  network: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      {/* Neural network nodes - 3 layers */}
      <circle cx="7" cy="9" r="1.5" fill="currentColor" />
      <circle cx="7" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      <circle cx="17" cy="9" r="1.5" fill="currentColor" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
      {/* Connections */}
      <path d="M8.5 9.5l3 -2m-3.5 5.5l3 -3m0 0l3 -2m-3 2l3 3m-3-3v5m-3-5l3 5m3-10l-3 5m3 1l-3-5" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
};

const ICON_OPTIONS: IconOption[] = [
  { id: 'brain-lucide', name: 'Brain (Original)', description: 'Lucide brain icon' },
  { id: 'brain', name: 'Brain (Alt)', description: 'Neural network style' },
  { id: 'sine', name: 'Sine Wave', description: 'Mathematics & flow' },
  { id: 'neuralink', name: 'Neuralink', description: 'Brain-computer interface' },
  { id: 'constellation', name: 'Constellation', description: 'Star connections' },
  { id: 'molecule', name: 'Molecule', description: 'Atomic structure' },
  { id: 'network', name: 'Neural Net', description: 'Connected nodes' },
  { id: 'rocket', name: 'Rocket', description: 'Launch & ambition' },
  { id: 'wind', name: 'Wind', description: 'Air & breath' },
  { id: 'meditation', name: 'Meditation', description: 'Mindfulness' },
  { id: 'angel', name: 'Angel', description: 'Divine guidance' },
  { id: 'uni', name: 'University', description: 'Melbourne Uni shield' },
];

const IconCustomizer: FC<IconCustomizerProps> = ({ isOpen, onClose, theme, setTheme }) => {
  const [localTheme, setLocalTheme] = useState<IconTheme>(theme);

  if (!isOpen) return null;

  const handleSave = (): void => {
    setTheme(localTheme);
    onClose();
  };

  const handleReset = (): void => {
    setLocalTheme(DEFAULT_THEME);
  };

  const handleIconChange = (iconId: string): void => {
    setLocalTheme({ ...localTheme, icon: iconId });
  };

  const handleStrokeColorChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setLocalTheme({ ...localTheme, strokeColor: e.target.value });
  };

  const handleBgTypeChange = (bgType: 'solid' | 'gradient'): void => {
    setLocalTheme({ ...localTheme, bgType });
  };

  const handleBgColorChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setLocalTheme({ ...localTheme, bgColor: e.target.value });
  };

  const handleBgGradientEndChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setLocalTheme({ ...localTheme, bgGradientEnd: e.target.value });
  };

  const SelectedIcon = ICONS[localTheme.icon];

  const backgroundStyle = localTheme.bgType === 'gradient'
    ? `linear-gradient(to bottom right, ${localTheme.bgColor}, ${localTheme.bgGradientEnd})`
    : localTheme.bgColor;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neural-dark border border-neural-purple rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-neural-dark border-b border-gray-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6 text-neural-purple" />
            <h2 className="text-2xl font-bold">Customize Logo</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close customizer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Preview */}
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-8">
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-gray-400">Preview</p>
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center shadow-lg transition-all"
                style={{
                  background: backgroundStyle
                }}
              >
                <SelectedIcon
                  className="w-12 h-12"
                  style={{ stroke: localTheme.strokeColor, color: localTheme.strokeColor }}
                />
              </div>
            </div>
          </div>

          {/* Icon Selection */}
          <div>
            <h3 className="text-lg font-bold mb-3">Choose Icon</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ICON_OPTIONS.map((option) => {
                const Icon = ICONS[option.id];
                return (
                  <button
                    key={option.id}
                    onClick={() => handleIconChange(option.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      localTheme.icon === option.id
                        ? 'border-neural-purple bg-neural-purple/20'
                        : 'border-gray-800 bg-neural-darker hover:border-gray-700'
                    }`}
                    aria-pressed={localTheme.icon === option.id}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Icon className="w-8 h-8" style={{ stroke: '#a855f7', color: '#a855f7' }} />
                      <div className="text-xs font-medium">{option.name}</div>
                      <div className="text-xs text-gray-500">{option.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stroke Color */}
          <div>
            <h3 className="text-lg font-bold mb-3">Stroke Color</h3>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={localTheme.strokeColor}
                onChange={handleStrokeColorChange}
                className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-800"
                aria-label="Stroke color picker"
              />
              <input
                type="text"
                value={localTheme.strokeColor}
                onChange={handleStrokeColorChange}
                className="neural-input flex-1"
                placeholder="#ffffff"
                aria-label="Stroke color hex"
              />
            </div>
          </div>

          {/* Background Type */}
          <div>
            <h3 className="text-lg font-bold mb-3">Background Style</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleBgTypeChange('gradient')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  localTheme.bgType === 'gradient'
                    ? 'border-neural-purple bg-neural-purple/20'
                    : 'border-gray-800 bg-neural-darker hover:border-gray-700'
                }`}
                aria-pressed={localTheme.bgType === 'gradient'}
              >
                Gradient
              </button>
              <button
                onClick={() => handleBgTypeChange('solid')}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  localTheme.bgType === 'solid'
                    ? 'border-neural-purple bg-neural-purple/20'
                    : 'border-gray-800 bg-neural-darker hover:border-gray-700'
                }`}
                aria-pressed={localTheme.bgType === 'solid'}
              >
                Solid
              </button>
            </div>
          </div>

          {/* Background Color(s) */}
          {localTheme.bgType === 'gradient' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-bold mb-3">Gradient Start</h3>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={localTheme.bgColor}
                    onChange={handleBgColorChange}
                    className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-800"
                    aria-label="Gradient start color picker"
                  />
                  <input
                    type="text"
                    value={localTheme.bgColor}
                    onChange={handleBgColorChange}
                    className="neural-input flex-1"
                    placeholder="#a855f7"
                    aria-label="Gradient start color hex"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold mb-3">Gradient End</h3>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={localTheme.bgGradientEnd}
                    onChange={handleBgGradientEndChange}
                    className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-800"
                    aria-label="Gradient end color picker"
                  />
                  <input
                    type="text"
                    value={localTheme.bgGradientEnd}
                    onChange={handleBgGradientEndChange}
                    className="neural-input flex-1"
                    placeholder="#ec4899"
                    aria-label="Gradient end color hex"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold mb-3">Background Color</h3>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={localTheme.bgColor}
                  onChange={handleBgColorChange}
                  className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-800"
                  aria-label="Background color picker"
                />
                <input
                  type="text"
                  value={localTheme.bgColor}
                  onChange={handleBgColorChange}
                  className="neural-input flex-1"
                  placeholder="#a855f7"
                  aria-label="Background color hex"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neural-dark border-t border-gray-800 p-4 flex gap-3">
          <button
            onClick={handleReset}
            className="neural-button-secondary flex items-center gap-2"
            aria-label="Reset to default theme"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Default
          </button>
          <button
            onClick={handleSave}
            className="neural-button flex-1"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconCustomizer;

// Export the ICONS, DEFAULT_THEME, and IconTheme for use in App.tsx
export { ICONS, DEFAULT_THEME };
export type { IconTheme };
