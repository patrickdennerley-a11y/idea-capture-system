/**
 * IDEA CAPTURE COMPONENT
 *
 * Purpose: Capture and organize spontaneous ideas with tags, context, and voice input.
 *          AI-powered organization groups ideas by theme with priority ranking.
 *          Drag-and-drop reordering with accelerated auto-scroll near top.
 *
 * Key Features:
 * - Voice input using Web Speech API
 * - Auto-save drafts after 3 seconds
 * - Tag filtering and search
 * - AI organization with Claude Sonnet 4.5
 * - Organization history with timestamps
 * - Drag-and-drop reordering (lines 225-309)
 * - Accelerated scrolling when dragging near top (100px zone)
 *
 * State Management:
 * - ideas[] - Stored in localStorage, newest first
 * - draggedItemId, dragOverItemId - Drag-and-drop tracking
 * - organizedData - AI organization results
 * - organizationHistory - Past organization sessions
 *
 * Key Functions:
 * - saveIdea() (97-123) - Save captured idea
 * - handleOrganizeIdeas() (175-205) - Trigger AI organization
 * - handleDragStart/Over/Drop() (225-309) - Drag-and-drop handlers
 * - Auto-scroll logic (240-269) - Accelerated scrolling near top edge
 *
 * Important Notes:
 * - Draggable cards use cursor-move
 * - Visual feedback: opacity 50% (dragging), scale 105% (drop target)
 * - Scroll speed scales with distance from top (max 30px/frame at 60fps)
 * - Ideas list at lines 462-515
 */

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Lightbulb, Tag, Mic, Save, Search, X, Copy, Check, Sparkles, Loader, AlertCircle, XCircle, History, ChevronLeft, ChevronRight, Clipboard, Settings, Upload } from 'lucide-react';
import { formatDateTime } from '../utils/dateUtils';
import { organizeIdeas } from '../utils/apiService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import IdeaEditModal from './IdeaEditModal';
// Temporarily disabled virtual scrolling - using regular rendering instead
// import { VariableSizeList as List } from 'react-window';

// 🔍 DIAGNOSTIC: Track render counts
let ideaCaptureRenderCount = 0;
let ideaCardRenderCount = 0;

