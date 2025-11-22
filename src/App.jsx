import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useSupabase } from './hooks/useSupabase';
import { useAuth } from './contexts/AuthContext';
import { isSupabaseConfigured } from './utils/supabaseClient';
import { migrateAllData, hasLocalStorageData, getMigrationStatus } from './utils/dataMigration';
import { processQueue, getSyncStatus, hasPendingOperations } from './utils/offlineQueue';
import Auth from './components/Auth';
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
  LogOut,
  Cloud,
  CloudOff,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { getTodayString } from './utils/dateUtils';

const TABS = [
  { id: 'capture', name: 'Capture', icon: Lightbulb, color: 'yellow' },
  { id: 'checklist', name: 'Routines', icon: CheckCircle2, color: 'purple' },
  { id: 'logger', name: 'Log', icon: Activity, color: 'blue' },
  { id: 'plan', name: 'Plan', icon: Compass, color: 'green' },
  { id: 'routine', name: 'Generate', icon: Calendar, color: 'purple' },
  { id: 'review', name: 'Review', icon: Moon, color: 'purple' },
  { id: 'noise', name: 'Noise', icon: Radio, color: 'pink' },
];

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('capture');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIconCustomizer, setShowIconCustomizer] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Migration state
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationError, setMigrationError] = useState(null);

  // Sync state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);

  // State with cloud sync via Supabase (fallback to localStorage when offline or not authenticated)
  const [ideas, setIdeas, ideasMeta] = useSupabase('ideas', 'neural-ideas', []);
  const [logs, setLogs, logsMeta] = useSupabase('logs', 'neural-logs', []);
  const [reviews, setReviews, reviewsMeta] = useSupabase('reviews', 'neural-reviews', []);

  // Checklist stays as localStorage for now (different structure than Supabase schema)
  // TODO: Migrate checklist to use checklist_items table with proper transform
  const [checklist, setChecklist] = useLocalStorage('neural-checklist', {
    date: getTodayString(),
    items: [],
  });

  const [iconTheme, setIconTheme] = useLocalStorage('neural-icon-theme', DEFAULT_THEME);

  // Routine generation state (persists across tab switches)
  const [isGeneratingRoutine, setIsGeneratingRoutine] = useState(false);
  const [generatedRoutine, setGeneratedRoutine] = useState(null);
  const [routineError, setRoutineError] = useState(null);

  // Idea organization state (persists across tab switches)
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [organizedData, setOrganizedData] = useState(null);
  const [organizationError, setOrganizationError] = useState(null);
  const [showOrganized, setShowOrganized] = useState(false);

  // Planning state (persists across tab switches)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState(null);

  // Smart Routines state (persists across tab switches)
  const [smartRoutines, setSmartRoutines] = useState([]);
  const [isGeneratingSmartRoutines, setIsGeneratingSmartRoutines] = useState(false);
  const [smartRoutinesError, setSmartRoutinesError] = useState(null);
  const [showSmartRoutines, setShowSmartRoutines] = useState(false);
  const [smartRoutinesMetadata, setSmartRoutinesMetadata] = useState(null);
  const [smartRoutineStates, setSmartRoutineStates] = useState({});

  // History for all AI generations
  const [generationHistory, setGenerationHistory] = useLocalStorage('neural-generation-history', {
    routines: [],
    smartRoutines: [],
    ideas: [],
    plans: []
  });

  // Noise Generator state (persists across tab switches)
  const audioContextRef = useRef(null);
  const [activeSession, setActiveSession] = useState(null);

  // Check authentication status
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // No Supabase, always authenticated (localStorage mode)
      setIsAuthenticated(true);
      return;
    }

    if (!authLoading) {
      setIsAuthenticated(!!user);

      // Check for migration needs after auth
      if (user) {
        const migrationStatus = getMigrationStatus();
        if (!migrationStatus?.completed && hasLocalStorageData()) {
          setShowMigrationPrompt(true);
        }
      }
    }
  }, [user, authLoading]);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      if (hasPendingOperations()) {
        await handleSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending ops count
    const interval = setInterval(() => {
      setPendingOps(hasPendingOperations() ? getSyncStatus().pending : 0);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Initialize audio context once at app level (never destroyed)
  useEffect(() => {
    if (!audioContextRef.current && typeof window !== 'undefined') {
      try {
        // FIX: Add latencyHint: 'playback' to prevent crackling under heavy CPU load
        // This gives the browser a larger audio buffer to survive CPU spikes (e.g., switching to heavy tabs)
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'playback',
          sampleRate: 44100 // Optional: locks rate to standard to reduce resampling overhead
        });
        console.log('🔊 Audio context initialized at app level with playback latency hint');
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

  // Migration handler
  const handleMigration = async () => {
    setIsMigrating(true);
    setMigrationError(null);

    const result = await migrateAllData();

    if (result.success) {
      setMigrationComplete(true);
      setTimeout(() => {
        setShowMigrationPrompt(false);
        setMigrationComplete(false);
      }, 3000);
    } else {
      setMigrationError(result.error || 'Migration failed');
    }

    setIsMigrating(false);
  };

  // Sync handler
  const handleSync = async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);

    const result = await processQueue((progress) => {
      console.log(`Syncing: ${progress.current}/${progress.total}`);
    });

    if (result.success) {
      setPendingOps(0);
    }

    setIsSyncing(false);
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOut();
    setIsAuthenticated(false);
  };

  // Helper to check if a tab has AI work in progress
  const isTabProcessing = (tabId) => {
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
        return <IdeaCapture ideas={ideas} setIdeas={setIdeas} />;
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

  // Show auth screen if not authenticated and Supabase is configured
  if (authLoading) {
    return (
      <div className="min-h-screen bg-neural-darker flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🧠</div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isSupabaseConfigured() && !isAuthenticated) {
    return <Auth onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-neural-darker">
      {/* Migration Prompt Modal */}
      {showMigrationPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-neural-dark rounded-2xl shadow-xl p-6 max-w-md w-full border border-gray-800">
            <div className="text-center mb-6">
              <Upload className="w-16 h-16 mx-auto text-neural-purple mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Migrate Your Data to Cloud
              </h2>
              <p className="text-gray-400">
                We found {ideas.length + logs.length + (checklist.items?.length || 0) + reviews.length} items in your local storage.
                Would you like to sync them to the cloud?
              </p>
            </div>

            {migrationComplete && (
              <div className="mb-4 p-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg text-green-400 text-sm">
                ✓ Migration completed successfully!
              </div>
            )}

            {migrationError && (
              <div className="mb-4 p-4 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg text-red-400 text-sm">
                {migrationError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowMigrationPrompt(false)}
                disabled={isMigrating}
                className="flex-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Skip for Now
              </button>
              <button
                onClick={handleMigration}
                disabled={isMigrating}
                className="flex-1 px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isMigrating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  'Migrate Now'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      strokeWidth={2}
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

              {/* Sync Status & Actions */}
              {isSupabaseConfigured() && user && (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-700">
                  {/* Sync Status */}
                  <button
                    onClick={handleSync}
                    disabled={!isOnline || isSyncing}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isOnline ? 'Sync now' : 'Offline'}
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isOnline ? (
                      <Cloud className="w-4 h-4" />
                    ) : (
                      <CloudOff className="w-4 h-4" />
                    )}
                    {pendingOps > 0 && (
                      <span className="text-xs bg-neural-purple rounded-full px-2 py-0.5">
                        {pendingOps}
                      </span>
                    )}
                  </button>

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all"
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
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
              <span>v0.2.0</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {isSupabaseConfigured() && user ? (
                  <>
                    <Cloud className="w-3 h-3" />
                    <span>Cloud sync enabled</span>
                  </>
                ) : (
                  <>
                    <span>Local storage only</span>
                  </>
                )}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">
                {ideas.length} ideas • {logs.length} logs
              </span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-neural-darker rounded-lg border border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              {isSupabaseConfigured() && user ? (
                <>
                  ✨ <strong>Cloud Sync Active:</strong> Your data syncs across all devices. Works offline!
                </>
              ) : (
                <>
                  💡 <strong>Pro Tip:</strong> Set up Supabase for cloud sync across devices
                </>
              )}
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
