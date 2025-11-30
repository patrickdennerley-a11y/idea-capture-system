import { useState, useEffect } from 'react';
import { X, Download, RotateCcw, Loader2, AlertCircle, FileText } from 'lucide-react';
import { generateCheatsheet } from '../utils/apiService';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

// Helper to render LaTeX in text (similar to Learning.jsx)
const renderMathText = (text) => {
  if (!text) return null;
  
  // Split by block math first ($$...$$)
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
    
    // Handle inline math ($...$)
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

// Parse markdown content into sections
const parseMarkdownContent = (content) => {
  if (!content) return [];
  
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];
  
  lines.forEach((line) => {
    // Check for ## header (main sections)
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n').trim(),
        });
      }
      currentSection = line.slice(3).trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  });
  
  // Don't forget the last section
  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n').trim(),
    });
  }
  
  return sections;
};

// Render a single section's content with proper formatting
const renderSectionContent = (content) => {
  if (!content) return null;
  
  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null; // 'bullet' or 'numbered'
  
  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'numbered') {
        elements.push(
          <ol key={elements.length} className="list-decimal list-inside space-y-2 my-3">
            {listItems.map((item, i) => (
              <li key={i} className="text-gray-300">{renderMathText(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={elements.length} className="list-disc list-inside space-y-2 my-3">
            {listItems.map((item, i) => (
              <li key={i} className="text-gray-300">{renderMathText(item)}</li>
            ))}
          </ul>
        );
      }
      listItems = [];
      listType = null;
    }
  };
  
  lines.forEach((line, idx) => {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      flushList();
      return;
    }
    
    // Check for bullet points
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      if (listType !== 'bullet') {
        flushList();
        listType = 'bullet';
      }
      listItems.push(trimmedLine.slice(2));
      return;
    }
    
    // Check for numbered lists
    const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      if (listType !== 'numbered') {
        flushList();
        listType = 'numbered';
      }
      listItems.push(numberedMatch[2]);
      return;
    }
    
    // Regular paragraph or bold text
    flushList();
    
    // Handle **bold** text
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const hasBold = boldRegex.test(trimmedLine);
    
    if (hasBold) {
      // Reset regex
      boldRegex.lastIndex = 0;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(trimmedLine)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', content: trimmedLine.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'bold', content: match[1] });
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < trimmedLine.length) {
        parts.push({ type: 'text', content: trimmedLine.slice(lastIndex) });
      }
      
      elements.push(
        <p key={idx} className="text-gray-300 my-2">
          {parts.map((part, i) => 
            part.type === 'bold' 
              ? <strong key={i} className="text-white font-semibold">{renderMathText(part.content)}</strong>
              : <span key={i}>{renderMathText(part.content)}</span>
          )}
        </p>
      );
    } else {
      elements.push(
        <p key={idx} className="text-gray-300 my-2">{renderMathText(trimmedLine)}</p>
      );
    }
  });
  
  flushList();
  return elements;
};

function CheatSheetViewer({ subject, topic, topicDescription, onClose }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const fetchCheatsheet = async () => {
    setIsLoading(true);
    setError(null);
    setContent('');
    
    const result = await generateCheatsheet(subject, topic, topicDescription);
    
    setIsLoading(false);
    
    if (result.success && result.data) {
      setContent(result.data.content);
      setGeneratedAt(result.data.generatedAt);
    } else {
      setError(result.error || 'Failed to generate cheat sheet');
    }
  };

  useEffect(() => {
    fetchCheatsheet();
  }, []);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleRegenerate = () => {
    fetchCheatsheet();
  };

  const sections = parseMarkdownContent(content);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 overflow-y-auto">
      {/* Print-specific wrapper */}
      <div className="cheatsheet-printable">
        {/* Header - hidden when printing */}
        <div className="no-print sticky top-0 bg-neural-darker/95 backdrop-blur-sm border-b border-gray-800 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neural-purple/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-neural-purple" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{topic}</h1>
                <p className="text-sm text-gray-400">Cheat Sheet • {subject}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-neural-purple animate-spin mb-4" />
              <p className="text-white font-medium mb-2">Generating cheat sheet...</p>
              <p className="text-sm text-gray-400">This may take 10-20 seconds</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 font-medium mb-2">Failed to generate cheat sheet</p>
              <p className="text-sm text-gray-500 mb-6 text-center max-w-md">{error}</p>
              <button
                onClick={handleRegenerate}
                className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Cheat Sheet Content */}
          {content && !isLoading && !error && (
            <>
              {/* Print Header - only visible when printing */}
              <div className="hidden print:block print:mb-6">
                <h1 className="text-2xl font-bold text-black">{topic} - Cheat Sheet</h1>
                <p className="text-gray-600">{subject}</p>
              </div>

              {/* Sections */}
              <div className="space-y-6">
                {sections.map((section, idx) => (
                  <div key={idx} className="bg-neural-dark rounded-xl p-5 border border-gray-800 print:bg-white print:border-gray-300 print:p-4">
                    <h2 className="text-lg font-semibold text-neural-purple mb-3 print:text-purple-700">
                      {section.title}
                    </h2>
                    <div className="text-gray-300 print:text-gray-800">
                      {renderSectionContent(section.content)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Generated timestamp */}
              {generatedAt && (
                <p className="text-xs text-gray-500 mt-6 text-center print:hidden">
                  Generated: {new Date(generatedAt).toLocaleString()}
                </p>
              )}

              {/* Action Buttons - hidden when printing */}
              <div className="no-print flex gap-3 mt-8 justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleRegenerate}
                  className="px-6 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Regenerate
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-6 py-3 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CheatSheetViewer;
