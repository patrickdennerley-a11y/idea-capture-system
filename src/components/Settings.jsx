import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Palette, RotateCcw, Check } from 'lucide-react';
import { Brain as LucideBrain } from 'lucide-react';

// Default theme for icon customization
const DEFAULT_ICON_THEME = {
  icon: 'brain-lucide',
  strokeColor: '#ffffff',
  bgType: 'gradient',
  bgColor: '#a855f7',
  bgGradientEnd: '#ec4899',
};

// Icon SVG components
const ICONS = {
  'brain-lucide': (props) => (
    <LucideBrain {...props} />
  ),

  brain: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 5c-2.5 0-4 2-4 4 0 1 .5 2 1 2.5C8 12 7 13 7 14.5c0 1.5 1 3 2.5 3 .5 0 1-.2 1.5-.5.5 1.5 2 2.5 3.5 2.5s3-1 3.5-2.5c.5.3 1 .5 1.5.5 1.5 0 2.5-1.5 2.5-3 0-1.5-1-2.5-2-3 .5-.5 1-1.5 1-2.5 0-2-1.5-4-4-4-1 0-2 .5-2.5 1-.5-.5-1.5-1-2.5-1z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  ),

  sine: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M2 13h20" strokeLinecap="round" strokeWidth="1.5" opacity="0.5" />
      <path
        d="M2 13Q5 7 8 13T14 13Q17 7 20 13T22 13"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        fill="none"
      />
    </svg>
  ),

  neuralink: (props) => (
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

  rocket: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2v8m0 0l-3 3v5l3 2 3-2v-5l-3-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path d="M9 13l-3 2v3l3-2m6 0l3 2v3l-3-2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <path d="M10.5 20v2m3-2v2m-1.5 0v1.5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  wind: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M9 6h10a3 3 0 0 1 0 6H9" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 12h14a3 3 0 0 1 0 6H5" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18H5a3 3 0 0 1 0-6h7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),

  meditation: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="8" r="2.5" strokeWidth="2" />
      <path
        d="M12 10.5c-3 0-5 2-5 4.5v1.5h10V15c0-2.5-2-4.5-5-4.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 16c-1.5 1-2.5 2-3 3m13-3c1.5 1 2.5 2 3 3" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 5.5v-1m-2 1l1-2m3 2l-1-2" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),

  angel: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="4" r="2" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" strokeWidth="2" />
      <path
        d="M12 11.5c-3.5 0-5.5 2.5-5.5 5.5v2h11v-2c0-3-2-5.5-5.5-5.5z"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 14c-1.5-1-2.5-2-3.5-3.5-0.8-1.2-1-2.5-0.5-3.5 0.4-0.8 1.2-1 2-0.8 1 0.3 2 1.2 2.5 2.3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 13c-1-0.8-1.8-1.5-2.5-2.5" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M7 14.5c-0.8-0.5-1.5-1-2-1.8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path
        d="M17.5 14c1.5-1 2.5-2 3.5-3.5 0.8-1.2 1-2.5 0.5-3.5-0.4-0.8-1.2-1-2-0.8-1 0.3-2 1.2-2.5 2.3"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 13c1-0.8 1.8-1.5 2.5-2.5" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <path d="M17 14.5c0.8-0.5 1.5-1 2-1.8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),

  uni: (props) => (
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

  constellation: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      <circle cx="8" cy="14" r="1.5" fill="currentColor" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <path d="M12 7l4 3m0 4l-4 3m0 0l-4-3m0-4l4-3m0 10V7M8 10l8 4m0-4l-8 4" strokeWidth="1.2" opacity="0.4" />
    </svg>
  ),

  molecule: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 10V6m2 6h6m-2 6v-6m-6 2h-6" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="6" ry="3" strokeWidth="1" opacity="0.3" transform="rotate(45 12 12)" />
      <ellipse cx="12" cy="12" rx="6" ry="3" strokeWidth="1" opacity="0.3" transform="rotate(-45 12 12)" />
    </svg>
  ),

  network: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <circle cx="7" cy="9" r="1.5" fill="currentColor" />
      <circle cx="7" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="17" r="1.5" fill="currentColor" />
      <circle cx="17" cy="9" r="1.5" fill="currentColor" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
      <path d="M8.5 9.5l3 -2m-3.5 5.5l3 -3m0 0l3 -2m-3 2l3 3m-3-3v5m-3-5l3 5m3-10l-3 5m3 1l-3-5" strokeWidth="1" opacity="0.4" />
    </svg>
  ),
};

