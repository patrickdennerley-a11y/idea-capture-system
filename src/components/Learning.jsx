import { useState, useEffect, useMemo } from 'react';
import { BookOpen, ChevronRight, Check, X, Trophy, RotateCcw, Loader2, AlertCircle, BarChart3, Clock, Target, Flame, ChevronDown, Settings, History, Filter, ChevronUp, Lock, Rocket, Shield, AlertTriangle, Crosshair, Lightbulb, ArrowLeft } from 'lucide-react';
import { generatePracticeQuestions, evaluateAnswer } from '../utils/apiService';
import CheatSheetViewer from './CheatSheetViewer';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { useAuth } from '../contexts/AuthContext';
import {
  saveQuestionToHistory as saveToService,
  getQuestionHistory,
  getAllScores,
  saveBestScore,
  getProgressStats as getProgressStatsFromService,
  getMastery,
  updateMastery,
  getRecommendedDifficulty,
  resetSessionCounters,
  migrateGuestDataToSupabase,
} from '../utils/learningService';
import { SUBJECT_CATALOGUE, getAllSubjects, getCategoryForSubject } from '../data/subjectCatalogue';

// Get flat subjects object for backward compatibility
const SUBJECTS = getAllSubjects();

// Difficulty options with descriptions
const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: 'text-green-400', bgColor: 'bg-green-500/20', description: 'Single concept, straightforward' },
  { id: 'medium', name: 'Medium', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', description: 'Standard textbook level' },
  { id: 'hard', name: 'Hard', color: 'text-orange-400', bgColor: 'bg-orange-500/20', description: 'Multi-step, combining concepts' },
  { id: 'extreme', name: 'Extreme', color: 'text-red-400', bgColor: 'bg-red-500/20', description: 'Competition-level difficulty' },
];

// Question count options
const QUESTION_COUNTS = [5, 10, 15, 20];

// Question style options
const QUESTION_STYLES = [
  { id: 'balanced', name: 'Balanced Mix', description: 'Mix of all question types' },
  { id: 'conceptual', name: 'Conceptual Focus', description: 'Why & how questions, minimal calculations' },
  { id: 'calculation', name: 'Calculation Heavy', description: 'Numerical problems & step-by-step math' },
  { id: 'formula', name: 'Formula & Equations', description: 'Equations, derivations, formula applications' },
  { id: 'application', name: 'Real-World Applications', description: 'Practical scenarios & data interpretation' },
  { id: 'proof', name: 'Proof-Based', description: 'Rigorous proofs, derivations, and theoretical arguments' },
];

// Focus mode options
const FOCUS_MODES = [
  { id: 'understanding', name: 'Understanding', description: 'Deep comprehension, why/how questions' },
  { id: 'memorization', name: 'Memorization', description: 'Definitions, formulas, key facts' },
  { id: 'holistic', name: 'Holistic', description: 'Cross-concept connections, synthesis' },
];

// Helper to render LaTeX in text
const renderMathText = (text) => {
  if (!text) return null;
  
  const parts = text.split(/(\$\$[^$]+\$\$)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const latex = part.slice(2, -2);
      try {
        return <BlockMath key={idx} math={latex} />;
      } catch (e) {
        return <span key={idx} className="text-red-400">{part}</span>;
      }
    }
    
    const inlineParts = part.split(/(\$[^$]+\$)/g);
    return inlineParts.map((inlinePart, inlineIdx) => {
      if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
        const latex = inlinePart.slice(1, -1);
        try {
          return <InlineMath key={`${idx}-${inlineIdx}`} math={latex} />;
        } catch (e) {
          return <span key={`${idx}-${inlineIdx}`} className="text-red-400">{inlinePart}</span>;
        }
      }
      return <span key={`${idx}-${inlineIdx}`}>{inlinePart}</span>;
    });
  });
};

