import { useState, useRef, useEffect } from 'react';
import { Code2, Play, Copy, Check } from 'lucide-react';

// Language configurations
const LANGUAGE_CONFIG = {
  python: {
    name: 'Python',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    extensions: ['.py'],
  },
  r: {
    name: 'R',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    extensions: ['.r', '.R'],
  },
  javascript: {
    name: 'JavaScript',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    extensions: ['.js'],
  },
};

function CodeEditor({ 
  value = '', 
  onChange, 
  language = 'python', 
  starterCode = '', 
  disabled = false,
  testCases = [],
  showTestCases = true,
  placeholder = 'Write your code here...',
  minHeight = 200,
}) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [lineCount, setLineCount] = useState(1);

  // Initialize with starter code if value is empty
  useEffect(() => {
    if (!value && starterCode && onChange) {
      onChange(starterCode);
    }
  }, [starterCode]);

  // Calculate line numbers
  useEffect(() => {
    const lines = (value || starterCode || '').split('\n').length;
    setLineCount(Math.max(lines, 10)); // Minimum 10 lines shown
  }, [value, starterCode]);

  // Sync scroll between textarea and line numbers
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Handle tab key to insert spaces instead of changing focus
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // Insert 4 spaces at cursor position
      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      
      if (onChange) {
        onChange(newValue);
      }
      
      // Move cursor after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 4;
      }, 0);
    }
    
    // Handle Enter to preserve indentation
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const currentLine = value.substring(0, start).split('\n').pop();
      const indentation = currentLine.match(/^\s*/)[0];
      
      // Check if we need to add extra indentation (after : in Python)
      let extraIndent = '';
      if (language === 'python' && currentLine.trimEnd().endsWith(':')) {
        extraIndent = '    ';
      }
      
      const newValue = value.substring(0, start) + '\n' + indentation + extraIndent + value.substring(textarea.selectionEnd);
      
      if (onChange) {
        onChange(newValue);
      }
      
      // Move cursor to the right position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1 + indentation.length + extraIndent.length;
      }, 0);
    }
  };

  const handleChange = (e) => {
    if (onChange && !disabled) {
      onChange(e.target.value);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.python;

  return (
    <div className="space-y-3">
      {/* Editor Container */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Code2 className="w-4 h-4 text-gray-400" />
            <span className={`text-xs px-2 py-0.5 rounded-full ${langConfig.bgColor} ${langConfig.color} font-medium`}>
              {langConfig.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyCode}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Copy code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Code Area with Line Numbers */}
        <div className="flex" style={{ minHeight: `${minHeight}px` }}>
          {/* Line Numbers */}
          <div
            ref={lineNumbersRef}
            className="select-none bg-gray-800/30 text-gray-500 text-right py-3 px-3 font-mono text-sm overflow-hidden"
            style={{ minWidth: '50px' }}
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            disabled={disabled}
            placeholder={placeholder}
            spellCheck={false}
            className={`
              flex-1 bg-transparent text-gray-100 font-mono text-sm p-3 
              resize-none focus:outline-none leading-6
              placeholder-gray-600
              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
            style={{
              minHeight: `${minHeight}px`,
              tabSize: 4,
            }}
          />
        </div>
      </div>

      {/* Test Cases Display */}
      {showTestCases && testCases && testCases.length > 0 && (
        <div className="bg-neural-dark rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-800">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Play className="w-4 h-4" />
              Test Cases
            </h4>
          </div>
          <div className="divide-y divide-gray-800">
            {testCases.map((testCase, idx) => (
              <div key={idx} className="p-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs">Input:</span>
                    <pre className="text-gray-300 mt-1 font-mono text-xs bg-gray-800/50 p-2 rounded overflow-x-auto">
                      {testCase.input}
                    </pre>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">Expected Output:</span>
                    <pre className="text-green-400 mt-1 font-mono text-xs bg-gray-800/50 p-2 rounded overflow-x-auto">
                      {testCase.expectedOutput}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeEditor;
