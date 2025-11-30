import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, RotateCcw, Lightbulb, ChevronRight, AlertCircle, Check, Trophy, Sparkles, RefreshCw } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import {
  generateFlashcards,
  saveDeck,
  getDeck,
  getStudySession,
  updateCardProgress,
  getDeckStats,
} from '../utils/flashcardService';

// Helper to render LaTeX in text
const renderMathText = (text) => {
  if (!text) return null;
  
  // Split by block math first ($$...$$)
  const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const latex = part.slice(2, -2).trim();
      try {
        return <BlockMath key={idx} math={latex} />;
      } catch (e) {
        return <span key={idx} className="text-red-400 font-mono text-sm">{part}</span>;
      }
    }
    
    // Handle inline math ($...$)
    const inlineParts = part.split(/(\$[^$]+\$)/g);
    return inlineParts.map((inlinePart, inlineIdx) => {
      if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
        const latex = inlinePart.slice(1, -1);
        try {
          return <InlineMath key={`${idx}-${inlineIdx}`} math={latex} />;
        } catch (e) {
          return <span key={`${idx}-${inlineIdx}`} className="text-red-400 font-mono text-sm">{inlinePart}</span>;
        }
      }
      // Handle newlines in plain text
      if (inlinePart.includes('\n')) {
        return inlinePart.split('\n').map((line, lineIdx) => (
          <span key={`${idx}-${inlineIdx}-${lineIdx}`}>
            {lineIdx > 0 && <br />}
            {line}
          </span>
        ));
      }
      return <span key={`${idx}-${inlineIdx}`}>{inlinePart}</span>;
    });
  });
};

// Card type badge colors
const TYPE_COLORS = {
  formula: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Formula' },
  definition: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Definition' },
  concept: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Concept' },
  theorem: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Theorem' },
};