const generateQuestionId = () => `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function Learning() {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('practice');
  const [selectedSubject, setSelectedSubject] = useState('Statistics');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [answerEvaluations, setAnswerEvaluations] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState(null);
  const [scores, setScores] = useState({});
  const [questionHistory, setQuestionHistory] = useState([]);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTimes, setQuestionTimes] = useState({});
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [skippedQuestions, setSkippedQuestions] = useState(new Set());
  const [showSkippedPrompt, setShowSkippedPrompt] = useState(false);

  // Adaptive difficulty state
  const [currentMastery, setCurrentMastery] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const [questionsUntilUnlock, setQuestionsUntilUnlock] = useState(0);

  // Quiz settings state
  const [showSettings, setShowSettings] = useState(true);
  const [questionCount, setQuestionCount] = useState(5);
  const [questionStyle, setQuestionStyle] = useState('balanced');
  const [focusMode, setFocusMode] = useState('understanding');

  // Catalogue navigation state
  const [navigationLevel, setNavigationLevel] = useState('catalogue'); // 'catalogue' | 'category' | 'subject' | 'topic'
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Cheat sheet viewer state
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  // History filter state
  const [historyFilters, setHistoryFilters] = useState({
    subject: 'all',
    topic: 'all',
    result: 'all',
    dateRange: 'all'
  });
  const [expandedHistoryItem, setExpandedHistoryItem] = useState(null);

  // Load initial data from service (handles guest vs authenticated)
  const loadInitialData = async () => {
    try {
      const [scoresResult, historyResult] = await Promise.all([
        getAllScores(),
        getQuestionHistory({ limit: 1000 }),
      ]);
      
      if (scoresResult.success) {
        setScores(scoresResult.data);
      }
      if (historyResult.success) {
        setQuestionHistory(historyResult.data);
      }
    } catch (err) {
      console.error('Error loading learning data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Trigger migration when user transitions from guest to authenticated
  useEffect(() => {
    const triggerMigration = async () => {
      if (user && !user.isGuest) {
        const result = await migrateGuestDataToSupabase();
        if (result.success && !result.alreadyMigrated && result.migrated) {
          console.log('Learning data migrated:', result.migrated);
          // Reload data after migration
          loadInitialData();
        }
      }
    };
    triggerMigration();
  }, [user?.id, user?.isGuest]);

  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length && !showResults) {
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestionIndex, questions.length, showResults]);

  // Show level-up modal after quiz results with delay
  useEffect(() => {
    if (showResults && recommendation?.type === 'suggest_up') {
      const timer = setTimeout(() => {
        setShowRecommendationModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [showResults, recommendation?.type]);

  const saveScore = async (topicId, score, total) => {
    const result = await saveBestScore(selectedSubject, topicId, score, total);
    
    if (result.success && result.updated) {
      // Update local state to reflect the new best score
      const key = `${selectedSubject}-${topicId}`;
      setScores(prev => ({
        ...prev,
        [key]: {
          best: Math.round(score),
          total,
          percentage: Math.round((score / total) * 100),
          lastAttempt: new Date().toISOString(),
        },
      }));
    }
  };

  const saveQuestionToHistory = async (question, userAnswer, result, score, timeTaken) => {
    const entry = {
      question: question.question,
      questionType: question.type,
      userAnswer: userAnswer || '',
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      result,
      score,
      timeTaken,
      topic: selectedTopic?.name || '',
      subject: selectedSubject,
      difficulty: selectedDifficulty,
      questionStyle,
      focusMode,
    };
    
    const saveResult = await saveToService(entry);
    
    if (saveResult.success) {
      // Update local state with the new entry
      setQuestionHistory(prev => [saveResult.data, ...prev].slice(0, 1000));
    }
  };

  const getBestScore = (topicId) => {
    const key = `${selectedSubject}-${topicId}`;
    return scores[key];
  };

  const startPractice = async (topic) => {
    setSelectedTopic(topic);
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setAnswerEvaluations({});
    setShowResults(false);
    setQuestionTimes({});
    setSkippedQuestions(new Set());
    setShowSkippedPrompt(false);
    
    // Reset adaptive difficulty states
    setCurrentMastery(null);
    setRecommendation(null);
    setShowRecommendationModal(false);
    setDifficultyLocked(false);
    setQuestionsUntilUnlock(0);

    // Reset session counters and check for recommended difficulty
    await resetSessionCounters(selectedSubject, topic.name);
    const difficultyResult = await getRecommendedDifficulty(selectedSubject, topic.name);
    
    if (difficultyResult.success && difficultyResult.data) {
      setCurrentMastery(difficultyResult.data);
      
      // Check if there's a recommendation that differs from selected difficulty
      if (difficultyResult.data.isRecommendation && 
          difficultyResult.data.suggestedDifficulty !== selectedDifficulty) {
        const sessionStartRec = {
          type: 'session_start',
          suggestedDifficulty: difficultyResult.data.suggestedDifficulty,
          currentDifficulty: selectedDifficulty,
          accuracy: difficultyResult.data.rollingAccuracy,
          message: `Based on your ${Math.round(difficultyResult.data.rollingAccuracy)}% accuracy, we suggest ${difficultyResult.data.suggestedDifficulty} difficulty.`
        };
        setRecommendation(sessionStartRec);
        setShowRecommendationModal(true);
      }
    }

    const result = await generatePracticeQuestions(
      selectedSubject,
      topic.name,
      selectedDifficulty,
      questionCount,
      questionStyle,
      focusMode
    );
    setIsLoading(false);

    if (result.success && result.data?.questions) {
      setQuestions(result.data.questions);
    } else {
      setError(result.error || 'Failed to generate questions. Please try again.');
    }
  };

  const handleMultipleChoiceAnswer = (questionId, answer) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleTextAnswer = (questionId, answer) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const skipQuestion = () => {
    const question = questions[currentQuestionIndex];
    
    // Add to skipped set
    const newSkipped = new Set([...skippedQuestions, question.id]);
    setSkippedQuestions(newSkipped);
    
    // Move to next question
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // At last question - show prompt since we have at least the current skipped question
      setShowSkippedPrompt(true);
    }
  };

  const reviewSkippedQuestions = () => {
    setShowSkippedPrompt(false);
    // Find first skipped question index
    const firstSkippedIndex = questions.findIndex(q => skippedQuestions.has(q.id));
    if (firstSkippedIndex !== -1) {
      setCurrentQuestionIndex(firstSkippedIndex);
    }
  };

  const finishQuiz = async () => {
    // Save any unanswered skipped questions to history
    for (const q of questions) {
      if (skippedQuestions.has(q.id) && !userAnswers[q.id]) {
        await saveQuestionToHistory(q, '', 'skipped', 0, 0);
      }
    }
    
    const totalScore = calculateTotalScore();
    await saveScore(selectedTopic.id, totalScore, questions.length);
    setShowResults(true);
    setShowSkippedPrompt(false);
  };

  const checkCalculationAnswer = (userAnswer, correctAnswer) => {
    if (!userAnswer || !correctAnswer) return { result: 'incorrect', score: 0 };
    
    // Helper to evaluate a string as a number (handles fractions like "3/5")
    const evaluateAnswer = (answer) => {
      const str = String(answer).trim();
      
      // Handle fractions (e.g., "3/5", "1/4")
      if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 2) {
          const numerator = parseFloat(parts[0]);
          const denominator = parseFloat(parts[1]);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
          }
        }
      }
      
      // Handle percentages (e.g., "60%")
      if (str.endsWith('%')) {
        const num = parseFloat(str.slice(0, -1));
        if (!isNaN(num)) return num / 100;
      }
      
      // Standard number
      return parseFloat(str);
    };
    
    const userNum = evaluateAnswer(userAnswer);
    const correctNum = evaluateAnswer(correctAnswer);
    
    if (isNaN(userNum) || isNaN(correctNum)) return { result: 'incorrect', score: 0 };
    
    const tolerance = Math.abs(correctNum * 0.01); // 1% tolerance
    const diff = Math.abs(userNum - correctNum);
    
    if (diff <= tolerance) return { result: 'correct', score: 1 };
    if (diff <= tolerance * 5) return { result: 'partial', score: 0.5 }; // 5% tolerance for partial
    return { result: 'incorrect', score: 0 };
  };

  const nextQuestion = async () => {
    const question = questions[currentQuestionIndex];
    const userAnswer = userAnswers[question.id];
    const timeTaken = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0;
    setQuestionTimes(prev => ({ ...prev, [question.id]: timeTaken }));

    // Track the score earned for mastery updates
    let scoreEarned = 0;

    if (question.type === 'short_answer' && userAnswer) {
      setIsEvaluating(true);
      const evalResult = await evaluateAnswer(question.question, userAnswer, question.correctAnswer, question.type);
      setIsEvaluating(false);

      if (evalResult.success && evalResult.data) {
        setAnswerEvaluations(prev => ({ ...prev, [question.id]: evalResult.data }));
        scoreEarned = evalResult.data.score;
        await saveQuestionToHistory(question, userAnswer, evalResult.data.result, evalResult.data.score, timeTaken);
      }
    } else if (question.type === 'calculation') {
      const calcResult = checkCalculationAnswer(userAnswer, question.correctAnswer);
      setAnswerEvaluations(prev => ({
        ...prev,
        [question.id]: {
          result: calcResult.result,
          score: calcResult.score,
          feedback: calcResult.result === 'correct' ? 'Correct calculation!' : calcResult.result === 'partial' ? 'Close, but not quite accurate enough.' : 'Incorrect calculation.',
        },
      }));
      scoreEarned = calcResult.score;
      await saveQuestionToHistory(question, userAnswer, calcResult.result, calcResult.score, timeTaken);
    } else {
      const userLetter = userAnswer?.charAt(0)?.toUpperCase();
      const correctLetter = question.correctAnswer?.charAt(0)?.toUpperCase();
      const isCorrect = userLetter === correctLetter;
      scoreEarned = isCorrect ? 1 : 0;
      await saveQuestionToHistory(question, userAnswer, isCorrect ? 'correct' : 'incorrect', isCorrect ? 1 : 0, timeTaken);
    }

    // Update mastery tracking if not locked and topic is selected
    if (!difficultyLocked && selectedTopic) {
      const masteryResult = await updateMastery(selectedSubject, selectedTopic.name, selectedDifficulty, scoreEarned);
      if (masteryResult.success && masteryResult.data) {
        setCurrentMastery(masteryResult.data);
        
        // Check for recommendations
        if (masteryResult.data.recommendation) {
          setRecommendation(masteryResult.data.recommendation);
          // Show modal immediately unless it's a suggest_up (shown after results)
          if (masteryResult.data.recommendation.type !== 'suggest_up') {
            setShowRecommendationModal(true);
          }
        }
      }
    }

    // Handle difficulty lock countdown
    if (difficultyLocked) {
      const newCount = questionsUntilUnlock - 1;
      setQuestionsUntilUnlock(newCount);
      if (newCount <= 0) {
        setDifficultyLocked(false);
        setQuestionsUntilUnlock(0);
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const totalScore = calculateTotalScore();
      await saveScore(selectedTopic.id, totalScore, questions.length);
      setShowResults(true);
    }
  };

  const calculateTotalScore = () => {
    let total = 0;
    questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      const evaluation = answerEvaluations[q.id];
      
      if (evaluation) {
        total += evaluation.score;
      } else if (q.type === 'multiple_choice' || (q.type === 'formula' && q.options)) {
        const userLetter = userAnswer?.charAt(0)?.toUpperCase();
        const correctLetter = q.correctAnswer?.charAt(0)?.toUpperCase();
        if (userLetter === correctLetter) total += 1;
      } else if (q.type === 'calculation' || (q.type === 'formula' && !q.options)) {
        const calcResult = checkCalculationAnswer(userAnswer, q.correctAnswer);
        total += calcResult.score;
      }
    });
    return total;
  };

  const backToTopics = () => {
    // Reset quiz state but keep navigation context
    // User returns to topic detail view (not resetting selectedTopic or navigationLevel)
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setAnswerEvaluations({});
    setShowResults(false);
    setError(null);
    
    // Reset adaptive difficulty states
    setCurrentMastery(null);
    setRecommendation(null);
    setShowRecommendationModal(false);
    setDifficultyLocked(false);
    setQuestionsUntilUnlock(0);
  };

  const retryTopic = () => {
    if (selectedTopic) startPractice(selectedTopic);
  };

  const getProgressStats = async () => {
    const result = await getProgressStatsFromService();
    if (result.success) {
      return result.data;
    }
    // Fallback to empty stats
    return {
      totalQuestions: 0,
      accuracyRate: 0,
      avgTime: 0,
      topicStats: [],
      streak: 0,
    };
  };

  // Progress stats state for async loading
  const [progressStats, setProgressStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load progress stats when tab becomes active
  useEffect(() => {
    if (activeTab === 'progress') {
      const loadStats = async () => {
        setLoadingStats(true);
        const stats = await getProgressStats();
        setProgressStats(stats);
        setLoadingStats(false);
      };
      loadStats();
    }
  }, [activeTab]);

  const filteredHistory = useMemo(() => {
    return questionHistory.filter(item => {
      if (historyFilters.subject !== 'all' && item.subject !== historyFilters.subject) return false;
      if (historyFilters.topic !== 'all' && item.topic !== historyFilters.topic) return false;
      if (historyFilters.result !== 'all' && item.result !== historyFilters.result) return false;
      
      if (historyFilters.dateRange !== 'all') {
        const itemDate = new Date(item.timestamp);
        const now = new Date();
        if (historyFilters.dateRange === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (historyFilters.dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < weekAgo) return false;
        } else if (historyFilters.dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (itemDate < monthAgo) return false;
        }
      }
      
      return true;
    });
  }, [questionHistory, historyFilters]);

  const historySubjects = useMemo(() => [...new Set(questionHistory.map(h => h.subject))], [questionHistory]);
  const historyTopics = useMemo(() => {
    if (historyFilters.subject === 'all') {
      return [...new Set(questionHistory.map(h => h.topic))];
    }
    return [...new Set(questionHistory.filter(h => h.subject === historyFilters.subject).map(h => h.topic))];
  }, [questionHistory, historyFilters.subject]);

  const getSettingsSummary = () => {
    const diffName = DIFFICULTIES.find(d => d.id === selectedDifficulty)?.name || 'Medium';
    const styleName = QUESTION_STYLES.find(s => s.id === questionStyle)?.name || 'Balanced';
    const focusName = FOCUS_MODES.find(f => f.id === focusMode)?.name || 'Understanding';
    return `${questionCount} questions • ${diffName} • ${styleName} • ${focusName}`;
  };

  // Navigation functions for catalogue system
  const selectCategory = (categoryKey) => {
    setSelectedCategory(categoryKey);
    setNavigationLevel('category');
  };

  const selectSubjectFromCatalogue = (subjectKey) => {
    setSelectedSubject(subjectKey);
    setNavigationLevel('subject');
  };

  const selectTopicDetail = (topic) => {
    setSelectedTopic(topic);
    setNavigationLevel('topic');
  };

  const navigateBack = () => {
    if (navigationLevel === 'category') {
      setSelectedCategory(null);
      setNavigationLevel('catalogue');
    } else if (navigationLevel === 'subject') {
      setSelectedSubject('Statistics');
      setNavigationLevel('category');
    } else if (navigationLevel === 'topic') {
      setSelectedTopic(null);
      setNavigationLevel('subject');
    }
  };

  const backToCatalogue = () => {
    setSelectedCategory(null);
    setSelectedSubject('Statistics');
    setSelectedTopic(null);
    setNavigationLevel('catalogue');
    setQuestions([]);
    setShowResults(false);
    setCurrentQuestionIndex(0);
  };

  const renderSettingsPanel = () => (
    <div className="bg-neural-dark rounded-xl border border-gray-800 mb-6 overflow-hidden">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-neural-purple" />
          <div className="text-left">
            <span className="font-medium text-white">Quiz Settings</span>
            <p className="text-xs text-gray-400 mt-0.5">{getSettingsSummary()}</p>
          </div>
        </div>
        {showSettings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>
      
      {showSettings && (
        <div className="p-4 pt-0 space-y-4 border-t border-gray-800">
          {/* Question Count */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Question Count</label>
            <div className="flex gap-2">
              {QUESTION_COUNTS.map(count => (
                <button
                  key={count}
                  onClick={() => setQuestionCount(count)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${questionCount === count ? 'bg-neural-purple text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          {/* Question Style */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Question Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUESTION_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setQuestionStyle(style.id)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-sm text-left ${questionStyle === style.id ? 'bg-neural-purple/20 text-neural-purple ring-1 ring-neural-purple' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  title={style.description}
                >
                  {style.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{QUESTION_STYLES.find(s => s.id === questionStyle)?.description}</p>
          </div>

          {/* Focus Mode */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Focus Mode</label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_MODES.map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setFocusMode(mode.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${focusMode === mode.id ? 'bg-neural-purple/20 text-neural-purple ring-1 ring-neural-purple' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  title={mode.description}
                >
                  {mode.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{FOCUS_MODES.find(f => f.id === focusMode)?.description}</p>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Difficulty</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DIFFICULTIES.map(diff => (
                <button
                  key={diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${selectedDifficulty === diff.id ? `${diff.bgColor} ${diff.color} ring-1 ring-current` : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                  title={diff.description}
                >
                  {diff.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">{DIFFICULTIES.find(d => d.id === selectedDifficulty)?.description}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderProgressDashboard = () => {
    if (loadingStats || !progressStats) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-12 h-12 text-neural-purple animate-spin mb-4" />
          <p className="text-gray-400">Loading progress...</p>
        </div>
      );
    }
    
    const stats = progressStats;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-neural-purple" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Progress Dashboard</h2>
            <p className="text-sm text-gray-400">Track your learning journey</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">Total Questions</span>
            </div>
            <div className="text-2xl font-bold text-white">{stats.totalQuestions}</div>
          </div>
          
          <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Check className="w-4 h-4" />
              <span className="text-sm">Accuracy Rate</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{stats.accuracyRate}%</div>
          </div>
          
          <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Avg. Time/Question</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.avgTime}s</div>
          </div>
          
          <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 mb-2">
              <Flame className="w-4 h-4" />
              <span className="text-sm">Current Streak</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{stats.streak} days</div>
          </div>
        </div>

        {stats.topicStats.length > 0 && (
          <div className="bg-neural-dark rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-medium text-white">Topics Practiced</h3>
            </div>
            <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {stats.topicStats.map((topic, idx) => (
                <div key={idx} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm text-gray-400">{topic.subject}</span>
                      <h4 className="font-medium text-white">{topic.topic}</h4>
                    </div>
                    <span className="text-sm font-medium text-neural-purple">{Math.round(topic.bestScore)}% best</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-neural-purple to-neural-pink transition-all" style={{ width: `${Math.round(topic.bestScore)}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{topic.total} questions attempted</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalQuestions === 0 && (
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No practice sessions yet.</p>
            <p className="text-sm">Start practicing to track your progress!</p>
          </div>
        )}
      </div>
    );
  };

  const renderHistoryViewer = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center">
          <History className="w-6 h-6 text-neural-purple" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Question History</h2>
          <p className="text-sm text-gray-400">Review past questions and answers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Filters</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={historyFilters.subject}
            onChange={(e) => setHistoryFilters(prev => ({ ...prev, subject: e.target.value, topic: 'all' }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Subjects</option>
            {historySubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={historyFilters.topic}
            onChange={(e) => setHistoryFilters(prev => ({ ...prev, topic: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Topics</option>
            {historyTopics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={historyFilters.result}
            onChange={(e) => setHistoryFilters(prev => ({ ...prev, result: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Results</option>
            <option value="correct">✓ Correct</option>
            <option value="partial">½ Partial</option>
            <option value="incorrect">✗ Incorrect</option>
          </select>
          <select
            value={historyFilters.dateRange}
            onChange={(e) => setHistoryFilters(prev => ({ ...prev, dateRange: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
          </select>
        </div>
      </div>

      {/* History List */}
      <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="font-medium text-white">Questions ({filteredHistory.length})</h3>
        </div>
        
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No questions match your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
            {filteredHistory.slice(0, 50).map((item, idx) => {
              const isExpanded = expandedHistoryItem === item.visibleID;
              return (
                <div key={item.visibleID || idx} className="hover:bg-gray-800/30 transition-colors">
                  <button
                    onClick={() => setExpandedHistoryItem(isExpanded ? null : item.visibleID)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.result === 'correct' ? 'bg-green-500/20' : item.result === 'partial' ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                        {item.result === 'correct' ? <Check className="w-3 h-3 text-green-400" /> : item.result === 'partial' ? <span className="text-yellow-400 text-xs">½</span> : <X className="w-3 h-3 text-red-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-300 truncate">{item.question}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                          <span>{item.subject}</span>
                          <span>•</span>
                          <span>{item.topic}</span>
                          <span>•</span>
                          <span>{item.difficulty}</span>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3 ml-9">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Question:</p>
                        <p className="text-sm text-gray-300">{renderMathText(item.question)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Your Answer:</p>
                        <p className={`text-sm ${item.result === 'correct' ? 'text-green-400' : item.result === 'partial' ? 'text-yellow-400' : 'text-red-400'}`}>{item.userAnswer || '(no answer)'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Correct Answer:</p>
                        <div className="text-sm text-green-400">{renderMathText(item.correctAnswer)}</div>
                      </div>
                      {item.explanation && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Explanation:</p>
                          <div className="text-sm text-gray-400">{renderMathText(item.explanation)}</div>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Time: {item.timeTaken}s</span>
                        <span>Type: {item.questionType}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // Render catalogue view - grid of categories
  const renderCatalogue = () => {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-neural-purple" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Subject Catalogue</h2>
            <p className="text-sm text-gray-400">Choose a field of study</p>
          </div>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(SUBJECT_CATALOGUE).map(([categoryKey, category]) => {
            const subjectCount = Object.keys(category.subjects).length;
            const isEmpty = subjectCount === 0;
            
            return (
              <button
                key={categoryKey}
                onClick={() => !isEmpty && selectCategory(categoryKey)}
                disabled={isEmpty}
                className={`bg-neural-dark rounded-xl p-6 border border-gray-800 text-left transition-all group ${
                  isEmpty 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:border-neural-purple/50 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <span className="text-4xl mb-3 block">{category.icon}</span>
                    <h3 className={`text-lg font-semibold mb-1 ${!isEmpty ? 'group-hover:text-neural-purple' : ''} transition-colors`}>
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">{category.description}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isEmpty 
                        ? 'bg-gray-700 text-gray-400' 
                        : 'bg-neural-purple/20 text-neural-purple'
                    }`}>
                      {isEmpty ? 'Coming soon' : `${subjectCount} subject${subjectCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {!isEmpty && (
                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-neural-purple transition-colors mt-1" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render category view - list of subjects in a category
  const renderCategoryView = () => {
    const category = SUBJECT_CATALOGUE[selectedCategory];
    if (!category) return renderCatalogue();

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button 
            onClick={backToCatalogue}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            Catalogue
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span className="text-white">{category.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={navigateBack}
            className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-14 h-14 bg-neural-purple/20 rounded-xl flex items-center justify-center text-3xl">
            {category.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <p className="text-sm text-gray-400">{category.description}</p>
          </div>
        </div>

        {/* Subject List */}
        <div className="space-y-3">
          {Object.entries(category.subjects).map(([subjectKey, subject]) => {
            const topicCount = subject.topics.length;
            return (
              <button
                key={subjectKey}
                onClick={() => selectSubjectFromCatalogue(subjectKey)}
                className="w-full bg-neural-dark rounded-xl p-4 border border-gray-800 hover:border-neural-purple/50 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{subject.icon}</span>
                    <div>
                      <h3 className="font-medium text-white group-hover:text-neural-purple transition-colors">
                        {subject.name}
                      </h3>
                      <p className="text-sm text-gray-500">{topicCount} topic{topicCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-neural-purple transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render subject view - list of topics with settings panel
  const renderSubjectView = () => {
    const category = SUBJECT_CATALOGUE[selectedCategory];
    const subject = category?.subjects[selectedSubject];
    if (!category || !subject) return renderCategoryView();

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <button 
            onClick={backToCatalogue}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            Catalogue
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <button 
            onClick={navigateBack}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            {category.name}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span className="text-white">{subject.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={navigateBack}
            className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="w-14 h-14 bg-neural-purple/20 rounded-xl flex items-center justify-center text-3xl">
            {subject.icon}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            <p className="text-sm text-gray-400">Select a topic to practice</p>
          </div>
        </div>

        {/* Settings Panel */}
        {renderSettingsPanel()}

        {/* Topic List */}
        <div className="space-y-3">
          {subject.topics.map(topic => {
            const bestScore = getBestScore(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => selectTopicDetail(topic)}
                className="w-full bg-neural-dark rounded-xl p-4 border border-gray-800 hover:border-neural-purple/50 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white group-hover:text-neural-purple transition-colors">
                        {topic.name}
                      </h3>
                      {bestScore && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {bestScore.percentage}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{topic.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-neural-purple transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Render topic detail view - learning sections (Quiz, Cheat Sheet, etc.)
  const renderTopicDetailView = () => {
    const category = SUBJECT_CATALOGUE[selectedCategory];
    const subject = category?.subjects[selectedSubject];
    const topic = selectedTopic;
    
    if (!category || !subject || !topic) return renderSubjectView();

    const bestScore = getBestScore(topic.id);

    const learningSections = [
      {
        id: 'quiz',
        icon: '📝',
        name: 'Practice Quiz',
        description: 'AI-generated questions to test your understanding',
        available: true,
        onClick: () => startPractice(topic),
      },
      {
        id: 'cheatsheet',
        icon: '📄',
        name: 'Cheat Sheet',
        description: 'Condensed summary of key concepts and formulas',
        available: true,
        onClick: () => setShowCheatSheet(true),
      },
      {
        id: 'flashcards',
        icon: '🃏',
        name: 'Flashcards',
        description: 'Spaced repetition for memorizing formulas and definitions',
        available: false,
      },
      {
        id: 'mindmap',
        icon: '🗺️',
        name: 'Mind Map',
        description: 'Visual overview of how concepts connect',
        available: false,
      },
    ];

    return (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <button 
            onClick={backToCatalogue}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            Catalogue
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <button 
            onClick={() => { setSelectedTopic(null); setNavigationLevel('category'); }}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            {category.name}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <button 
            onClick={navigateBack}
            className="text-gray-400 hover:text-neural-purple transition-colors"
          >
            {subject.name}
          </button>
          <ChevronRight className="w-4 h-4 text-gray-600" />
          <span className="text-white">{topic.name}</span>
        </div>

        {/* Topic Header Card */}
        <div className="bg-neural-dark rounded-xl p-6 border border-gray-800">
          <div className="flex items-start gap-4">
            <button
              onClick={navigateBack}
              className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{topic.name}</h1>
              <p className="text-gray-400">{topic.description}</p>
              
              {bestScore && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm text-gray-500">Best Score:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    bestScore.percentage >= 80 
                      ? 'bg-green-500/20 text-green-400' 
                      : bestScore.percentage >= 60 
                        ? 'bg-yellow-500/20 text-yellow-400' 
                        : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    <Trophy className="w-3 h-3 inline mr-1" />
                    {bestScore.percentage}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Learning Sections Heading */}
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Learning Sections</h2>
        </div>

        {/* Learning Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learningSections.map(section => (
            <button
              key={section.id}
              onClick={section.available ? section.onClick : undefined}
              disabled={!section.available}
              className={`bg-neural-dark rounded-xl p-5 border text-left transition-all group ${
                section.available
                  ? 'border-gray-800 hover:border-neural-purple/50 cursor-pointer'
                  : 'border-gray-800 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{section.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-medium ${section.available ? 'group-hover:text-neural-purple' : ''} transition-colors`}>
                      {section.name}
                    </h3>
                    {!section.available && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{section.description}</p>
                </div>
                {section.available && (
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-neural-purple transition-colors" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTopicSelection = () => {
    const subject = SUBJECTS[selectedSubject];
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center text-2xl">{subject.icon}</div>
          <div className="flex-1">
            <div className="relative">
              <button onClick={() => setShowSubjectDropdown(!showSubjectDropdown)} className="flex items-center gap-2 text-xl font-bold hover:text-neural-purple transition-colors">
                {subject.name}
                <ChevronDown className={`w-5 h-5 transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showSubjectDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-neural-dark border border-gray-700 rounded-xl shadow-xl z-50">
                  {Object.entries(SUBJECTS).map(([key, subj]) => (
                    <button
                      key={key}
                      onClick={() => { setSelectedSubject(key); setShowSubjectDropdown(false); }}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-800 transition-colors first:rounded-t-xl last:rounded-b-xl ${selectedSubject === key ? 'bg-neural-purple/20 text-neural-purple' : 'text-gray-300'}`}
                    >
                      <span className="text-xl">{subj.icon}</span>
                      <span>{subj.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400">Select a topic to practice</p>
          </div>
        </div>

        {renderSettingsPanel()}

        <div className="space-y-3">
          {subject.topics.map(topic => {
            const bestScore = getBestScore(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => startPractice(topic)}
                className="w-full bg-neural-dark rounded-xl p-4 border border-gray-800 hover:border-neural-purple/50 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white group-hover:text-neural-purple transition-colors">{topic.name}</h3>
                      {bestScore && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {bestScore.percentage}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{topic.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-neural-purple transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-12 h-12 text-neural-purple animate-spin mb-4" />
      <p className="text-gray-400">Generating questions...</p>
      <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-red-400 font-medium mb-2">Failed to load questions</p>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-md">{error}</p>
      <div className="flex gap-3">
        <button onClick={backToTopics} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Back to Topics</button>
        <button onClick={retryTopic} className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );

  const renderRecommendationModal = () => {
    if (!showRecommendationModal || !recommendation) return null;

    // Configuration based on recommendation type
    const configs = {
      suggest_up: {
        theme: 'green',
        emoji: '🚀',
        title: 'Ready for a Challenge?',
        primaryAction: 'Level Up!',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
        buttonBg: 'bg-green-600 hover:bg-green-700',
      },
      auto_down: {
        theme: 'blue',
        emoji: '🛡️',
        title: 'Building Foundations',
        primaryAction: 'Sounds Good',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-400',
        buttonBg: 'bg-blue-600 hover:bg-blue-700',
      },
      streak_warning: {
        theme: 'yellow',
        emoji: '⚠️',
        title: 'Comfort Zone Alert',
        primaryAction: 'Try Harder Mode',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
        buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
      },
      oscillation_warning: {
        theme: 'purple',
        emoji: '🎯',
        title: 'Finding Your Level',
        primaryAction: 'Lock Difficulty',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-400',
        buttonBg: 'bg-purple-600 hover:bg-purple-700',
      },
      session_start: {
        theme: 'purple',
        emoji: '💡',
        title: 'Difficulty Suggestion',
        primaryAction: `Try ${DIFFICULTIES.find(d => d.id === recommendation.suggestedDifficulty)?.name || 'Suggested'}`,
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-400',
        buttonBg: 'bg-purple-600 hover:bg-purple-700',
      },
    };

    const config = configs[recommendation.type] || configs.session_start;

    const handleDismiss = () => {
      setShowRecommendationModal(false);
      // Don't clear recommendation for suggest_up (needed for results screen)
      if (recommendation.type !== 'suggest_up') {
        setRecommendation(null);
      }
    };

    const handlePrimaryAction = () => {
      // Apply the change based on recommendation type
      if (recommendation.type === 'suggest_up' || recommendation.type === 'session_start') {
        setSelectedDifficulty(recommendation.suggestedDifficulty);
      } else if (recommendation.type === 'auto_down') {
        setSelectedDifficulty(recommendation.suggestedDifficulty);
      } else if (recommendation.type === 'streak_warning') {
        // Move to harder difficulty
        const difficultyOrder = ['easy', 'medium', 'hard', 'extreme'];
        const currentIndex = difficultyOrder.indexOf(selectedDifficulty);
        if (currentIndex < difficultyOrder.length - 1) {
          setSelectedDifficulty(difficultyOrder[currentIndex + 1]);
        }
      } else if (recommendation.type === 'oscillation_warning') {
        // Lock difficulty for 10 questions
        setDifficultyLocked(true);
        setQuestionsUntilUnlock(10);
      }

      setShowRecommendationModal(false);
      setRecommendation(null);
    };

    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className={`bg-neural-dark rounded-xl border ${config.borderColor} p-6 max-w-md w-full space-y-4`}>
          <div className="text-center">
            <div className={`w-16 h-16 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <span className="text-3xl">{config.emoji}</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{config.title}</h3>
            <p className="text-gray-400">
              {recommendation.message || `Based on your performance, we have a suggestion for you.`}
            </p>
            {recommendation.accuracy !== undefined && (
              <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor}`}>
                <span className={`text-sm font-medium ${config.textColor}`}>
                  Rolling Accuracy: {Math.round(recommendation.accuracy)}%
                </span>
              </div>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600 transition-all"
            >
              Dismiss
            </button>
            <button
              onClick={handlePrimaryAction}
              className={`flex-1 py-3 ${config.buttonBg} text-white rounded-lg font-medium transition-all`}
            >
              {config.primaryAction}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestion = () => {
    const question = questions[currentQuestionIndex];
    if (!question) return null;

    const userAnswer = userAnswers[question.id];
    const isAnswered = userAnswer !== undefined && userAnswer !== '';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={backToTopics} className="text-sm text-gray-400 hover:text-white transition-colors">← Back to topics</button>
          <span className="text-sm text-gray-400">Question {currentQuestionIndex + 1} of {questions.length}</span>
        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-neural-purple to-neural-pink transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
        </div>

        {/* Mastery Info Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
          {/* Difficulty Badge */}
          <div className="flex items-center gap-2">
            {(() => {
              const diff = DIFFICULTIES.find(d => d.id === selectedDifficulty);
              return (
                <span className={`px-2.5 py-1 rounded-full ${diff?.bgColor || 'bg-gray-500/20'} ${diff?.color || 'text-gray-400'} font-medium`}>
                  {diff?.name || selectedDifficulty}
                </span>
              );
            })()}
            
            {/* Lock indicator */}
            {difficultyLocked && (
              <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                <Lock className="w-3 h-3" />
                <span className="text-xs">{questionsUntilUnlock} left</span>
              </span>
            )}
          </div>

          {/* Mastery stats */}
          <div className="flex items-center gap-3">
            {/* Rolling accuracy - only show if mastery exists and not new */}
            {currentMastery && currentMastery.rollingAccuracy !== undefined && !currentMastery.isNew && (
              <span className="flex items-center gap-1.5 text-gray-400">
                <Target className="w-3.5 h-3.5" />
                <span>{Math.round(currentMastery.rollingAccuracy)}% accuracy</span>
              </span>
            )}
            
            {/* Streak paused warning */}
            {currentMastery && currentMastery.streak_eligible === false && (
              <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-xs">
                <AlertTriangle className="w-3 h-3" />
                Streak paused
              </span>
            )}
          </div>
        </div>

        <div className="bg-neural-dark rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full ${question.type === 'multiple_choice' ? 'bg-blue-500/20 text-blue-400' : question.type === 'short_answer' ? 'bg-purple-500/20 text-purple-400' : question.type === 'calculation' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {question.type === 'multiple_choice' ? 'Multiple Choice' : question.type === 'short_answer' ? 'Short Answer' : question.type === 'calculation' ? 'Calculation' : 'Formula'}
            </span>
            {question.unit && <span className="text-xs text-gray-500">Answer in: {question.unit}</span>}
          </div>

          <h3 className="text-lg font-medium text-white mb-6">{renderMathText(question.question)}</h3>

          {(question.type === 'multiple_choice' || (question.type === 'formula' && question.options)) ? (
            <div className="space-y-3">
              {question.options?.map((option, idx) => {
                const letter = option.charAt(0);
                const isSelected = userAnswer === letter;
                return (
                  <button
                    key={idx}
                    onClick={() => handleMultipleChoiceAnswer(question.id, letter)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${isSelected ? 'border-neural-purple bg-neural-purple/20 text-white' : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'}`}
                  >
                    {renderMathText(option)}
                  </button>
                );
              })}
            </div>
          ) : question.type === 'calculation' ? (
            <div>
              <input
                type="number"
                step="any"
                value={userAnswer || ''}
                onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                placeholder="Enter your numerical answer..."
                className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none"
              />
              {question.unit && <p className="text-sm text-gray-500 mt-2">Unit: {question.unit}</p>}
            </div>
          ) : question.type === 'formula' && !question.options ? (
            <div>
              <input
                type="text"
                value={userAnswer || ''}
                onChange={(e) => handleTextAnswer(question.id, e.target.value)}
                placeholder="Enter your answer (use LaTeX notation if needed)..."
                className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none font-mono"
              />
              <p className="text-sm text-gray-500 mt-2">Tip: Use notation like lim, P(...), epsilon, etc.</p>
            </div>
          ) : (
            <textarea
              value={userAnswer || ''}
              onChange={(e) => handleTextAnswer(question.id, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none resize-none"
              rows={3}
            />
          )}
        </div>

        {/* Skipped Questions Indicator */}
        {skippedQuestions.size > 0 && (
          <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <span>⏭️</span>
            <span>{skippedQuestions.size} skipped question{skippedQuestions.size > 1 ? 's' : ''}</span>
            {skippedQuestions.has(question.id) && <span className="text-yellow-500 font-medium">(this one)</span>}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {/* Previous Button */}
          <button
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${currentQuestionIndex > 0 ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
          >
            ← Prev
          </button>

          {/* Skip Button */}
          <button
            onClick={skipQuestion}
            disabled={isEvaluating}
            className="px-4 py-3 rounded-lg font-medium transition-all bg-gray-700 text-yellow-400 hover:bg-gray-600 flex items-center justify-center gap-2"
          >
            Skip ⏭️
          </button>

          {/* Next/Submit Button */}
          <button
            onClick={nextQuestion}
            disabled={!isAnswered || isEvaluating}
            className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${isAnswered && !isEvaluating ? 'bg-neural-purple text-white hover:bg-neural-purple/80' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
          >
            {isEvaluating ? (<><Loader2 className="w-4 h-4 animate-spin" />Evaluating...</>) : currentQuestionIndex < questions.length - 1 ? 'Next →' : 'Submit'}
          </button>
        </div>

        {/* Skipped Questions Prompt Modal */}
        {showSkippedPrompt && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-neural-dark rounded-xl border border-gray-700 p-6 max-w-md w-full space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⏭️</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Skipped Questions</h3>
                <p className="text-gray-400">
                  You have <span className="text-yellow-400 font-bold">{skippedQuestions.size}</span> skipped question{skippedQuestions.size > 1 ? 's' : ''}. 
                  Would you like to review them or finish the quiz?
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={reviewSkippedQuestions}
                  className="flex-1 py-3 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg font-medium hover:bg-yellow-500/30 transition-all"
                >
                  Review Skipped
                </button>
                <button
                  onClick={finishQuiz}
                  className="flex-1 py-3 bg-neural-purple text-white rounded-lg font-medium hover:bg-neural-purple/80 transition-all"
                >
                  Finish Quiz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const totalScore = calculateTotalScore();
    const percentage = Math.round((totalScore / questions.length) * 100);
    
    let message = '';
    let messageColor = '';
    if (percentage >= 80) { message = 'Excellent work! 🎉'; messageColor = 'text-green-400'; }
    else if (percentage >= 60) { message = 'Good job! Keep practicing! 💪'; messageColor = 'text-yellow-400'; }
    else { message = 'Keep learning, you\'ll get there! 📚'; messageColor = 'text-orange-400'; }

    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-neural-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-neural-purple" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Practice Complete!</h2>
          <p className={`text-lg ${messageColor}`}>{message}</p>
        </div>

        <div className="bg-neural-dark rounded-xl p-6 border border-gray-800 text-center">
          <div className="text-5xl font-bold text-white mb-2">{totalScore.toFixed(1)} / {questions.length}</div>
          <div className="text-xl text-gray-400">{percentage}% correct</div>
        </div>

        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="font-medium text-white">Review Answers</h3>
          </div>
          <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
            {questions.map((q, idx) => {
              const userAnswer = userAnswers[q.id];
              const evaluation = answerEvaluations[q.id];
              let isCorrect = false;
              let isPartial = false;
              let feedback = null;
              
              if (evaluation) {
                isCorrect = evaluation.result === 'correct';
                isPartial = evaluation.result === 'partial';
                feedback = evaluation.feedback;
              } else if (q.type === 'multiple_choice' || (q.type === 'formula' && q.options)) {
                const userLetter = userAnswer?.charAt(0)?.toUpperCase();
                const correctLetter = q.correctAnswer?.charAt(0)?.toUpperCase();
                isCorrect = userLetter === correctLetter;
              } else if (q.type === 'calculation' || (q.type === 'formula' && !q.options)) {
                const calcResult = checkCalculationAnswer(userAnswer, q.correctAnswer);
                isCorrect = calcResult.result === 'correct';
                isPartial = calcResult.result === 'partial';
              }

              return (
                <div key={q.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-green-500/20' : isPartial ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                      {isCorrect ? <Check className="w-4 h-4 text-green-400" /> : isPartial ? <span className="text-yellow-400 text-xs">½</span> : <X className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 mb-2"><span className="text-gray-500">Q{idx + 1}:</span> {renderMathText(q.question)}</p>
                      <p className="text-sm"><span className="text-gray-500">Your answer:</span> <span className={isCorrect ? 'text-green-400' : isPartial ? 'text-yellow-400' : 'text-red-400'}>{userAnswer || '(no answer)'}</span></p>
                      {!isCorrect && <p className="text-sm"><span className="text-gray-500">Correct:</span> <span className="text-green-400">{renderMathText(q.correctAnswer)}</span></p>}
                      {feedback && <p className="text-sm text-neural-purple mt-2 bg-neural-purple/10 p-2 rounded">AI Feedback: {feedback}</p>}
                      <div className="text-sm text-gray-500 mt-2 italic">{renderMathText(q.explanation)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={backToTopics} className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">Back to Topics</button>
          <button onClick={retryTopic} className="flex-1 py-3 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('practice')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'practice' ? 'bg-neural-purple text-white' : 'bg-neural-dark text-gray-400 hover:text-white border border-gray-800'}`}
        >
          <BookOpen className="w-4 h-4" />
          Practice
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-neural-purple text-white' : 'bg-neural-dark text-gray-400 hover:text-white border border-gray-800'}`}
        >
          <History className="w-4 h-4" />
          History
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'progress' ? 'bg-neural-purple text-white' : 'bg-neural-dark text-gray-400 hover:text-white border border-gray-800'}`}
        >
          <BarChart3 className="w-4 h-4" />
          Progress
        </button>
      </div>

      {activeTab === 'progress' && renderProgressDashboard()}
      {activeTab === 'history' && renderHistoryViewer()}
      
      {/* Practice Tab with Catalogue Navigation */}
      {activeTab === 'practice' && (
        <>
          {/* Quiz in progress */}
          {selectedTopic && questions.length > 0 && !showResults && !isLoading && !error && renderQuestion()}
          
          {/* Quiz results */}
          {selectedTopic && showResults && renderResults()}
          
          {/* Loading state */}
          {selectedTopic && isLoading && renderLoading()}
          
          {/* Error state */}
          {selectedTopic && error && !isLoading && renderError()}
          
          {/* Navigation views (only when not in quiz) */}
          {!selectedTopic && questions.length === 0 && (
            <>
              {navigationLevel === 'catalogue' && renderCatalogue()}
              {navigationLevel === 'category' && selectedCategory && renderCategoryView()}
              {navigationLevel === 'subject' && selectedCategory && renderSubjectView()}
            </>
          )}
          
          {/* Topic detail view (when topic selected but no quiz active) */}
          {selectedTopic && questions.length === 0 && !isLoading && !error && renderTopicDetailView()}
        </>
      )}

      {/* Recommendation Modal */}
      {renderRecommendationModal()}

      {/* Cheat Sheet Viewer Modal */}
      {showCheatSheet && selectedTopic && (
        <CheatSheetViewer
          subject={selectedSubject}
          topic={selectedTopic.name}
          topicDescription={selectedTopic.description}
          onClose={() => setShowCheatSheet(false)}
        />
      )}
    </div>
  );
}

export default Learning;
