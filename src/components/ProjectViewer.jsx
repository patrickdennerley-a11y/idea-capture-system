import { useState } from 'react';
import { ChevronDown, ChevronUp, Target, CheckCircle2, Lightbulb, AlertTriangle, FileText, Upload, Send, BookOpen } from 'lucide-react';
import CodeEditor from './CodeEditor';
import ImageAnswerUpload from './ImageAnswerUpload';

function ProjectViewer({ 
  project, 
  onSubmit, 
  isComplete = false,
  userAnswer = '',
  onAnswerChange,
}) {
  const [showHints, setShowHints] = useState(false);
  const [submissionType, setSubmissionType] = useState('text'); // 'text', 'code', 'image'
  const [imageData, setImageData] = useState(null);

  if (!project) return null;

  const {
    question: title,
    overview,
    objectives = [],
    requirements = [],
    advancedChallenges = [],
    hints = [],
    evaluationCriteria = [],
    explanation,
    language,
  } = project;

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit({
        answer: userAnswer,
        submissionType,
        imageData,
      });
    }
  };

  // Determine if this is a coding-heavy project
  const isCodeProject = language || title?.toLowerCase().includes('implement') || 
                        title?.toLowerCase().includes('code') || 
                        overview?.toLowerCase().includes('python') ||
                        overview?.toLowerCase().includes('program');

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="bg-gradient-to-r from-neural-purple/20 to-neural-pink/20 rounded-xl p-6 border border-neural-purple/30">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-neural-purple/30 rounded-xl flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-7 h-7 text-neural-purple" />
          </div>
          <div className="flex-1">
            <span className="text-xs px-2 py-1 rounded-full bg-neural-purple/20 text-neural-purple font-medium">
              PROJECT
            </span>
            <h1 className="text-2xl font-bold text-white mt-2">{title}</h1>
            {overview && (
              <p className="text-gray-300 mt-3 leading-relaxed">{overview}</p>
            )}
          </div>
        </div>
      </div>

      {/* Learning Objectives */}
      {objectives && objectives.length > 0 && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-white">Learning Objectives</h2>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {objectives.map((objective, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-300">{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Requirements / Milestones */}
      {requirements && requirements.length > 0 && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold text-white">Requirements</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {requirements.map((req, idx) => (
              <div key={idx} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 font-bold text-sm">
                      {req.part || idx + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    {req.title && (
                      <h3 className="font-medium text-white mb-1">{req.title}</h3>
                    )}
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {req.description || req}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Challenges (for hard/extreme difficulty) */}
      {advancedChallenges && advancedChallenges.length > 0 && (
        <div className="bg-orange-500/10 rounded-xl border border-orange-500/30 overflow-hidden">
          <div className="px-4 py-3 bg-orange-500/20 border-b border-orange-500/30 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <h2 className="font-semibold text-orange-400">Advanced Challenges</h2>
            <span className="text-xs px-2 py-0.5 bg-orange-500/30 text-orange-300 rounded-full ml-2">
              Requires Research
            </span>
          </div>
          <div className="p-4">
            <p className="text-orange-300/80 text-sm mb-3">
              These challenges go beyond the course material and may require additional research:
            </p>
            <ul className="space-y-2">
              {advancedChallenges.map((challenge, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-orange-400 font-bold">•</span>
                  <span className="text-orange-200/90">{challenge}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Hints (Collapsible) */}
      {hints && hints.length > 0 && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <button
            onClick={() => setShowHints(!showHints)}
            className="w-full px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              <h2 className="font-semibold text-white">Hints & Suggestions</h2>
              <span className="text-xs text-gray-500">({hints.length} available)</span>
            </div>
            {showHints ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {showHints && (
            <div className="p-4">
              <ul className="space-y-3">
                {hints.map((hint, idx) => (
                  <li key={idx} className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                    <span className="text-yellow-400 font-bold text-sm">💡</span>
                    <span className="text-gray-300 text-sm">{hint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Criteria */}
      {evaluationCriteria && evaluationCriteria.length > 0 && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Evaluation Criteria</h2>
          </div>
          <div className="p-4">
            <ul className="space-y-2">
              {evaluationCriteria.map((criterion, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-600 rounded flex-shrink-0" />
                  <span className="text-gray-300">{criterion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Submission Area */}
      {!isComplete && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-neural-purple" />
              Your Solution
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {/* Submission Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSubmissionType('text')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  submissionType === 'text'
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                📝 Written Response
              </button>
              {isCodeProject && (
                <button
                  onClick={() => setSubmissionType('code')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    submissionType === 'code'
                      ? 'bg-neural-purple text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  💻 Code
                </button>
              )}
              <button
                onClick={() => setSubmissionType('image')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  submissionType === 'image'
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                📷 Upload Work
              </button>
            </div>

            {/* Submission Input */}
            {submissionType === 'text' && (
              <textarea
                value={userAnswer}
                onChange={(e) => onAnswerChange && onAnswerChange(e.target.value)}
                placeholder="Describe your solution approach, explain your reasoning, and provide your answers..."
                className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none resize-none"
                rows={8}
              />
            )}

            {submissionType === 'code' && (
              <CodeEditor
                value={userAnswer}
                onChange={onAnswerChange}
                language={language || 'python'}
                placeholder="Write your solution code here..."
                minHeight={300}
                showTestCases={false}
              />
            )}

            {submissionType === 'image' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Upload images of your handwritten work, diagrams, or screenshots of your solution.
                </p>
                <ImageAnswerUpload
                  question={title}
                  correctAnswer=""
                  onImageProcessed={(result) => {
                    setImageData(result);
                    if (onAnswerChange) {
                      onAnswerChange(`[Image Submission]\n${result.extractedWork || 'Image uploaded'}`);
                    }
                  }}
                />
                {imageData && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-400 text-sm">✓ Image processed successfully</p>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!userAnswer || userAnswer.trim().length === 0}
              className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                userAnswer && userAnswer.trim().length > 0
                  ? 'bg-neural-purple text-white hover:bg-neural-purple/80'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              Submit Project
            </button>
          </div>
        </div>
      )}

      {/* Completed State */}
      {isComplete && (
        <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-6 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-xl font-bold text-green-400 mb-2">Project Submitted!</h3>
          <p className="text-gray-400">Your solution has been evaluated.</p>
        </div>
      )}
    </div>
  );
}

export default ProjectViewer;
