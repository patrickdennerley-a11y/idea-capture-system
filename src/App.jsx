import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useLocalStorage } from './hooks/useLocalStorage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './supabaseClient';
import { dbArrayToJs } from './utils/ideaMapper';
import Auth from './components/Auth';
import ForgotPassword from './components/ForgotPassword';
import UpdatePassword from './components/UpdatePassword';
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
  ChevronDown,
} from 'lucide-react';
import { getTodayString } from './utils/dateUtils';

// Grouped navigation structure
const NAV_ITEMS = [
  { id: 'capture', name: 'Capture', icon: Lightbulb, type: 'single' },
  { 
    id: 'plan-group', 
    name: 'Plan', 
    icon: Compass, 
    type: 'group',
    items: [
      { id: 'checklist', name: 'Routines', icon: CheckCircle2 },
      { id: 'plan', name: 'Plan', icon: Compass },
      { id: 'routine', name: 'Generate', icon: Calendar },
    ]
  },
  { 
    id: 'track-group', 
    name: 'Track', 
    icon: Activity, 
    type: 'group',
    items: [
      { id: 'logger', name: 'Log', icon: Activity },
      { id: 'review', name: 'Review', icon: Moon },
    ]
  },
  { id: 'noise', name: 'Noise', icon: Radio, type: 'single' },
];

// Flatten NAV_ITEMS for mobile menu
const FLAT_NAV_ITEMS = NAV_ITEMS.flatMap(item => 
  item.type === 'group' ? item.items : [item]
);

