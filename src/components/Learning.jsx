import { useState, useEffect, useMemo } from 'react';
import { BookOpen, ChevronRight, Check, X, Trophy, RotateCcw, Loader2, AlertCircle, BarChart3, Clock, Target, Flame, ChevronDown, Settings, History, Filter, ChevronUp } from 'lucide-react';
import { generatePracticeQuestions, evaluateAnswer } from '../utils/apiService';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Expanded curriculum with all subjects
const SUBJECTS = {
  Statistics: {
    name: 'Statistics',
    icon: '📊',
    topics: [
      { id: 'descriptive', name: 'Descriptive Statistics', description: 'Mean, median, mode, variance, standard deviation' },
      { id: 'probability', name: 'Probability Basics', description: 'Basic probability rules, conditional probability, Bayes theorem' },
      { id: 'distributions', name: 'Distributions', description: 'Normal, binomial, Poisson distributions' },
      { id: 'hypothesis', name: 'Hypothesis Testing', description: 'Null hypothesis, p-values, significance levels' },
      { id: 'regression', name: 'Regression', description: 'Linear regression, correlation, R-squared' },
    ],
  },
  Calculus: {
    name: 'Calculus',
    icon: '∫',
    topics: [
      { id: 'limits', name: 'Limits', description: 'Limit definition, L\'Hôpital\'s rule, continuity' },
      { id: 'derivatives', name: 'Derivatives', description: 'Differentiation rules, chain rule, implicit differentiation' },
      { id: 'integrals', name: 'Integrals', description: 'Integration techniques, definite and indefinite integrals' },
      { id: 'applications', name: 'Applications of Derivatives', description: 'Optimization, related rates, curve sketching' },
      { id: 'series', name: 'Infinite Series', description: 'Convergence tests, Taylor series, power series' },
    ],
  },
  LinearAlgebra: {
    name: 'Linear Algebra',
    icon: '🔢',
    topics: [
      { id: 'vectors', name: 'Vectors & Spaces', description: 'Vector operations, vector spaces, subspaces' },
      { id: 'matrices', name: 'Matrix Operations', description: 'Matrix multiplication, inverse, transpose' },
      { id: 'determinants', name: 'Determinants', description: 'Determinant calculation, properties, applications' },
      { id: 'eigenvalues', name: 'Eigenvalues & Eigenvectors', description: 'Eigenvalue problems, diagonalization' },
      { id: 'transformations', name: 'Linear Transformations', description: 'Kernel, image, rank-nullity theorem' },
    ],
  },
  Probability: {
    name: 'Probability',
    icon: '🎲',
    topics: [
      { id: 'prob-basics', name: 'Probability Basics', description: 'Sample spaces, events, probability axioms' },
      { id: 'random-vars', name: 'Random Variables', description: 'Discrete and continuous random variables, PMF, PDF' },
      { id: 'distributions-prob', name: 'Distributions', description: 'Common distributions: uniform, exponential, normal' },
      { id: 'expected-value', name: 'Expected Value & Variance', description: 'Expectation, variance, covariance, moments' },
      { id: 'bayes', name: 'Bayes\' Theorem', description: 'Conditional probability, Bayesian inference' },
    ],
  },
  ComputerScience: {
    name: 'Computer Science',
    icon: '💻',
    topics: [
      { id: 'algorithms', name: 'Algorithm Basics', description: 'Algorithm design, correctness, efficiency' },
      { id: 'data-structures', name: 'Data Structures', description: 'Arrays, linked lists, trees, graphs, hash tables' },
      { id: 'complexity', name: 'Time Complexity', description: 'Big O notation, time and space analysis' },
      { id: 'recursion', name: 'Recursion', description: 'Recursive thinking, base cases, recursive algorithms' },
      { id: 'sorting', name: 'Sorting Algorithms', description: 'Bubble, merge, quick, heap sort and comparisons' },
    ],
  },
};

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

  // Quiz settings state
  const [showSettings, setShowSettings] = useState(true);
  const [questionCount, setQuestionCount] = useState(5);
  const [questionStyle, setQuestionStyle] = useState('balanced');
  const [focusMode, setFocusMode] = useState('understanding');

  // History filter state
  const [historyFilters, setHistoryFilters] = useState({
    subject: 'all',
    topic: 'all',
    result: 'all',
    dateRange: 'all'
  });
  const [expandedHistoryItem, setExpandedHistoryItem] = useState(null);

  useEffect(() => {
    try {
      const savedScores = localStorage.getItem('learning-scores');
      if (savedScores) setScores(JSON.parse(savedScores));
      
      const savedHistory = localStorage.getItem('learning-question-history');
      if (savedHistory) setQuestionHistory(JSON.parse(savedHistory));
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, []);

  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length && !showResults) {
      setQuestionStartTime(Date.now());
    }
  }, [currentQuestionIndex, questions.length, showResults]);

  const saveScore = (topicId, score, total) => {
    const key = `${selectedSubject}-${topicId}`;
    const newScores = { ...scores };
    
    if (!newScores[key] || score > newScores[key].best) {
      newScores[key] = {
        best: score,
        total,
        percentage: Math.round((score / total) * 100),
        lastAttempt: new Date().toISOString(),
      };
    }
    
    setScores(newScores);
    localStorage.setItem('learning-scores', JSON.stringify(newScores));
  };

  const saveQuestionToHistory = (question, userAnswer, result, score, timeTaken) => {
    const historyEntry = {
      visibleID: generateQuestionId(),
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
      timestamp: new Date().toISOString(),
    };
    
    const newHistory = [historyEntry, ...questionHistory].slice(0, 1000);
    setQuestionHistory(newHistory);
    localStorage.setItem('learning-question-history', JSON.stringify(newHistory));
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

  const checkCalculationAnswer = (userAnswer, correctAnswer) => {
    const userNum = parseFloat(userAnswer);
    const correctNum = parseFloat(correctAnswer);
    
    if (isNaN(userNum) || isNaN(correctNum)) return { result: 'incorrect', score: 0 };
    
    const tolerance = Math.abs(correctNum * 0.01);
    const diff = Math.abs(userNum - correctNum);
    
    if (diff <= tolerance) return { result: 'correct', score: 1 };
    if (diff <= tolerance * 5) return { result: 'partial', score: 0.5 };
    return { result: 'incorrect', score: 0 };
  };

  const nextQuestion = async () => {
    const question = questions[currentQuestionIndex];
    const userAnswer = userAnswers[question.id];
    const timeTaken = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0;
    setQuestionTimes(prev => ({ ...prev, [question.id]: timeTaken }));

    if (question.type === 'short_answer' && userAnswer) {
      setIsEvaluating(true);
      const evalResult = await evaluateAnswer(question.question, userAnswer, question.correctAnswer, question.type);
      setIsEvaluating(false);

      if (evalResult.success && evalResult.data) {
        setAnswerEvaluations(prev => ({ ...prev, [question.id]: evalResult.data }));
        saveQuestionToHistory(question, userAnswer, evalResult.data.result, evalResult.data.score, timeTaken);
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
      saveQuestionToHistory(question, userAnswer, calcResult.result, calcResult.score, timeTaken);
    } else {
      const userLetter = userAnswer?.charAt(0)?.toUpperCase();
      const correctLetter = question.correctAnswer?.charAt(0)?.toUpperCase();
      const isCorrect = userLetter === correctLetter;
      saveQuestionToHistory(question, userAnswer, isCorrect ? 'correct' : 'incorrect', isCorrect ? 1 : 0, timeTaken);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const totalScore = calculateTotalScore();
      saveScore(selectedTopic.id, totalScore, questions.length);
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
    setSelectedTopic(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setAnswerEvaluations({});
    setShowResults(false);
    setError(null);
  };

  const retryTopic = () => {
    if (selectedTopic) startPractice(selectedTopic);
  };

  const getProgressStats = () => {
    const totalQuestions = questionHistory.length;
    const correctAnswers = questionHistory.filter(q => q.result === 'correct').length;
    const partialAnswers = questionHistory.filter(q => q.result === 'partial').length;
    const accuracyRate = totalQuestions > 0 ? ((correctAnswers + partialAnswers * 0.5) / totalQuestions * 100).toFixed(1) : 0;
    const avgTime = totalQuestions > 0 ? Math.round(questionHistory.reduce((sum, q) => sum + (q.timeTaken || 0), 0) / totalQuestions) : 0;
    
    const topicStats = {};
    questionHistory.forEach(q => {
      const key = `${q.subject}-${q.topic}`;
      if (!topicStats[key]) topicStats[key] = { subject: q.subject, topic: q.topic, correct: 0, total: 0, bestScore: 0 };
      topicStats[key].total++;
      if (q.result === 'correct') topicStats[key].correct++;
      else if (q.result === 'partial') topicStats[key].correct += 0.5;
      const scorePercent = (topicStats[key].correct / topicStats[key].total) * 100;
      topicStats[key].bestScore = Math.max(topicStats[key].bestScore, scorePercent);
    });
    
    const uniqueDates = [...new Set(questionHistory.map(q => new Date(q.timestamp).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDate = new Date(uniqueDates[i - 1]);
        const currDate = new Date(uniqueDates[i]);
        if (Math.round((prevDate - currDate) / 86400000) === 1) streak++;
        else break;
      }
    }
    
    return { totalQuestions, accuracyRate, avgTime, topicStats: Object.values(topicStats), streak };
  };

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
    const stats = getProgressStats();
    
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
                        <p className="text-sm text-green-400">{item.correctAnswer}</p>
                      </div>
                      {item.explanation && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Explanation:</p>
                          <p className="text-sm text-gray-400">{item.explanation}</p>
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
          ) : question.type === 'calculation' || (question.type === 'formula' && !question.options) ? (
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

        <button
          onClick={nextQuestion}
          disabled={!isAnswered || isEvaluating}
          className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${isAnswered && !isEvaluating ? 'bg-neural-purple text-white hover:bg-neural-purple/80' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
        >
          {isEvaluating ? (<><Loader2 className="w-4 h-4 animate-spin" />Evaluating...</>) : currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
        </button>
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
                      {!isCorrect && <p className="text-sm"><span className="text-gray-500">Correct:</span> <span className="text-green-400">{q.correctAnswer}</span></p>}
                      {feedback && <p className="text-sm text-neural-purple mt-2 bg-neural-purple/10 p-2 rounded">AI Feedback: {feedback}</p>}
                      <p className="text-sm text-gray-500 mt-2 italic">{q.explanation}</p>
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
      {activeTab === 'practice' && !selectedTopic && renderTopicSelection()}
      {activeTab === 'practice' && selectedTopic && isLoading && renderLoading()}
      {activeTab === 'practice' && selectedTopic && error && renderError()}
      {activeTab === 'practice' && selectedTopic && !isLoading && !error && questions.length > 0 && !showResults && renderQuestion()}
      {activeTab === 'practice' && selectedTopic && showResults && renderResults()}
    </div>
  );
}

export default Learning;
