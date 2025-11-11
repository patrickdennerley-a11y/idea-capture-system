import { useState, useEffect } from 'react';
import { X, Save, Trash2, Sparkles, Loader } from 'lucide-react';

const CLASSIFICATION_TYPES = [
  { value: 'general', label: 'General Idea', description: 'Default - not used for automated planning' },
  { value: 'routine', label: 'Routine Activity', description: 'Recurring patterns for daily routine generation' },
  { value: 'checklist', label: 'Checklist Item', description: 'One-time tasks for daily checklist' },
  { value: 'timetable', label: 'Timetable Event', description: 'Specific date/time events' }
];

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

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

const TIME_OF_DAY_OPTIONS = [
  { value: null, label: 'Any time' },
  { value: 'morning', label: 'Morning (6am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-5pm)' },
  { value: 'evening', label: 'Evening (5pm-9pm)' },
  { value: 'night', label: 'Night (9pm-6am)' }
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'high', label: 'High Priority' }
];

const IdeaEditModal = ({ idea, onSave, onDelete, onClose, onClassify }) => {
  const [editedIdea, setEditedIdea] = useState({
    content: idea.content || '',
    tags: idea.tags || [],
    context: idea.context || '',
    dueDate: idea.dueDate || '',
    classificationType: idea.classificationType || 'general',
    duration: idea.duration || null,
    recurrence: idea.recurrence || 'none',
    timeOfDay: idea.timeOfDay || null,
    priority: idea.priority || 'medium',
    autoClassified: idea.autoClassified || false
  });

  const [customTag, setCustomTag] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);

  const handleAutoClassify = async () => {
    setIsClassifying(true);
    try {
      const result = await onClassify(editedIdea.content, editedIdea.context, editedIdea.tags);
      if (result) {
        setEditedIdea(prev => ({
          ...prev,
          classificationType: result.classificationType || prev.classificationType,
          duration: result.duration || prev.duration,
          recurrence: result.recurrence || prev.recurrence,
          timeOfDay: result.timeOfDay || prev.timeOfDay,
          priority: result.priority || prev.priority,
          autoClassified: true
        }));
      }
    } catch (error) {
      console.error('Auto-classification failed:', error);
    } finally {
      setIsClassifying(false);
    }
  };

  const toggleTag = (tag) => {
    setEditedIdea(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const addCustomTag = () => {
    if (customTag.trim() && !editedIdea.tags.includes(customTag.trim().toLowerCase())) {
      setEditedIdea(prev => ({
        ...prev,
        tags: [...prev.tags, customTag.trim().toLowerCase()]
      }));
      setCustomTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setEditedIdea(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove)
    }));
  };

  const handleSave = () => {
    if (!editedIdea.content.trim()) {
      alert('Idea content cannot be empty');
      return;
    }

    const updatedIdea = {
      ...idea,
      ...editedIdea,
      lastModified: new Date().toISOString()
    };

    onSave(updatedIdea);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this idea? This cannot be undone.')) {
      onDelete(idea.id);
    }
  };

  const getClassificationColor = (type) => {
    switch (type) {
      case 'routine': return 'bg-purple-950 border-purple-700 text-purple-300';
      case 'checklist': return 'bg-blue-950 border-blue-700 text-blue-300';
      case 'timetable': return 'bg-orange-950 border-orange-700 text-orange-300';
      default: return 'bg-gray-800 border-gray-700 text-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="neural-card max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
          <h2 className="text-2xl font-bold">Edit Idea</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}>
        <div className="space-y-6">
          {/* Idea Content */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Idea Content
            </label>
            <textarea
              value={editedIdea.content}
              onChange={(e) => setEditedIdea(prev => ({ ...prev, content: e.target.value }))}
              className="neural-input min-h-[100px]"
              placeholder="What's your idea?"
            />
          </div>

          {/* Classification Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Classification Type
              <button
                type="button"
                onClick={handleAutoClassify}
                disabled={isClassifying}
                className="ml-3 text-xs neural-button-secondary py-1 px-2"
              >
                {isClassifying ? (
                  <>
                    <Loader className="w-3 h-3 animate-spin inline mr-1" />
                    Classifying...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 inline mr-1" />
                    Auto-Classify
                  </>
                )}
              </button>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {CLASSIFICATION_TYPES.map(type => (
                <button
                  type="button"
                  key={type.value}
                  onClick={() => setEditedIdea(prev => ({
                    ...prev,
                    classificationType: type.value,
                    autoClassified: false
                  }))}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    editedIdea.classificationType === type.value
                      ? getClassificationColor(type.value)
                      : 'bg-neural-darker border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <div className="font-semibold text-sm">{type.label}</div>
                  <div className="text-xs opacity-80 mt-1">{type.description}</div>
                </button>
              ))}
            </div>
            {editedIdea.autoClassified && (
              <p className="text-xs text-neural-purple mt-2">
                ✨ Auto-classified by AI
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-2">Tags</label>

            {/* Predefined Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {IDEA_TAGS.map(tag => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    editedIdea.tags.includes(tag)
                      ? 'bg-neural-purple text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

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
                className="neural-input flex-1 text-sm"
              />
              <button
                type="button"
                onClick={addCustomTag}
                className="neural-button-secondary px-4 text-sm"
              >
                Add
              </button>
            </div>

            {/* Selected Tags */}
            {editedIdea.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {editedIdea.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-neural-purple rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Context (optional)
            </label>
            <textarea
              value={editedIdea.context}
              onChange={(e) => setEditedIdea(prev => ({ ...prev, context: e.target.value }))}
              className="neural-input min-h-[60px]"
              placeholder="Additional context or notes..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Due Date (optional)
            </label>
            <input
              type="date"
              value={editedIdea.dueDate}
              onChange={(e) => setEditedIdea(prev => ({ ...prev, dueDate: e.target.value }))}
              className="neural-input"
            />
            {editedIdea.dueDate && (
              <button
                type="button"
                onClick={() => setEditedIdea(prev => ({ ...prev, dueDate: '' }))}
                className="text-xs text-gray-500 hover:text-gray-300 mt-1"
              >
                Clear date
              </button>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={editedIdea.duration || ''}
              onChange={(e) => setEditedIdea(prev => ({
                ...prev,
                duration: e.target.value ? parseInt(e.target.value) : null
              }))}
              className="neural-input"
              placeholder="e.g., 30"
              min="1"
            />
          </div>

          {/* Recurrence (shown for routine type) */}
          {editedIdea.classificationType === 'routine' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Recurrence Pattern
              </label>
              <select
                value={editedIdea.recurrence}
                onChange={(e) => setEditedIdea(prev => ({ ...prev, recurrence: e.target.value }))}
                className="neural-input pr-10"
              >
                {RECURRENCE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time of Day */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Preferred Time of Day
            </label>
            <select
              value={editedIdea.timeOfDay || ''}
              onChange={(e) => setEditedIdea(prev => ({
                ...prev,
                timeOfDay: e.target.value || null
              }))}
              className="neural-input pr-10"
            >
              {TIME_OF_DAY_OPTIONS.map(option => (
                <option key={option.label} value={option.value || ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Priority Level
            </label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(option => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => setEditedIdea(prev => ({ ...prev, priority: option.value }))}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                    editedIdea.priority === option.value
                      ? option.value === 'high'
                        ? 'bg-red-950 border-red-700 text-red-300'
                        : option.value === 'medium'
                        ? 'bg-yellow-950 border-yellow-700 text-yellow-300'
                        : 'bg-gray-800 border-gray-600 text-gray-300'
                      : 'bg-neural-darker border-gray-800 text-gray-500 hover:border-gray-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-800">
          <button
            type="button"
            onClick={handleDelete}
            className="neural-button-secondary text-red-400 hover:bg-red-950 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="neural-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editedIdea.content.trim()}
              className="neural-button flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
        </form>
      </div>
    </div>
  );
};

export default IdeaEditModal;