// NavDropdown Component for grouped navigation items
function NavDropdown({ item, activeTab, setActiveTab, isTabProcessing }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);
  
  // Check if any child tab is active
  const isChildActive = item.items.some(child => child.id === activeTab);
  
  // Check if any child tab is processing
  const isChildProcessing = item.items.some(child => isTabProcessing(child.id));
  
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  };
  
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150); // Small delay to allow moving to dropdown
  };
  
  const handleItemClick = (childId) => {
    setActiveTab(childId);
    setIsOpen(false);
  };
  
  const Icon = item.icon;
  
  return (
    <div 
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
          isChildActive
            ? 'bg-neural-purple text-white'
            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden lg:inline">{item.name}</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        {isChildProcessing && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-neural-purple rounded-full pulse-glow">
            <span className="absolute inset-0 w-3 h-3 bg-neural-purple rounded-full animate-ping"></span>
          </span>
        )}
      </button>
      
      {/* Dropdown Menu */}
      <div 
        className={`absolute top-full left-0 mt-1 min-w-[160px] bg-neural-dark border border-gray-800 rounded-lg shadow-lg overflow-hidden transition-all duration-200 origin-top ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        {item.items.map((child) => {
          const ChildIcon = child.icon;
          const isProcessing = isTabProcessing(child.id);
          return (
            <button
              key={child.id}
              onClick={() => handleItemClick(child.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 font-medium transition-all ${
                activeTab === child.id
                  ? 'bg-neural-purple text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              <ChildIcon className="w-4 h-4" />
              <span>{child.name}</span>
              {isProcessing && (
                <span className="ml-auto w-2 h-2 bg-neural-purple rounded-full pulse-glow">
                  <span className="absolute w-2 h-2 bg-neural-purple rounded-full animate-ping"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Protected Dashboard Component
function Dashboard() {
  const navigate = useNavigate();
  const { logout, user, exitGuestMode } = useAuth();
  const [activeTab, setActiveTab] = useState('capture');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIconCustomizer, setShowIconCustomizer] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to logout: ' + error.message);
    }
  };

  const handleSignUpFromGuest = () => {
    // Clear guest mode state before navigating
    exitGuestMode();
    // Navigate will trigger route guard re-evaluation
    navigate('/auth');
  };

  // State with localStorage persistence (logs still use localStorage)
  const [ideas, setIdeas] = useState([]);
  const [logs, setLogs] = useLocalStorage('neural-logs', []);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState(null);
  const [reviews, setReviews] = useLocalStorage('neural-reviews', []);
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

  // Fetch ideas from Supabase or localStorage on mount
  useEffect(() => {
    const fetchIdeas = async () => {
      if (!user?.id) {
        setIdeasLoading(false);
        return;
      }

      // Guest mode: use localStorage
      if (user.isGuest) {
        try {
          const storedIdeas = localStorage.getItem('neural-guest-ideas');
          if (storedIdeas) {
            setIdeas(JSON.parse(storedIdeas));
          }
        } catch (error) {
          console.error('Error loading guest ideas:', error);
        }
        setIdeasLoading(false);
        return;
      }

      // Regular user: fetch from Supabase
      try {
        setIdeasLoading(true);
        setIdeasError(null);

        const { data, error } = await supabase
          .from('ideas')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Convert database rows to JavaScript objects
        const jsIdeas = dbArrayToJs(data);
        setIdeas(jsIdeas);
      } catch (error) {
        console.error('Error fetching ideas:', error);
        setIdeasError(error.message);
      } finally {
        setIdeasLoading(false);
      }
    };

    fetchIdeas();
  }, [user?.id, user?.isGuest]);

  // Sync guest ideas to localStorage whenever they change
  useEffect(() => {
    if (user?.isGuest && ideas.length > 0) {
      try {
        localStorage.setItem('neural-guest-ideas', JSON.stringify(ideas));
      } catch (error) {
        console.error('Error saving guest ideas to localStorage:', error);
      }
    }
  }, [ideas, user?.isGuest]);

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
              {NAV_ITEMS.map((item) => {
                if (item.type === 'group') {
                  return (
                    <NavDropdown
                      key={item.id}
                      item={item}
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      isTabProcessing={isTabProcessing}
                    />
                  );
                }
                
                // Single item rendering
                const Icon = item.icon;
                const isProcessing = isTabProcessing(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-neural-purple text-white'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.name}</span>
                    {isProcessing && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-neural-purple rounded-full pulse-glow">
                        <span className="absolute inset-0 w-3 h-3 bg-neural-purple rounded-full animate-ping"></span>
                      </span>
                    )}
                  </button>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-gray-400 hover:text-red-400 hover:bg-gray-800"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Logout</span>
              </button>
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
              <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  if (item.type === 'group') {
                    return (
                      <div key={item.id} className="mb-1">
                        {/* Group Header */}
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {item.name}
                        </div>
                        {/* Group Items */}
                        {item.items.map((child) => {
                          const ChildIcon = child.icon;
                          const isProcessing = isTabProcessing(child.id);
                          return (
                            <button
                              key={child.id}
                              onClick={() => {
                                setActiveTab(child.id);
                                setMobileMenuOpen(false);
                              }}
                              className={`relative w-full flex items-center gap-3 px-4 py-3 pl-8 rounded-lg font-medium transition-all ${
                                activeTab === child.id
                                  ? 'bg-neural-purple text-white'
                                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                              }`}
                            >
                              <ChildIcon className="w-5 h-5" />
                              <span>{child.name}</span>
                              {isProcessing && (
                                <span className="ml-auto w-2 h-2 bg-neural-purple rounded-full pulse-glow">
                                  <span className="absolute w-2 h-2 bg-neural-purple rounded-full animate-ping"></span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  
                  // Single item rendering
                  const Icon = item.icon;
                  const isProcessing = isTabProcessing(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        activeTab === item.id
                          ? 'bg-neural-purple text-white'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                      {isProcessing && (
                        <span className="ml-auto w-2 h-2 bg-neural-purple rounded-full pulse-glow">
                          <span className="absolute w-2 h-2 bg-neural-purple rounded-full animate-ping"></span>
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all text-gray-400 hover:text-red-400 hover:bg-gray-800"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Guest Mode Banner */}
      {user?.isGuest && (
        <div className="bg-amber-500/10 border-b border-amber-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-amber-200">
                You're in guest mode. Sign up to sync across devices.
              </p>
              <button
                onClick={handleSignUpFromGuest}
                className="text-sm font-medium text-amber-300 hover:text-amber-100 underline whitespace-nowrap"
              >
                Sign up
              </button>
            </div>
          </div>
        </div>
      )}

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

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neural-darker flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-neural-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

// Public Route Component (redirects to dashboard if already authenticated)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neural-darker flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-neural-purple border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Main App Component with Authentication and Routing
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <Auth />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/update-password"
            element={
              <ProtectedRoute>
                <UpdatePassword />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