// Rating button configurations
const RATING_BUTTONS = [
  { quality: 1, label: 'Again', color: 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30', description: 'Complete blackout' },
  { quality: 3, label: 'Hard', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30', description: 'Difficult recall' },
  { quality: 4, label: 'Good', color: 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30', description: 'Correct with effort' },
  { quality: 5, label: 'Easy', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30', description: 'Perfect recall' },
];

function FlashcardViewer({ subject, topic, topicDescription, onClose }) {
  // State
  const [deck, setDeck] = useState(null);
  const [studySession, setStudySession] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [sessionStats, setSessionStats] = useState({ total: 0, correct: 0, incorrect: 0, remaining: 0 });
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [deckStats, setDeckStats] = useState(null);

  // Load or generate deck
  const loadDeck = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to get existing deck
      const { data: existingDeck } = await getDeck(subject, topic);

      if (existingDeck && existingDeck.cards && existingDeck.cards.length > 0) {
        setDeck(existingDeck);
        
        // Get study session
        const { data: sessionData } = await getStudySession(subject, topic, 20);
        if (sessionData && sessionData.cards) {
          setStudySession(sessionData.cards);
          setSessionStats({
            total: sessionData.cards.length,
            correct: 0,
            incorrect: 0,
            remaining: sessionData.cards.length,
          });
        }

        // Get deck stats
        const { data: stats } = await getDeckStats(existingDeck.id, existingDeck.cards);
        if (stats) {
          setDeckStats(stats);
        }
      } else {
        // No deck exists, generate one
        await generateNewDeck();
      }
    } catch (err) {
      console.error('Error loading deck:', err);
      setError('Failed to load flashcards. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [subject, topic]);

  // Generate new deck
  const generateNewDeck = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateFlashcards(subject, topic, topicDescription);

      if (result.success && result.data?.cards) {
        const cards = result.data.cards;
        
        // Save the deck
        const { data: savedDeck } = await saveDeck(subject, topic, cards);
        
        if (savedDeck) {
          setDeck(savedDeck);
          setStudySession(cards);
          setSessionStats({
            total: cards.length,
            correct: 0,
            incorrect: 0,
            remaining: cards.length,
          });
          setDeckStats({
            total: cards.length,
            mastered: 0,
            learning: 0,
            new: cards.length,
            due: cards.length,
          });
        }
      } else {
        throw new Error(result.error || 'Failed to generate flashcards');
      }
    } catch (err) {
      console.error('Error generating deck:', err);
      setError(err.message || 'Failed to generate flashcards. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isLoading || isGenerating || isSessionComplete) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case '1':
          if (isFlipped) handleRating(1);
          break;
        case '2':
          if (isFlipped) handleRating(3);
          break;
        case '3':
          if (isFlipped) handleRating(4);
          break;
        case '4':
          if (isFlipped) handleRating(5);
          break;
        case 'h':
          if (!isFlipped) setShowHint(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isLoading, isGenerating, isSessionComplete]);

  // Handle card rating
  const handleRating = async (quality) => {
    if (!deck || !studySession[currentIndex]) return;

    const card = studySession[currentIndex];
    const isCorrect = quality >= 3;

    // Update progress
    await updateCardProgress(deck.id, card.id, quality);

    // Update session stats
    setSessionStats(prev => ({
      ...prev,
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
      remaining: prev.remaining - 1,
    }));

    // Move to next card or end session
    if (currentIndex < studySession.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setShowHint(false);
    } else {
      setIsSessionComplete(true);
      // Refresh deck stats
      const { data: stats } = await getDeckStats(deck.id, deck.cards);
      if (stats) {
        setDeckStats(stats);
      }
    }
  };

  // Start new study session
  const startNewSession = async () => {
    setIsSessionComplete(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);

    const { data: sessionData } = await getStudySession(subject, topic, 20);
    if (sessionData && sessionData.cards) {
      setStudySession(sessionData.cards);
      setSessionStats({
        total: sessionData.cards.length,
        correct: 0,
        incorrect: 0,
        remaining: sessionData.cards.length,
      });
    }
  };

  // Regenerate deck with fresh cards
  const regenerateDeck = async () => {
    setIsSessionComplete(false);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    await generateNewDeck();
  };

  // Current card
  const currentCard = studySession[currentIndex];

  // Render loading state
  if (isLoading || isGenerating) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-neural-dark rounded-xl border border-gray-800 p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 text-neural-purple animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">
            {isGenerating ? 'Generating Flashcards...' : 'Loading Flashcards...'}
          </h3>
          <p className="text-gray-400">
            {isGenerating
              ? `Creating 15-20 cards for ${topic}. This may take a moment.`
              : 'Preparing your study session...'
            }
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-neural-dark rounded-xl border border-gray-800 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Failed to Load</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={generateNewDeck}
              className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render session complete
  if (isSessionComplete) {
    const accuracy = sessionStats.total > 0 
      ? Math.round((sessionStats.correct / sessionStats.total) * 100) 
      : 0;

    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-neural-dark rounded-xl border border-gray-800 p-8 max-w-lg w-full">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-neural-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-neural-purple" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Session Complete!</h3>
            <p className="text-gray-400">{topic}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-white">{sessionStats.total}</div>
              <div className="text-xs text-gray-400">Cards Studied</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{sessionStats.correct}</div>
              <div className="text-xs text-gray-400">Correct</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{sessionStats.incorrect}</div>
              <div className="text-xs text-gray-400">Needs Review</div>
            </div>
          </div>

          {/* Accuracy bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Accuracy</span>
              <span className={accuracy >= 70 ? 'text-green-400' : accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                {accuracy}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${accuracy >= 70 ? 'bg-green-500' : accuracy >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>

          {/* Deck stats */}
          {deckStats && (
            <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Deck Progress</h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="text-lg font-bold text-blue-400">{deckStats.new}</div>
                  <div className="text-gray-500">New</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-yellow-400">{deckStats.learning}</div>
                  <div className="text-gray-500">Learning</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-400">{deckStats.mastered}</div>
                  <div className="text-gray-500">Mastered</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-400">{deckStats.due}</div>
                  <div className="text-gray-500">Due</div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={startNewSession}
              className="flex-1 py-3 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Study Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render no cards
  if (!currentCard) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-neural-dark rounded-xl border border-gray-800 p-8 max-w-md w-full text-center">
          <Sparkles className="w-12 h-12 text-neural-purple mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
          <p className="text-gray-400 mb-6">No cards due for review right now. Come back later or regenerate the deck.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={regenerateDeck}
              className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = TYPE_COLORS[currentCard.type] || TYPE_COLORS.concept;

  // Render main flashcard interface
  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4 pb-8">
        <div className="bg-neural-darker rounded-xl border border-gray-800 w-full max-w-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-white">{topic}</h2>
            <p className="text-xs text-gray-500">{subject}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={regenerateDeck}
              className="text-sm text-gray-400 hover:text-neural-purple transition-colors flex items-center gap-1"
              title="Generate fresh cards"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pt-3">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>Card {currentIndex + 1} of {studySession.length}</span>
            <span className="flex items-center gap-3">
              <span className="text-green-400">{sessionStats.correct} ✓</span>
              <span className="text-red-400">{sessionStats.incorrect} ✗</span>
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neural-purple to-neural-pink transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / studySession.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Card container */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Card type badge */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-1 rounded-full ${typeConfig.bg} ${typeConfig.text}`}>
              {typeConfig.label}
            </span>
          </div>

          {/* Flashcard with flip animation */}
          <div 
            className="flashcard-container cursor-pointer"
            onClick={() => setIsFlipped(prev => !prev)}
          >
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="flashcard-face flashcard-front">
                <div className="text-center">
                  <div className="text-lg text-white leading-relaxed">
                    {renderMathText(currentCard.front)}
                  </div>
                  {!isFlipped && (
                    <p className="text-sm text-gray-500 mt-6">
                      Click or press Space to reveal answer
                    </p>
                  )}
                </div>
              </div>

              {/* Back */}
              <div className="flashcard-face flashcard-back">
                <div className="text-center">
                  <div className="text-lg text-white leading-relaxed">
                    {renderMathText(currentCard.back)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hint section (only before flipping) */}
          {!isFlipped && currentCard.hint && (
            <div className="mt-4">
              {showHint ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-200">{currentCard.hint}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHint(true);
                  }}
                  className="flex items-center gap-2 text-sm text-yellow-400 hover:text-yellow-300 transition-colors mx-auto"
                >
                  <Lightbulb className="w-4 h-4" />
                  Show Hint (H)
                </button>
              )}
            </div>
          )}

          {/* Rating buttons (only after flipping) */}
          {isFlipped && (
            <div className="mt-6 space-y-3">
              <p className="text-center text-sm text-gray-400">How well did you know this?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map((btn, idx) => (
                  <button
                    key={btn.quality}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRating(btn.quality);
                    }}
                    className={`py-3 px-2 rounded-lg border font-medium transition-all text-sm ${btn.color}`}
                    title={`${btn.description} (Press ${idx + 1})`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-gray-500">
                Keyboard: 1=Again, 2=Hard, 3=Good, 4=Easy
              </p>
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="p-3 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
            <span>Space: Flip</span>
            <span>H: Hint</span>
            <span>1-4: Rate</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default FlashcardViewer;