// Memoized IdeaCard component to prevent re-renders during scroll
const IdeaCard = memo(({
  idea,
  draggedItemId,
  dragOverItemId,
  copiedIdeaId,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onCopy,
  onEdit,
  onDelete
}) => {
  // 🔍 DIAGNOSTIC: Count renders
  ideaCardRenderCount++;
  if (ideaCardRenderCount % 50 === 0) {
    console.log(`🔍 IdeaCard rendered ${ideaCardRenderCount} times total`);
  }

  return (
    <div
      key={idea.id}
      draggable={true}
      onDragStart={(e) => onDragStart(e, idea.id)}
      onDragOver={(e) => onDragOver(e, idea.id)}
      onDragEnd={onDragEnd}
      onDrop={(e) => onDrop(e, idea.id)}
      className={`bg-neural-darker border rounded-lg p-4 transition-all ${
        draggedItemId === idea.id
          ? 'opacity-50 border-neural-purple scale-95 cursor-move'
          : dragOverItemId === idea.id
          ? 'border-neural-purple border-2 scale-105 cursor-move'
          : 'border-gray-800 hover:border-neural-purple cursor-move'
      } animate-slide-in`}
      style={{
        contain: 'layout style paint' // Isolate rendering for better performance
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <p className="text-gray-100 mb-2">{idea.content}</p>

          {/* Classification Badge */}
          {idea.classificationType && idea.classificationType !== 'general' && (
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium mb-2 ${
              idea.classificationType === 'routine' ? 'bg-purple-950 text-purple-300 border border-purple-700' :
              idea.classificationType === 'checklist' ? 'bg-blue-950 text-blue-300 border border-blue-700' :
              idea.classificationType === 'timetable' ? 'bg-orange-950 text-orange-300 border border-orange-700' :
              'bg-gray-800 text-gray-300 border border-gray-700'
            }`}>
              {idea.classificationType.charAt(0).toUpperCase() + idea.classificationType.slice(1)}
              {idea.autoClassified && ' ✨'}
            </span>
          )}

          {/* Tags */}
          {idea.tags && idea.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {idea.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-neural-purple/20 text-neural-purple text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {idea.dueDate && (
            <p className="text-sm text-yellow-400 mb-1">
              📅 Due: {new Date(idea.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              {new Date(idea.dueDate) < new Date() && (
                <span className="text-red-400 ml-2">(Past due)</span>
              )}
            </p>
          )}
          {idea.context && (
            <p className="text-sm text-gray-500 italic">Context: {idea.context}</p>
          )}
          <p className="text-xs text-gray-600 mt-2">{formatDateTime(idea.timestamp)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onCopy(idea)}
            onMouseDown={(e) => e.stopPropagation()}
            className={`transition-colors ${
              copiedIdeaId === idea.id
                ? 'text-green-400'
                : 'text-gray-600 hover:text-blue-400'
            }`}
            title="Copy idea"
          >
            {copiedIdeaId === idea.id ? (
              <Check className="w-4 h-4" />
            ) : (
              <Clipboard className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => onEdit(idea)}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-gray-600 hover:text-neural-purple transition-colors"
            title="Edit idea"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(idea.id)}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-gray-600 hover:text-red-400 transition-colors"
            title="Delete idea"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function - return true if props are equal (skip re-render)
  // Check if idea content changed
  if (prevProps.idea.id !== nextProps.idea.id) return false;
  if (prevProps.idea.content !== nextProps.idea.content) return false;
  if (prevProps.idea.context !== nextProps.idea.context) return false;
  if (prevProps.idea.dueDate !== nextProps.idea.dueDate) return false;
  if (prevProps.idea.classificationType !== nextProps.idea.classificationType) return false;
  if (prevProps.idea.autoClassified !== nextProps.idea.autoClassified) return false;

  // Check drag state
  if (prevProps.draggedItemId !== nextProps.draggedItemId) return false;
  if (prevProps.dragOverItemId !== nextProps.dragOverItemId) return false;
  if (prevProps.copiedIdeaId !== nextProps.copiedIdeaId) return false;

  // Check tags array (deep comparison)
  const prevTags = prevProps.idea.tags || [];
  const nextTags = nextProps.idea.tags || [];
  if (prevTags.length !== nextTags.length) return false;
  for (let i = 0; i < prevTags.length; i++) {
    if (prevTags[i] !== nextTags[i]) return false;
  }

  // All callbacks are now wrapped with useCallback, so they should be stable references
  // React.memo will handle shallow comparison of callback props automatically

  return true; // Props are equal, skip re-render
});

const IDEA_TAGS = [
  'business',
  'study',
  'personal',
  'shower-thought',
  'productivity',
  'health',
  'social',
  'urgent',
  'someday-maybe'
];

export default function IdeaCapture({
  ideas,
  setIdeas,
  isOrganizing,
  setIsOrganizing,
  organizedData,
  setOrganizedData,
  organizationError,
  setOrganizationError,
  showOrganized,
  setShowOrganized,
}) {
  // 🔍 DIAGNOSTIC: Count main component renders
  ideaCaptureRenderCount++;
  console.log(`🔍 IdeaCapture rendered ${ideaCaptureRenderCount} times - Ideas count: ${ideas.length}`);

  const [currentIdea, setCurrentIdea] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState('');
  const [context, setContext] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const [copiedIdeaId, setCopiedIdeaId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [editingIdea, setEditingIdea] = useState(null);
  const [isAutoClassifying, setIsAutoClassifying] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState({ type: '', message: '' });

  // Pagination and grouping state
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [itemsPerGroup, setItemsPerGroup] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({
    tags: [],
    classifications: []
  });

  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  // History state
  const [organizationHistory, setOrganizationHistory] = useLocalStorage('neural-organization-history', []);
  const [showHistory, setShowHistory] = useState(false);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

  // Drag and drop state
  const [draggedItemId, setDraggedItemId] = useState(null);
  const [dragOverItemId, setDragOverItemId] = useState(null);
  const scrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Auto-focus textarea on load (minimal friction)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Setup voice recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
        setCurrentIdea(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-show organized data modal when results are ready
  // This handles the case where user switches tabs during generation
  useEffect(() => {
    if (organizedData && !showOrganized) {
      console.log('🔍 Auto-showing organized data modal (results ready after tab switch)');
      setShowOrganized(true);
    }
  }, [organizedData, showOrganized, setShowOrganized]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('Voice input not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const addCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim().toLowerCase())) {
      setSelectedTags(prev => [...prev, customTag.trim().toLowerCase()]);
      setCustomTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const saveIdea = async () => {
    if (!currentIdea.trim()) return;

    // Create idea with default classification
    const newIdea = {
      id: Date.now(),
      content: currentIdea.trim(),
      tags: selectedTags,
      context: context.trim(),
      dueDate: dueDate || null,
      timestamp: new Date().toISOString(),
      // Classification fields with defaults
      classificationType: 'general',
      duration: null,
      recurrence: 'none',
      timeOfDay: null,
      priority: 'medium',
      autoClassified: false,
      lastModified: new Date().toISOString()
    };

    setIdeas(prev => [newIdea, ...prev]);

    // Reset form
    setCurrentIdea('');
    setSelectedTags([]);
    setContext('');
    setDueDate('');

    // Show saved feedback
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);

    // Auto-classify in background (non-blocking)
    classifyIdeaInBackground(newIdea);

    // Refocus textarea for next idea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Auto-classify idea in background after save
  const classifyIdeaInBackground = async (idea) => {
    try {
      const response = await fetch('http://localhost:3001/api/classify-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: idea.content,
          context: idea.context,
          timestamp: idea.timestamp,
          currentTags: idea.tags
        })
      });

      if (response.ok) {
        const classification = await response.json();

        // Update idea with classification
        setIdeas(prev => prev.map(i =>
          i.id === idea.id
            ? {
                ...i,
                classificationType: classification.classificationType || 'general',
                duration: classification.duration,
                recurrence: classification.recurrence || 'none',
                timeOfDay: classification.timeOfDay,
                priority: classification.priority || 'medium',
                autoClassified: true
              }
            : i
        ));
      }
    } catch (error) {
      console.error('Background classification failed:', error);
      // Silent fail - user can manually classify later
    }
  };

  // Manual classification function for edit modal
  const classifyIdea = async (content, context, tags) => {
    try {
      const response = await fetch('http://localhost:3001/api/classify-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          context,
          timestamp: new Date().toISOString(),
          currentTags: tags
        })
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Classification failed:', error);
      return null;
    }
  };

  // Auto-save on typing (debounced)
  useEffect(() => {
    if (currentIdea.trim() && currentIdea.length > 10) {
      const timer = setTimeout(() => {
        const existingDraft = ideas.find(i => i.isDraft);
        if (existingDraft) {
          setIdeas(prev => prev.map(i =>
            i.isDraft ? { ...i, content: currentIdea, timestamp: new Date().toISOString() } : i
          ));
        } else {
          const draft = {
            id: Date.now(),
            content: currentIdea,
            tags: selectedTags,
            context: context,
            timestamp: new Date().toISOString(),
            isDraft: true,
          };
          setIdeas(prev => [draft, ...prev]);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentIdea]);

  const deleteIdea = useCallback((id) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  }, [setIdeas]);

  // Modal handlers
  const openEditModal = useCallback((idea) => {
    setEditingIdea(idea);
  }, []);

  const handleSaveFromModal = (updatedIdea) => {
    setIdeas(prev => prev.map(i =>
      i.id === updatedIdea.id ? updatedIdea : i
    ));
    setEditingIdea(null);
  };

  const handleDeleteFromModal = (ideaId) => {
    deleteIdea(ideaId);
    setEditingIdea(null);
  };

  const copyAllIdeas = async () => {
    if (filteredIdeas.length === 0) return;

    const formattedText = filteredIdeas.map(idea => {
      const title = idea.tags.length > 0 ? idea.tags.join(', ').toUpperCase() : 'UNTITLED IDEA';
      const timestamp = formatDateTime(idea.timestamp);
      const contextLine = idea.context ? `Context: ${idea.context}\n` : '';
      const dueDateLine = idea.dueDate ? `Due: ${new Date(idea.dueDate).toLocaleDateString()}\n` : '';

      return `${title}\n${timestamp}\n${contextLine}${dueDateLine}\n${idea.content}\n\n${'─'.repeat(50)}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(formattedText);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const copyIdea = useCallback(async (idea) => {
    const title = idea.tags.length > 0 ? idea.tags.join(', ').toUpperCase() : 'IDEA';
    const timestamp = formatDateTime(idea.timestamp);
    const contextLine = idea.context ? `Context: ${idea.context}\n` : '';
    const dueDateLine = idea.dueDate ? `Due: ${new Date(idea.dueDate).toLocaleDateString()}\n` : '';

    const formattedText = `${title}\n${timestamp}\n${contextLine}${dueDateLine}\n${idea.content}`;

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopiedIdeaId(idea.id);
      setTimeout(() => setCopiedIdeaId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  }, []);

  // Parse exported ideas text and convert back to idea objects
  const parseImportedIdeas = (text) => {
    const separator = '─'.repeat(50);
    const blocks = text.split(separator).map(block => block.trim()).filter(block => block);

    const parsedIdeas = [];

    for (const block of blocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);

      if (lines.length < 2) continue; // Need at least title and date

      // Parse title and tags
      const titleLine = lines[0];
      const tags = titleLine === 'UNTITLED IDEA'
        ? []
        : titleLine.split(',').map(tag => tag.trim().toLowerCase());

      // Parse date
      const dateLine = lines[1];

      // Parse optional context and due date
      let contextValue = '';
      let dueDateValue = '';
      let contentStartIndex = 2;

      for (let i = 2; i < lines.length; i++) {
        if (lines[i].startsWith('Context: ')) {
          contextValue = lines[i].substring(9);
          contentStartIndex = i + 1;
        } else if (lines[i].startsWith('Due: ')) {
          dueDateValue = lines[i].substring(5);
          contentStartIndex = i + 1;
        } else {
          break;
        }
      }

      // Rest is content
      const content = lines.slice(contentStartIndex).join('\n');

      if (!content) continue; // Skip if no content

      // Create idea object
      const idea = {
        id: Date.now() + Math.random(), // Unique ID
        content: content,
        tags: tags,
        context: contextValue,
        dueDate: dueDateValue ? new Date(dueDateValue).toISOString().split('T')[0] : '',
        timestamp: new Date().toISOString(), // Use current time for imported ideas
      };

      parsedIdeas.push(idea);
    }

    return parsedIdeas;
  };

  const handleImportIdeas = () => {
    setImportStatus({ type: '', message: '' });

    if (!importText.trim()) {
      setImportStatus({ type: 'error', message: 'Please paste exported ideas text' });
      return;
    }

    try {
      const parsedIdeas = parseImportedIdeas(importText);

      if (parsedIdeas.length === 0) {
        setImportStatus({ type: 'error', message: 'No valid ideas found in the text. Please check the format.' });
        return;
      }

      // Add imported ideas to the beginning of the list (newest first)
      setIdeas(prev => [...parsedIdeas, ...prev]);

      setImportStatus({
        type: 'success',
        message: `Successfully imported ${parsedIdeas.length} idea${parsedIdeas.length !== 1 ? 's' : ''}!`
      });

      // Clear and close after success
      setTimeout(() => {
        setImportText('');
        setShowImportModal(false);
        setImportStatus({ type: '', message: '' });
      }, 2000);

    } catch (err) {
      console.error('Import error:', err);
      setImportStatus({ type: 'error', message: 'Failed to parse ideas. Please check the format.' });
    }
  };

  const handleOrganizeIdeas = async () => {
    if (filteredIdeas.length === 0) return;

    setIsOrganizing(true);
    setOrganizationError(null);

    try {
      const result = await organizeIdeas(filteredIdeas);

      if (result.success) {
        const historyEntry = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          data: result.data,
          ideaCount: filteredIdeas.length,
        };

        // Save to history (newest first)
        setOrganizationHistory(prev => [historyEntry, ...prev]);

        setOrganizedData(result.data);
        setShowOrganized(true);
      } else {
        setOrganizationError(result.error);
      }
    } catch (error) {
      setOrganizationError('Unexpected error occurred. Please try again.');
    } finally {
      setIsOrganizing(false);
    }
  };

  const viewHistoryEntry = (index) => {
    const entry = organizationHistory[index];
    setOrganizedData(entry.data);
    setCurrentHistoryIndex(index);
    setShowHistory(false);
    setShowOrganized(true);
  };

  const deleteHistoryEntry = (id) => {
    setOrganizationHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const handleCloseOrganizedModal = () => {
    setShowOrganized(false);
    // Clear the data so modal doesn't auto-show again when returning to tab
    setOrganizedData(null);
  };

  // 🔍 DIAGNOSTIC: Track drag events
  const dragEventCount = useRef({ start: 0, over: 0, end: 0, drop: 0 });

  // Drag and drop handlers (wrapped with useCallback to prevent re-creating on every render)
  const handleDragStart = useCallback((e, ideaId) => {
    dragEventCount.current.start++;
    console.log('🔍 Drag events:', dragEventCount.current);
    setDraggedItemId(ideaId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  }, []);

  const handleDragOver = useCallback((e, ideaId) => {
    dragEventCount.current.over++;
    if (dragEventCount.current.over % 100 === 0) {
      console.log('🔍 DragOver called 100 times, total:', dragEventCount.current);
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (draggedItemId !== ideaId) {
      setDragOverItemId(ideaId);
    }

    // Accelerated scrolling when near the top
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const rect = container.getBoundingClientRect();
      const mouseY = e.clientY - rect.top;
      const scrollZone = 100; // pixels from top to trigger scroll

      // Cancel any existing scroll animation
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      if (mouseY < scrollZone && mouseY > 0) {
        // Near the top - scroll up with acceleration
        const distanceFromTop = scrollZone - mouseY;
        const scrollSpeed = Math.min(30, (distanceFromTop / scrollZone) * 30); // Max 30px per frame

        // Use requestAnimationFrame for smoother scrolling (no memory leaks)
        const scroll = () => {
          if (container.scrollTop > 0) {
            container.scrollTop -= scrollSpeed;
            scrollIntervalRef.current = requestAnimationFrame(scroll);
          } else {
            scrollIntervalRef.current = null;
          }
        };
        scrollIntervalRef.current = requestAnimationFrame(scroll);
      }
    }
  }, [draggedItemId]);

  const handleDragEnd = useCallback(() => {
    dragEventCount.current.end++;
    console.log('🔍 DragEnd called, total:', dragEventCount.current);
    setDraggedItemId(null);
    setDragOverItemId(null);

    // Cancel scroll animation
    if (scrollIntervalRef.current) {
      cancelAnimationFrame(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  const handleDrop = useCallback((e, targetIdeaId) => {
    dragEventCount.current.drop++;
    console.log('🔍 Drop called, total:', dragEventCount.current);
    e.preventDefault();

    if (draggedItemId === null || draggedItemId === targetIdeaId) {
      handleDragEnd();
      return;
    }

    // Reorder the ideas array
    setIdeas(prevIdeas => {
      const newIdeas = [...prevIdeas];
      const draggedIndex = newIdeas.findIndex(idea => idea.id === draggedItemId);
      const targetIndex = newIdeas.findIndex(idea => idea.id === targetIdeaId);

      if (draggedIndex === -1 || targetIndex === -1) return prevIdeas;

      // Remove the dragged item
      const [draggedItem] = newIdeas.splice(draggedIndex, 1);

      // Insert at the target position
      newIdeas.splice(targetIndex, 0, draggedItem);

      return newIdeas;
    });

    handleDragEnd();
  }, [draggedItemId, handleDragEnd, setIdeas]);

  // Cleanup scroll interval on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // 🔍 DIAGNOSTIC: Log memory and performance info on every render
  useEffect(() => {
    if (performance.memory) {
      console.log('🔍 Memory usage:', {
        usedJSHeapSize: `${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`,
        totalJSHeapSize: `${(performance.memory.totalJSHeapSize / 1048576).toFixed(2)} MB`,
        jsHeapSizeLimit: `${(performance.memory.jsHeapSizeLimit / 1048576).toFixed(2)} MB`,
      });
    }
  });

  // Memoize filtered ideas with enhanced filtering
  const filteredIdeas = useMemo(() => {
    console.log('🔍 filteredIdeas recalculating...', {
      totalIdeas: ideas.length,
      searchTerm,
      tagFilters: selectedFilters.tags.length,
      classificationFilters: selectedFilters.classifications.length
    });
    let filtered = ideas.filter(idea => !idea.isDraft);

    // Search filter (content, tags, context)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(idea =>
        idea.content.toLowerCase().includes(search) ||
        idea.tags?.some(tag => tag.toLowerCase().includes(search)) ||
        (idea.context && idea.context.toLowerCase().includes(search))
      );
    }

    // Category filters with OR logic (match ANY selected tag OR classification)
    if (selectedFilters.tags.length > 0 || selectedFilters.classifications.length > 0) {
      filtered = filtered.filter(idea => {
        const matchesTag = selectedFilters.tags.length === 0 ||
          selectedFilters.tags.some(filterTag => idea.tags?.includes(filterTag));

        const matchesClassification = selectedFilters.classifications.length === 0 ||
          selectedFilters.classifications.includes(idea.classificationType || 'general');

        // Show if matches ANY selected filter (OR logic)
        return matchesTag || matchesClassification;
      });
    }

    return filtered;
  }, [ideas, searchTerm, selectedFilters]);

  // Group ideas by date with pagination
  const groupedIdeas = useMemo(() => {
    console.log('🔍 groupedIdeas recalculating...', { filteredCount: filteredIdeas.length });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: []
    };

    filteredIdeas.forEach(idea => {
      const ideaDate = new Date(idea.timestamp);
      ideaDate.setHours(0, 0, 0, 0);

      if (ideaDate.getTime() === today.getTime()) {
        groups.today.push(idea);
      } else if (ideaDate.getTime() === yesterday.getTime()) {
        groups.yesterday.push(idea);
      } else if (ideaDate > weekAgo) {
        groups.thisWeek.push(idea);
      } else if (ideaDate > monthAgo) {
        groups.thisMonth.push(idea);
      } else {
        groups.older.push(idea);
      }
    });

    return groups;
  }, [filteredIdeas]);

  // Create a flattened list for virtual scrolling
  const virtualListData = useMemo(() => {
    console.log('🔍 virtualListData recalculating...');
    const rows = [];
    const groupConfigs = [
      { key: 'today', label: '📋 TODAY', icon: '📋', color: 'text-neural-purple' },
      { key: 'yesterday', label: '📅 YESTERDAY', icon: '📅', color: 'text-gray-300' },
      { key: 'thisWeek', label: '📆 THIS WEEK', icon: '📆', color: 'text-gray-300' },
      { key: 'thisMonth', label: '📅 THIS MONTH', icon: '📅', color: 'text-gray-400' },
      { key: 'older', label: '📂 OLDER', icon: '📂', color: 'text-gray-500' }
    ];

    groupConfigs.forEach(({ key, label, color }) => {
      const groupItems = groupedIdeas[key];
      if (groupItems.length === 0) return;

      // Add group header
      rows.push({
        type: 'header',
        groupKey: key,
        label,
        color,
        count: groupItems.length,
        collapsed: collapsedGroups[key]
      });

      // Add visible items if not collapsed
      if (!collapsedGroups[key]) {
        const visibleCount = itemsPerGroup[key] || 20;
        const visibleItems = groupItems.slice(0, visibleCount);
        visibleItems.forEach(idea => {
          rows.push({
            type: 'idea',
            idea,
            groupKey: key
          });
        });

        // Add "Load More" button if there are more items
        if (groupItems.length > visibleCount) {
          rows.push({
            type: 'loadMore',
            groupKey: key,
            remainingCount: groupItems.length - visibleCount
          });
        }
      }
    });

    return rows;
  }, [groupedIdeas, collapsedGroups, itemsPerGroup]);

  // Load more items in a group
  const loadMore = useCallback((groupKey) => {
    setItemsPerGroup(prev => ({
      ...prev,
      [groupKey]: (prev[groupKey] || 20) + 20
    }));
  }, []);

  // Toggle group collapse
  const toggleGroup = useCallback((groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedFilters({ tags: [], classifications: [] });
    setSearchTerm('');
  }, []);

  // Toggle filter
  const toggleFilter = useCallback((type, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + K to focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get row size for virtual list (different heights for headers vs idea cards)
  const getItemSize = useCallback((index) => {
    const row = virtualListData[index];
    if (!row) return 50;

    if (row.type === 'header') return 48; // Header height
    if (row.type === 'loadMore') return 48; // Load more button height
    if (row.type === 'idea') return 160; // Approximate idea card height
    return 50;
  }, [virtualListData]);

  // Row renderer for virtual list
  const Row = useCallback(({ index, style }) => {
    const row = virtualListData[index];
    if (!row) return null;

    // Header row
    if (row.type === 'header') {
      return (
        <div style={style} className="px-3">
          <button
            onClick={() => toggleGroup(row.groupKey)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-800/50 rounded transition-colors"
          >
            <span className={`text-sm font-semibold ${row.color}`}>
              {row.label} ({row.count})
            </span>
            <span className="text-xs text-gray-500">
              {row.collapsed ? '▶' : '▼'}
            </span>
          </button>
        </div>
      );
    }

    // Load More row
    if (row.type === 'loadMore') {
      return (
        <div style={style} className="px-3">
          <button
            onClick={() => loadMore(row.groupKey)}
            className="w-full py-2 text-sm text-neural-purple hover:text-neural-pink transition-colors"
          >
            Load {Math.min(20, row.remainingCount)} more...
          </button>
        </div>
      );
    }

    // Idea card row
    if (row.type === 'idea') {
      return (
        <div style={style} className="px-3 py-1.5">
          <IdeaCard
            idea={row.idea}
            draggedItemId={draggedItemId}
            dragOverItemId={dragOverItemId}
            copiedIdeaId={copiedIdeaId}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onCopy={copyIdea}
            onEdit={openEditModal}
            onDelete={deleteIdea}
          />
        </div>
      );
    }

    return null;
  }, [virtualListData, draggedItemId, dragOverItemId, copiedIdeaId, toggleGroup, loadMore, handleDragStart, handleDragOver, handleDragEnd, handleDrop, copyIdea, openEditModal, deleteIdea]);

  return (
    <div className="space-y-6">
      {/* Main Capture Area */}
      <div className="neural-card pulse-glow">
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <h2 className="text-2xl font-bold">Capture Your Thought</h2>
          {showSaved && (
            <span className="text-green-400 text-sm animate-slide-in flex items-center gap-1">
              <Save className="w-4 h-4" />
              Saved!
            </span>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={currentIdea}
          onChange={(e) => setCurrentIdea(e.target.value)}
          placeholder="Your shower thought, brilliant idea, or random insight... (100wpm typing speed - go fast!)"
          className="neural-textarea text-lg min-h-[150px] mb-4"
          onKeyDown={(e) => {
            if (e.metaKey && e.key === 'Enter') {
              saveIdea();
            }
          }}
        />

        {/* Tags */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Tags (click to select):</span>
          </div>

          {/* Predefined Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {IDEA_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
                  selectedTags.includes(tag)
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Selected Tags (with remove option) */}
          {selectedTags.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-2">Selected:</div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-neural-purple text-white rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Custom Tag Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
              placeholder="Add custom tag..."
              className="neural-input text-sm flex-1"
            />
            <button
              onClick={addCustomTag}
              disabled={!customTag.trim()}
              className="neural-button-secondary px-4 text-sm disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {/* Context (optional) */}
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Optional context (e.g., 'in the shower', 'during walk', 'after studying geometry')"
          className="neural-input text-sm mb-4"
        />

        {/* Due Date (optional) */}
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">
            Due Date (optional) - Leave empty for ongoing/recurring ideas
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="neural-input text-sm"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={saveIdea}
            disabled={!currentIdea.trim()}
            className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 inline mr-2" />
            Save Idea (⌘+Enter)
          </button>
          <button
            onClick={toggleVoiceInput}
            className={`neural-button-secondary ${isListening ? 'bg-red-600 hover:bg-red-700' : ''}`}
          >
            <Mic className={`w-4 h-4 ${isListening ? 'animate-pulse' : ''}`} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Auto-saves draft after 3 seconds • Press ⌘/Ctrl+K to focus • Voice input available
        </p>
      </div>

      {/* Saved Ideas List */}
      <div className="neural-card">
        {/* Header and Search */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-neural-purple" />
              Captured Ideas ({filteredIdeas.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="neural-button-secondary flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              {filteredIdeas.length > 0 && (
                <button
                  onClick={copyAllIdeas}
                  className="neural-button-secondary flex items-center gap-2"
                >
                  {showCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Export
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ideas, tags, or context..."
              className="neural-input pl-10 py-2 text-sm w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500">Quick filters:</span>

            {/* Tag Filters */}
            {['urgent', 'work', 'personal', 'study'].map(tag => (
              <button
                key={tag}
                onClick={() => toggleFilter('tags', tag)}
                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedFilters.tags.includes(tag)
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}

            {/* Classification Filters */}
            {[
              { value: 'routine', label: '🔁 Routine' },
              { value: 'checklist', label: '✓ Checklist' },
              { value: 'timetable', label: '📅 Event' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => toggleFilter('classifications', value)}
                className={`px-2 py-1 rounded-full text-xs transition-colors ${
                  selectedFilters.classifications.includes(value)
                    ? 'bg-neural-purple text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Clear Filters */}
            {(searchTerm || selectedFilters.tags.length > 0 || selectedFilters.classifications.length > 0) && (
              <button
                onClick={clearFilters}
                className="text-xs text-neural-purple hover:text-neural-pink transition-colors ml-2"
              >
                ✕ Clear all
              </button>
            )}
          </div>
        </div>

        {/* Ideas List (virtual scrolling temporarily disabled) */}
        {filteredIdeas.length === 0 ? (
          <div className="max-h-96 flex items-center justify-center py-8">
            <p className="text-gray-500 text-center">
              {searchTerm ? 'No ideas match your search' : 'No ideas captured yet. Start typing above!'}
            </p>
          </div>
        ) : (
          <div ref={scrollContainerRef} className="max-h-96 overflow-y-auto neural-scrollbar">
            {virtualListData.map((row, index) => (
              <Row key={index} index={index} style={{}} />
            ))}
          </div>
        )}

        {filteredIdeas.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
            {/* Filter info badge */}
            {(searchTerm || selectedFilters.tags.length > 0 || selectedFilters.classifications.length > 0) && (
              <div className="bg-neural-purple/10 border border-neural-purple/30 rounded-lg p-2 text-xs text-gray-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-neural-purple" />
                <span>
                  AI will organize {filteredIdeas.length} filtered {filteredIdeas.length === 1 ? 'idea' : 'ideas'}
                  {ideas.filter(i => !i.isDraft).length !== filteredIdeas.length &&
                    ` (${ideas.filter(i => !i.isDraft).length - filteredIdeas.length} hidden by filters)`}
                </span>
              </div>
            )}

            {/* AI Organize and History Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleOrganizeIdeas}
                disabled={isOrganizing}
                className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isOrganizing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Organizing {filteredIdeas.length} {filteredIdeas.length === 1 ? 'idea' : 'ideas'}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    AI Organize {filteredIdeas.length} {filteredIdeas.length === 1 ? 'Idea' : 'Ideas'}
                  </>
                )}
              </button>

              {organizationHistory.length > 0 && (
                <button
                  onClick={() => setShowHistory(true)}
                  className="neural-button-secondary flex items-center gap-2 whitespace-nowrap"
                >
                  <History className="w-4 h-4" />
                  View History ({organizationHistory.length})
                </button>
              )}
            </div>

            {/* Error Display */}
            {organizationError && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-400 text-sm font-medium">Connection Error</p>
                  <p className="text-red-300 text-xs mt-1">{organizationError}</p>
                  <p className="text-gray-400 text-xs mt-2">
                    Make sure your backend server is running on http://localhost:3001
                  </p>
                </div>
                <button
                  onClick={() => setOrganizationError(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">
              AI will group by theme, rank by priority, and suggest execution order
            </p>
          </div>
        )}
      </div>

      {/* AI Organized Results Modal */}
      {showOrganized && organizedData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neural-dark border border-neural-purple rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-neural-dark border-b border-gray-800 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-neural-purple" />
                <h2 className="text-2xl font-bold">AI Organized Ideas</h2>
              </div>
              <button
                onClick={handleCloseOrganizedModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Summary */}
              {organizedData.summary && (
                <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-neural-purple mb-2">Summary</h3>
                  <p className="text-gray-300">{organizedData.summary}</p>
                </div>
              )}

              {/* Themes */}
              {organizedData.themes && organizedData.themes.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Ideas by Theme</h3>
                  <div className="space-y-4">
                    {organizedData.themes.map((theme, index) => (
                      <div
                        key={index}
                        className="bg-neural-darker border border-gray-800 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-lg font-semibold text-neural-purple">
                            {theme.name}
                          </h4>
                          {theme.priority && (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              theme.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                              theme.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {theme.priority.toUpperCase()} PRIORITY
                            </span>
                          )}
                        </div>
                        {theme.description && (
                          <p className="text-gray-400 text-sm mb-3">{theme.description}</p>
                        )}
                        {theme.ideas && theme.ideas.length > 0 && (
                          <div className="space-y-2">
                            {theme.ideas.map((idea, ideaIndex) => (
                              <div
                                key={ideaIndex}
                                className="bg-neural-dark border border-gray-700 rounded p-3"
                              >
                                <p className="text-gray-200">{idea.content || idea}</p>
                                {idea.tags && idea.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {idea.tags.map(tag => (
                                      <span
                                        key={tag}
                                        className="px-2 py-0.5 bg-neural-purple/20 text-neural-purple text-xs rounded-full"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {organizedData.nextSteps && organizedData.nextSteps.length > 0 && (
                <div className="bg-gradient-to-r from-neural-purple/10 to-neural-blue/10 border border-neural-purple/50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-neural-purple mb-3">
                    Suggested Next Steps
                  </h3>
                  <ol className="space-y-2 list-decimal list-inside">
                    {organizedData.nextSteps.map((step, index) => (
                      <li key={index} className="text-gray-300">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neural-dark border-t border-gray-800 p-4 flex justify-end">
              <button
                onClick={handleCloseOrganizedModal}
                className="neural-button-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neural-dark border border-neural-purple rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-neural-dark border-b border-gray-800 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-neural-purple" />
                <h2 className="text-2xl font-bold">Organization History</h2>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* History List */}
            <div className="p-6 space-y-3">
              {organizationHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No history yet. Organize your ideas to see them here!
                </p>
              ) : (
                organizationHistory.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="bg-neural-darker border border-gray-800 hover:border-neural-purple rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-neural-purple">
                            {formatDateTime(entry.timestamp)}
                          </span>
                          <span className="text-xs text-gray-500">
                            • {entry.ideaCount} ideas
                          </span>
                        </div>
                        {entry.data.summary && (
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {entry.data.summary}
                          </p>
                        )}
                        {entry.data.themes && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {entry.data.themes.slice(0, 3).map((theme, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-1 bg-neural-purple/20 text-neural-purple rounded"
                              >
                                {theme.name}
                              </span>
                            ))}
                            {entry.data.themes.length > 3 && (
                              <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded">
                                +{entry.data.themes.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => viewHistoryEntry(index)}
                          className="neural-button-secondary text-sm px-3 py-1"
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteHistoryEntry(entry.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-neural-dark border-t border-gray-800 p-4 flex justify-between items-center">
              <span className="text-sm text-gray-400">
                {organizationHistory.length} {organizationHistory.length === 1 ? 'entry' : 'entries'} saved
              </span>
              <button
                onClick={() => setShowHistory(false)}
                className="neural-button-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-neural-dark border border-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-neural-dark border-b border-gray-800 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Upload className="w-6 h-6 text-neural-purple" />
                    Import Ideas
                  </h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Paste your exported ideas text below to restore them
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportText('');
                    setImportStatus({ type: '', message: '' });
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Instructions */}
              <div className="bg-neural-darker border border-gray-800 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neural-purple" />
                  How to Import
                </h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Click the "Export" button to copy all your ideas</li>
                  <li>• Paste the exported text in the textarea below</li>
                  <li>• Click "Import Ideas" to restore them</li>
                  <li>• Ideas will be added to your existing collection</li>
                </ul>
              </div>

              {/* Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Exported Ideas Text *
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your exported ideas here..."
                  className="w-full h-64 bg-neural-darker border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-neural-purple resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Expected format: Each idea should be separated by a line of dashes (────)
                </p>
              </div>

              {/* Status Message */}
              {importStatus.message && (
                <div className={`rounded-lg p-4 border ${
                  importStatus.type === 'success'
                    ? 'bg-green-500/10 border-green-500/50 text-green-400'
                    : 'bg-red-500/10 border-red-500/50 text-red-400'
                }`}>
                  <div className="flex items-start gap-2">
                    {importStatus.type === 'success' ? (
                      <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{importStatus.message}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleImportIdeas}
                  disabled={!importText.trim()}
                  className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4 inline mr-2" />
                  Import Ideas
                </button>
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportText('');
                    setImportStatus({ type: '', message: '' });
                  }}
                  className="neural-button-secondary px-6"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingIdea && (
        <IdeaEditModal
          idea={editingIdea}
          onSave={handleSaveFromModal}
          onDelete={handleDeleteFromModal}
          onClose={() => setEditingIdea(null)}
          onClassify={classifyIdea}
        />
      )}
    </div>
  );
}
