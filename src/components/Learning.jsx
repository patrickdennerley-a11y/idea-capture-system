import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, Check, X, Trophy, RotateCcw, Loader2, AlertCircle } from 'lucide-react';
import { generatePracticeQuestions } from '../utils/apiService';

// Statistics topics for MVP
const SUBJECTS = {
  Statistics: {
    name: 'Statistics',
    topics: [
      { id: 'descriptive', name: 'Descriptive Statistics', description: 'Mean, median, mode, variance, standard deviation' },
      { id: 'probability', name: 'Probability Basics', description: 'Basic probability rules, conditional probability, Bayes theorem' },
      { id: 'distributions', name: 'Distributions', description: 'Normal, binomial, Poisson distributions' },
      { id: 'hypothesis', name: 'Hypothesis Testing', description: 'Null hypothesis, p-values, significance levels' },
      { id: 'regression', name: 'Regression', description: 'Linear regression, correlation, R-squared' },
    ],
  },
};

const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', color: 'text-green-400' },
  { id: 'medium', name: 'Medium', color: 'text-yellow-400' },
  { id: 'hard', name: 'Hard', color: 'text-red-400' },
];

function Learning() {
  // State
  const [selectedSubject, setSelectedSubject] = useState('Statistics');
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scores, setScores] = useState({});

  // Load scores from localStorage
  useEffect(() => {
    try {
      const savedScores = localStorage.getItem('learning-scores');
      if (savedScores) {
        setScores(JSON.parse(savedScores));
      }
    } catch (err) {
      console.error('Error loading scores:', err);
    }
  }, []);

  // Save scores to localStorage
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

  // Get best score for a topic
  const getBestScore = (topicId) => {
    const key = `${selectedSubject}-${topicId}`;
    return scores[key];
  };

  // Start practice session
  const startPractice = async (topic) => {
    setSelectedTopic(topic);
    setIsLoading(true);
    setError(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowResults(false);

    const result = await generatePracticeQuestions(
      selectedSubject,
      topic.name,
      selectedDifficulty,
      5
    );

    setIsLoading(false);

    if (result.success && result.data?.questions) {
      setQuestions(result.data.questions);
    } else {
      setError(result.error || 'Failed to generate questions. Please try again.');
    }
  };

  // Handle answer selection for multiple choice
  const handleMultipleChoiceAnswer = (questionId, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // Handle short answer input
  const handleShortAnswer = (questionId, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  // Go to next question
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Calculate and save score
      const score = calculateScore();
      saveScore(selectedTopic.id, score, questions.length);
      setShowResults(true);
    }
  };

  // Calculate score
  const calculateScore = () => {
    let correct = 0;
    questions.forEach(q => {
      const userAnswer = userAnswers[q.id];
      if (q.type === 'multiple_choice') {
        // Extract just the letter (A, B, C, D) from the answer
        const userLetter = userAnswer?.charAt(0)?.toUpperCase();
        const correctLetter = q.correctAnswer?.charAt(0)?.toUpperCase();
        if (userLetter === correctLetter) correct++;
      } else {
        // For short answer, do a fuzzy match (case insensitive, trim whitespace)
        const normalizedUser = userAnswer?.toLowerCase().trim();
        const normalizedCorrect = q.correctAnswer?.toLowerCase().trim();
        if (normalizedUser === normalizedCorrect) correct++;
      }
    });
    return correct;
  };

  // Reset to topic selection
  const backToTopics = () => {
    setSelectedTopic(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setShowResults(false);
    setError(null);
  };

  // Retry current topic
  const retryTopic = () => {
    if (selectedTopic) {
      startPractice(selectedTopic);
    }
  };

  // Render topic selection
  const renderTopicSelection = () => {
    const subject = SUBJECTS[selectedSubject];
    
    return (
      <div className="space-y-6">
        {/* Subject Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-neural-purple" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{subject.name}</h2>
            <p className="text-sm text-gray-400">Select a topic to practice</p>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
          <label className="text-sm font-medium text-gray-300 mb-3 block">Difficulty</label>
          <div className="flex gap-2">
            {DIFFICULTIES.map(diff => (
              <button
                key={diff.id}
                onClick={() => setSelectedDifficulty(diff.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedDifficulty === diff.id
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span className={selectedDifficulty === diff.id ? '' : diff.color}>
                  {diff.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Topics List */}
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

  // Render loading state
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-12 h-12 text-neural-purple animate-spin mb-4" />
      <p className="text-gray-400">Generating questions...</p>
      <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <p className="text-red-400 font-medium mb-2">Failed to load questions</p>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-md">{error}</p>
      <div className="flex gap-3">
        <button
          onClick={backToTopics}
          className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Back to Topics
        </button>
        <button
          onClick={retryTopic}
          className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );

  // Render current question
  const renderQuestion = () => {
    const question = questions[currentQuestionIndex];
    if (!question) return null;

    const userAnswer = userAnswers[question.id];
    const isAnswered = userAnswer !== undefined && userAnswer !== '';

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={backToTopics}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to topics
          </button>
          <span className="text-sm text-gray-400">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neural-purple to-neural-pink transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Card */}
        <div className="bg-neural-dark rounded-xl p-6 border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded-full ${
              question.type === 'multiple_choice' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'bg-purple-500/20 text-purple-400'
            }`}>
              {question.type === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
            </span>
          </div>

          <h3 className="text-lg font-medium text-white mb-6">{question.question}</h3>

          {question.type === 'multiple_choice' ? (
            <div className="space-y-3">
              {question.options?.map((option, idx) => {
                const letter = option.charAt(0);
                const isSelected = userAnswer === letter;
                return (
                  <button
                    key={idx}
                    onClick={() => handleMultipleChoiceAnswer(question.id, letter)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-neural-purple bg-neural-purple/20 text-white'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={userAnswer || ''}
              onChange={(e) => handleShortAnswer(question.id, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none resize-none"
              rows={3}
            />
          )}
        </div>

        {/* Next Button */}
        <button
          onClick={nextQuestion}
          disabled={!isAnswered}
          className={`w-full py-3 rounded-lg font-medium transition-all ${
            isAnswered
              ? 'bg-neural-purple text-white hover:bg-neural-purple/80'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
        </button>
      </div>
    );
  };

  // Render results
  const renderResults = () => {
    const score = calculateScore();
    const percentage = Math.round((score / questions.length) * 100);
    
    let message = '';
    let messageColor = '';
    if (percentage >= 80) {
      message = 'Excellent work! 🎉';
      messageColor = 'text-green-400';
    } else if (percentage >= 60) {
      message = 'Good job! Keep practicing! 💪';
      messageColor = 'text-yellow-400';
    } else {
      message = 'Keep learning, you\'ll get there! 📚';
      messageColor = 'text-orange-400';
    }

    return (
      <div className="space-y-6">
        {/* Results Header */}
        <div className="text-center py-8">
          <div className="w-20 h-20 bg-neural-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-neural-purple" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Practice Complete!</h2>
          <p className={`text-lg ${messageColor}`}>{message}</p>
        </div>

        {/* Score Card */}
        <div className="bg-neural-dark rounded-xl p-6 border border-gray-800 text-center">
          <div className="text-5xl font-bold text-white mb-2">
            {score} / {questions.length}
          </div>
          <div className="text-xl text-gray-400">{percentage}% correct</div>
        </div>

        {/* Question Review */}
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="font-medium text-white">Review Answers</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {questions.map((q, idx) => {
              const userAnswer = userAnswers[q.id];
              let isCorrect = false;
              
              if (q.type === 'multiple_choice') {
                const userLetter = userAnswer?.charAt(0)?.toUpperCase();
                const correctLetter = q.correctAnswer?.charAt(0)?.toUpperCase();
                isCorrect = userLetter === correctLetter;
              } else {
                isCorrect = userAnswer?.toLowerCase().trim() === q.correctAnswer?.toLowerCase().trim();
              }

              return (
                <div key={q.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCorrect ? 'bg-green-500/20' : 'bg-red-500/20'
                    }`}>
                      {isCorrect ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-300 mb-2">
                        <span className="text-gray-500">Q{idx + 1}:</span> {q.question}
                      </p>
                      <p className="text-sm">
                        <span className="text-gray-500">Your answer:</span>{' '}
                        <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>
                          {userAnswer || '(no answer)'}
                        </span>
                      </p>
                      {!isCorrect && (
                        <p className="text-sm">
                          <span className="text-gray-500">Correct:</span>{' '}
                          <span className="text-green-400">{q.correctAnswer}</span>
                        </p>
                      )}
                      <p className="text-sm text-gray-500 mt-2 italic">{q.explanation}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={backToTopics}
            className="flex-1 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Topics
          </button>
          <button
            onClick={retryTopic}
            className="flex-1 py-3 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {!selectedTopic && renderTopicSelection()}
      {selectedTopic && isLoading && renderLoading()}
      {selectedTopic && error && renderError()}
      {selectedTopic && !isLoading && !error && questions.length > 0 && !showResults && renderQuestion()}
      {selectedTopic && showResults && renderResults()}
    </div>
  );
}

export default Learning;
