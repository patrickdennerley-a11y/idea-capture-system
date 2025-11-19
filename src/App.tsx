import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import IdeaCapture from './components/IdeaCapture';
import DailyChecklist from './components/DailyChecklist';
import QuickLogger from './components/QuickLogger';
import EndOfDayReview from './components/EndOfDayReview';
import NoiseHub from './components/NoiseHub';
import PlanningAssistant from './components/PlanningAssistant';
import RoutineGenerator from './components/RoutineGenerator';
import IconCustomizer, { ICONS, DEFAULT_THEME } from './components/IconCustomizer';
import {
  Lightbulb,
  CheckCircle2,
  Activity,
  Moon,
  Radio,
  Menu,
  X,
  Compass,
  Calendar,
  LucideIcon,
} from 'lucide-react';
import { getTodayString } from './utils/dateUtils';

interface Tab {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
}

const TABS: Tab[] = [
  { id: 'capture', name: 'Capture', icon: Lightbulb, color: 'yellow' },
  { id: 'checklist', name: 'Routines', icon: CheckCircle2, color: 'purple' },
  { id: 'logger', name: 'Log', icon: Activity, color: 'blue' },
  { id: 'plan', name: 'Plan', icon: Compass, color: 'green' },
  { id: 'routine', name: 'Generate', icon: Calendar, color: 'purple' },
  { id: 'review', name: 'Review', icon: Moon, color: 'purple' },
  { id: 'noise', name: 'Noise', icon: Radio, color: 'pink' },
];