const ICON_OPTIONS = [
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

export default function Settings({ iconTheme, setIconTheme }) {
  const { theme, setTheme, themes } = useTheme();
  const [localIconTheme, setLocalIconTheme] = useState(iconTheme);

  const handleIconSave = () => {
    setIconTheme(localIconTheme);
  };

  const handleIconReset = () => {
    setLocalIconTheme(DEFAULT_ICON_THEME);
    setIconTheme(DEFAULT_ICON_THEME);
  };

  const SelectedIcon = ICONS[localIconTheme.icon];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Customize your Neural Capture experience</p>
      </div>

      {/* SECTION 1: Theme Selector */}
      <section className="neural-card">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Palette className="w-6 h-6 text-purple-400" />
          Theme
        </h2>
        <p className="text-gray-400 mb-6">Choose your preferred color scheme</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(themes).map(([themeId, themeConfig]) => {
            const isActive = theme === themeId;
            return (
              <button
                key={themeId}
                onClick={() => setTheme(themeId)}
                className={`p-6 rounded-lg border-2 transition-all text-left ${
                  isActive
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{themeConfig.name}</h3>
                    <p className="text-sm text-gray-400">{themeConfig.description}</p>
                  </div>
                  {isActive && (
                    <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  )}
                </div>

                {/* Color preview swatches */}
                <div className="flex gap-2">
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: themeConfig.variables['--bg-primary'] }}
                    title="Background"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: themeConfig.variables['--bg-card'] }}
                    title="Card"
                  />
                  <div
                    className="w-8 h-8 rounded border border-gray-600"
                    style={{ backgroundColor: themeConfig.variables['--accent'] }}
                    title="Accent"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: App Icon Customizer */}
      <section className="neural-card">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Palette className="w-6 h-6 text-pink-400" />
          App Icon Customization
        </h2>
        <p className="text-gray-400 mb-6">Personalize your app logo with different icons, colors, and backgrounds</p>

        {/* Preview */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 mb-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400">Preview</p>
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center shadow-lg transition-all"
              style={{
                background: localIconTheme.bgType === 'gradient'
                  ? `linear-gradient(to bottom right, ${localIconTheme.bgColor}, ${localIconTheme.bgGradientEnd})`
                  : localIconTheme.bgColor
              }}
            >
              <SelectedIcon
                className="w-12 h-12"
                style={{ stroke: localIconTheme.strokeColor, color: localIconTheme.strokeColor }}
              />
            </div>
          </div>
        </div>

        {/* Icon Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Choose Icon</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ICON_OPTIONS.map((option) => {
              const Icon = ICONS[option.id];
              return (
                <button
                  key={option.id}
                  onClick={() => setLocalIconTheme({ ...localIconTheme, icon: option.id })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    localIconTheme.icon === option.id
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon className="w-8 h-8" style={{ stroke: '#a855f7', color: '#a855f7' }} />
                    <div className="text-xs font-medium text-center">{option.name}</div>
                    <div className="text-xs text-gray-500 text-center">{option.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stroke Color */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Stroke Color</h3>
          <div className="flex gap-3 items-center">
            <input
              type="color"
              value={localIconTheme.strokeColor}
              onChange={(e) => setLocalIconTheme({ ...localIconTheme, strokeColor: e.target.value })}
              className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
            />
            <input
              type="text"
              value={localIconTheme.strokeColor}
              onChange={(e) => setLocalIconTheme({ ...localIconTheme, strokeColor: e.target.value })}
              className="neural-input flex-1"
              placeholder="#ffffff"
            />
          </div>
        </div>

        {/* Background Type */}
        <div className="mb-6">
          <h3 className="text-lg font-bold mb-3">Background Style</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setLocalIconTheme({ ...localIconTheme, bgType: 'gradient' })}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                localIconTheme.bgType === 'gradient'
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              Gradient
            </button>
            <button
              onClick={() => setLocalIconTheme({ ...localIconTheme, bgType: 'solid' })}
              className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                localIconTheme.bgType === 'solid'
                  ? 'border-purple-500 bg-purple-500/20'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              Solid
            </button>
          </div>
        </div>

        {/* Background Color(s) */}
        {localIconTheme.bgType === 'gradient' ? (
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-lg font-bold mb-3">Gradient Start</h3>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={localIconTheme.bgColor}
                  onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgColor: e.target.value })}
                  className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
                />
                <input
                  type="text"
                  value={localIconTheme.bgColor}
                  onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgColor: e.target.value })}
                  className="neural-input flex-1"
                  placeholder="#a855f7"
                />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-3">Gradient End</h3>
              <div className="flex gap-3 items-center">
                <input
                  type="color"
                  value={localIconTheme.bgGradientEnd}
                  onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgGradientEnd: e.target.value })}
                  className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
                />
                <input
                  type="text"
                  value={localIconTheme.bgGradientEnd}
                  onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgGradientEnd: e.target.value })}
                  className="neural-input flex-1"
                  placeholder="#ec4899"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-3">Background Color</h3>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={localIconTheme.bgColor}
                onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgColor: e.target.value })}
                className="w-16 h-12 rounded-lg cursor-pointer border-2 border-gray-700"
              />
              <input
                type="text"
                value={localIconTheme.bgColor}
                onChange={(e) => setLocalIconTheme({ ...localIconTheme, bgColor: e.target.value })}
                className="neural-input flex-1"
                placeholder="#a855f7"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleIconReset}
            className="neural-button-secondary flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Icon to Default
          </button>
          <button
            onClick={handleIconSave}
            className="neural-button flex-1"
          >
            Save Icon Changes
          </button>
        </div>
      </section>
    </div>
  );
}

// Export ICONS and DEFAULT_ICON_THEME for use in App.jsx
export { ICONS, DEFAULT_ICON_THEME };