function App() {
  const [activeTab, setActiveTab] = useState('capture');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIconCustomizer, setShowIconCustomizer] = useState(false);

  // State with localStorage persistence
  const [ideas, setIdeas] = useLocalStorage<any[]>('neural-ideas', []);
  const [logs, setLogs] = useLocalStorage<any[]>('neural-logs', []);
  const [reviews, setReviews] = useLocalStorage<any[]>('neural-reviews', []);
  const [checklist, setChecklist] = useLocalStorage<any>('neural-checklist', {
    date: getTodayString(),
    items: [],
  });
  const [iconTheme, setIconTheme] = useLocalStorage<typeof DEFAULT_THEME>('neural-icon-theme', DEFAULT_THEME);

  // Routine generation state (persists across tab switches)
  const [isGeneratingRoutine, setIsGeneratingRoutine] = useState(false);
  const [generatedRoutine, setGeneratedRoutine] = useState<any>(null);
  const [routineError, setRoutineError] = useState<string | null>(null);

  // Idea organization state (persists across tab switches)
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizedData, setOrganizedData] = useState<any>(null);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [showOrganized, setShowOrganized] = useState(false);

  // Planning state (persists across tab switches)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Smart Routines state (persists across tab switches)
  const [smartRoutines, setSmartRoutines] = useState<any[]>([]);
  const [isGeneratingSmartRoutines, setIsGeneratingSmartRoutines] = useState(false);
  const [smartRoutinesError, setSmartRoutinesError] = useState<string | null>(null);
  const [showSmartRoutines, setShowSmartRoutines] = useState(false);
  const [smartRoutinesMetadata, setSmartRoutinesMetadata] = useState<any>(null);
  const [smartRoutineStates, setSmartRoutineStates] = useState<Record<string, any>>({});

  // History for all AI generations
  const [generationHistory, setGenerationHistory] = useLocalStorage<any>('neural-generation-history', {
    routines: [],
    smartRoutines: [],
    ideas: [],
    plans: []
  });

  // Noise Generator state (persists across tab switches)
  const audioContextRef = useRef<AudioContext | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);

  // Initialize audio context once at app level (never destroyed)
  useEffect(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('🔊 Audio context initialized at app level');
      } catch (err) {
        console.error('Failed to initialize audio context:', err);
      }
    }

    // Important: Don't cleanup in development (React StrictMode unmounts/remounts)
    // Only cleanup on actual app unmount
    return () => {
      // Don't close AudioContext here - it causes issues with React StrictMode
      // The browser will clean it up when the page unloads
      console.log('🔊 Audio context cleanup skipped (preserving for tab switches)');
    };
  }, []);

  // Helper to check if a tab has AI work in progress
  const isTabProcessing = (tabId: string): boolean => {
    switch (tabId) {
      case 'capture':
        return isOrganizing;
      case 'plan':
        return isAnalyzing;
      case 'checklist':
        return isGeneratingSmartRoutines;
      case 'routine':
        return isGeneratingRoutine || isGeneratingSmartRoutines;
      default:
        return false;
    }
  };

  // Memoize renderActiveTab to prevent unnecessary re-renders
  const renderActiveTab = useCallback(() => {
    switch (activeTab) {
      case 'capture':
        return (
          <IdeaCapture
            ideas={ideas}
            setIdeas={setIdeas}
            isOrganizing={isOrganizing}
            setIsOrganizing={setIsOrganizing}
            organizedData={organizedData}
            setOrganizedData={setOrganizedData}
            organizationError={organizationError}
            setOrganizationError={setOrganizationError}
            showOrganized={showOrganized}
            setShowOrganized={setShowOrganized}
          />
        );
      case 'checklist':
        return <DailyChecklist checklist={checklist} setChecklist={setChecklist} />;
      case 'logger':
        return <QuickLogger logs={logs} setLogs={setLogs} />;
      case 'plan':
        return (
          <PlanningAssistant
            ideas={ideas}
            logs={logs}
            checklist={checklist}
            reviews={reviews}
            isAnalyzing={isAnalyzing}
            setIsAnalyzing={setIsAnalyzing}
            plan={plan}
            setPlan={setPlan}
            planError={planError}
            setPlanError={setPlanError}
          />
        );
      case 'routine':
        return (
          <RoutineGenerator
            ideas={ideas}
            logs={logs}
            checklist={checklist}
            reviews={reviews}
            isGeneratingRoutine={isGeneratingRoutine}
            setIsGeneratingRoutine={setIsGeneratingRoutine}
            generatedRoutine={generatedRoutine}
            setGeneratedRoutine={setGeneratedRoutine}
            routineError={routineError}
            setRoutineError={setRoutineError}
            smartRoutines={smartRoutines}
            setSmartRoutines={setSmartRoutines}
            isGeneratingSmartRoutines={isGeneratingSmartRoutines}
            setIsGeneratingSmartRoutines={setIsGeneratingSmartRoutines}
            smartRoutinesError={smartRoutinesError}
            setSmartRoutinesError={setSmartRoutinesError}
            showSmartRoutines={showSmartRoutines}
            setShowSmartRoutines={setShowSmartRoutines}
            smartRoutinesMetadata={smartRoutinesMetadata}
            setSmartRoutinesMetadata={setSmartRoutinesMetadata}
            smartRoutineStates={smartRoutineStates}
            setSmartRoutineStates={setSmartRoutineStates}
            generationHistory={generationHistory}
            setGenerationHistory={setGenerationHistory}
          />
        );
      case 'review':
        return (
          <EndOfDayReview
            reviews={reviews}
            setReviews={setReviews}
            logs={logs}
            checklist={checklist}
          />
        );
      case 'noise':
        return (
          <NoiseHub
            audioContextRef={audioContextRef}
            activeSession={activeSession}
            setActiveSession={setActiveSession}
          />
        );
      default:
        return (
          <IdeaCapture
            ideas={ideas}
            setIdeas={setIdeas}
            isOrganizing={isOrganizing}
            setIsOrganizing={setIsOrganizing}
            organizedData={organizedData}
            setOrganizedData={setOrganizedData}
            organizationError={organizationError}
            setOrganizationError={setOrganizationError}
            showOrganized={showOrganized}
            setShowOrganized={setShowOrganized}
          />
        );
    }
  }, [
    activeTab,
    ideas,
    setIdeas,
    logs,
    setLogs,
    checklist,
    setChecklist,
    reviews,
    setReviews,
    isOrganizing,
    setIsOrganizing,
    organizedData,
    setOrganizedData,
    organizationError,
    setOrganizationError,
    showOrganized,
    setShowOrganized,
    isAnalyzing,
    setIsAnalyzing,
    plan,
    setPlan,
    planError,
    setPlanError,
    isGeneratingRoutine,
    setIsGeneratingRoutine,
    generatedRoutine,
    setGeneratedRoutine,
    routineError,
    setRoutineError,
    smartRoutines,
    setSmartRoutines,
    isGeneratingSmartRoutines,
    setIsGeneratingSmartRoutines,
    smartRoutinesError,
    setSmartRoutinesError,
    showSmartRoutines,
    setShowSmartRoutines,
    smartRoutinesMetadata,
    setSmartRoutinesMetadata,
    smartRoutineStates,
    setSmartRoutineStates,
    generationHistory,
    setGenerationHistory,
    audioContextRef,
    activeSession,
    setActiveSession,
  ]);

  return (
    <div className="min-h-screen bg-neural-darker">
      {/* Header */}
      <header className="bg-neural-dark border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button
              onClick={() => setShowIconCustomizer(true)}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all"
                style={{
                  background: iconTheme.bgType === 'gradient'
                    ? `linear-gradient(to bottom right, ${iconTheme.bgColor}, ${iconTheme.bgGradientEnd})`
                    : iconTheme.bgColor
                }}
              >
                {(() => {
                  const IconComponent = ICONS[iconTheme.icon];
                  return (
                    <IconComponent
                      className="w-6 h-6"
                      style={{ stroke: iconTheme.strokeColor, color: iconTheme.strokeColor }}
                    />
                  );
                })()}
              </div>
              <div className="text-left">
                <h1 className="text-xl font-bold">Neural Capture</h1>
                <p className="text-xs text-gray-400 hidden sm:block">Your Personal Life OS</p>
              </div>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isProcessing = isTabProcessing(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-neural-purple text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{tab.name}</span>
                    {isProcessing && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-neural-purple rounded-full pulse-glow">
                        <span className="absolute inset-0 w-3 h-3 bg-neural-purple rounded-full animate-ping"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-800 animate-slide-in">
              <nav className="flex flex-col gap-2">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isProcessing = isTabProcessing(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        activeTab === tab.id
                          ? 'bg-neural-purple text-white'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                      {isProcessing && (
                        <span className="ml-auto w-2 h-2 bg-neural-purple rounded-full pulse-glow">
                          <span className="absolute inset-0 w-2 h-2 bg-neural-purple rounded-full animate-ping"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderActiveTab()}
      </main>

      {/* Footer */}
      <footer className="bg-neural-dark border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Built for an ADHD brain that generates ideas faster than it can execute them.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>v0.1.0 MVP</span>
              <span>•</span>
              <span>Data stored locally</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">
                {ideas.length} ideas • {logs.length} logs
              </span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-neural-darker rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              💡 <strong>Next Phase:</strong> Connect Claude API for AI organization, pattern analysis, and personalized suggestions
            </p>
          </div>
        </div>
      </footer>

      {/* Floating Quick Actions (Mobile) */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button
          onClick={() => {
            setActiveTab('capture');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="w-14 h-14 bg-gradient-to-br from-neural-purple to-neural-pink rounded-full shadow-lg flex items-center justify-center pulse-glow"
        >
          <Lightbulb className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Icon Customizer Modal */}
      <IconCustomizer
        isOpen={showIconCustomizer}
        onClose={() => setShowIconCustomizer(false)}
        theme={iconTheme}
        setTheme={setIconTheme}
      />
    </div>
  );
}

export default App;
