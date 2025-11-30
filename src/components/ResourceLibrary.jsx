import { useState, useEffect, useMemo } from 'react';
import { 
  FolderOpen, 
  FileText, 
  Loader2, 
  Star, 
  Trash2, 
  Search, 
  Filter,
  Clock,
  Eye,
  AlertCircle,
  X,
  Layers
} from 'lucide-react';
import { 
  getAllResources, 
  getResourceStats, 
  toggleFavorite, 
  deleteResource 
} from '../utils/resourceService';

// Resource type configurations
const RESOURCE_TYPES = {
  cheatsheet: { 
    icon: '📄', 
    label: 'Cheat Sheet', 
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30'
  },
  flashcard_deck: { 
    icon: '🃏', 
    label: 'Flashcards', 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30'
  },
  mindmap: { 
    icon: '🗺️', 
    label: 'Mind Map', 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30'
  },
};

// Helper to format relative time
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 30) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

function ResourceLibrary({ onOpenCheatSheet, onOpenFlashcards }) {
  // State
  const [resources, setResources] = useState([]);
  const [stats, setStats] = useState({ cheatsheets: 0, flashcard_decks: 0, mindmaps: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState({ type: 'all', favoriteOnly: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Load resources
  const loadResources = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [resourcesResult, statsResult] = await Promise.all([
        getAllResources(),
        getResourceStats(),
      ]);
      
      if (resourcesResult.success) {
        setResources(resourcesResult.data);
      } else {
        setError('Failed to load resources');
      }
      
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (err) {
      console.error('Error loading resources:', err);
      setError('Failed to load resources. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, []);

  // Filter resources
  const filteredResources = useMemo(() => {
    let result = [...resources];
    
    // Filter by type
    if (filter.type !== 'all') {
      result = result.filter(r => r.resourceType === filter.type);
    }
    
    // Filter by favorites
    if (filter.favoriteOnly) {
      result = result.filter(r => r.isFavorite);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.topic.toLowerCase().includes(query) ||
        r.subject.toLowerCase().includes(query) ||
        r.title.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [resources, filter, searchQuery]);

  // Handle favorite toggle
  const handleToggleFavorite = async (resourceId, e) => {
    e.stopPropagation();
    
    // Optimistic update
    setResources(prev => prev.map(r => 
      r.id === resourceId ? { ...r, isFavorite: !r.isFavorite } : r
    ));
    
    const result = await toggleFavorite(resourceId);
    
    if (!result.success) {
      // Revert on failure
      setResources(prev => prev.map(r => 
        r.id === resourceId ? { ...r, isFavorite: !r.isFavorite } : r
      ));
    }
  };

  // Handle delete
  const handleDelete = async (resourceId) => {
    const result = await deleteResource(resourceId);
    
    if (result.success) {
      setResources(prev => prev.filter(r => r.id !== resourceId));
      // Update stats
      const deletedResource = resources.find(r => r.id === resourceId);
      if (deletedResource) {
        setStats(prev => ({
          ...prev,
          [deletedResource.resourceType === 'cheatsheet' ? 'cheatsheets' : 
           deletedResource.resourceType === 'flashcard_deck' ? 'flashcard_decks' : 'mindmaps']: 
            Math.max(0, prev[deletedResource.resourceType === 'cheatsheet' ? 'cheatsheets' : 
              deletedResource.resourceType === 'flashcard_deck' ? 'flashcard_decks' : 'mindmaps'] - 1)
        }));
      }
    }
    
    setDeleteConfirm(null);
  };

  // Handle resource click
  const handleResourceClick = (resource) => {
    if (resource.resourceType === 'cheatsheet' && onOpenCheatSheet) {
      onOpenCheatSheet(resource.subject, resource.topic);
    } else if (resource.resourceType === 'flashcard_deck' && onOpenFlashcards) {
      onOpenFlashcards(resource.subject, resource.topic);
    }
    // Mind maps not yet implemented
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 text-neural-purple animate-spin mb-4" />
        <p className="text-gray-400">Loading your library...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 font-medium mb-2">Failed to load library</p>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <button
          onClick={loadResources}
          className="px-4 py-2 bg-neural-purple text-white rounded-lg hover:bg-neural-purple/80 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const totalResources = stats.cheatsheets + stats.flashcard_decks + stats.mindmaps;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-neural-purple/20 rounded-xl flex items-center justify-center">
          <FolderOpen className="w-6 h-6 text-neural-purple" />
        </div>
        <div>
          <h2 className="text-xl font-bold">My Library</h2>
          <p className="text-sm text-gray-400">Your saved study resources</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-neural-dark rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-center gap-6 text-sm">
          <span className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <span className="text-gray-300">{stats.cheatsheets}</span>
            <span className="text-gray-500">Cheat Sheets</span>
          </span>
          <span className="text-gray-700">•</span>
          <span className="flex items-center gap-2">
            <span className="text-lg">🃏</span>
            <span className="text-gray-300">{stats.flashcard_decks}</span>
            <span className="text-gray-500">Flashcard Decks</span>
          </span>
          <span className="text-gray-700">•</span>
          <span className="flex items-center gap-2">
            <span className="text-lg">🗺️</span>
            <span className="text-gray-300">{stats.mindmaps}</span>
            <span className="text-gray-500">Mind Maps</span>
          </span>
        </div>
      </div>

      {/* Filter/Search Bar */}
      <div className="bg-neural-dark rounded-xl p-4 border border-gray-800 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by topic or subject..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-neural-purple focus:outline-none"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Filter:</span>
          </div>
          
          <button
            onClick={() => setFilter(prev => ({ ...prev, type: 'all' }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter.type === 'all' 
                ? 'bg-neural-purple text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter(prev => ({ ...prev, type: 'cheatsheet' }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              filter.type === 'cheatsheet' 
                ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            📄 Cheat Sheets
          </button>
          <button
            onClick={() => setFilter(prev => ({ ...prev, type: 'flashcard_deck' }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              filter.type === 'flashcard_deck' 
                ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🃏 Flashcards
          </button>
          <button
            onClick={() => setFilter(prev => ({ ...prev, type: 'mindmap' }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              filter.type === 'mindmap' 
                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🗺️ Mind Maps
          </button>
          
          <div className="w-px h-6 bg-gray-700 mx-2" />
          
          <button
            onClick={() => setFilter(prev => ({ ...prev, favoriteOnly: !prev.favoriteOnly }))}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
              filter.favoriteOnly 
                ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Star className={`w-4 h-4 ${filter.favoriteOnly ? 'fill-yellow-400' : ''}`} />
            Favorites
          </button>
        </div>
      </div>

      {/* Resource List */}
      {filteredResources.length === 0 ? (
        <div className="bg-neural-dark rounded-xl p-12 border border-gray-800 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-gray-600" />
          </div>
          {totalResources === 0 ? (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No resources yet</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Generate cheat sheets or flashcards from any topic to save them here for quick access.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-2">No matching resources</h3>
              <p className="text-gray-500">
                Try adjusting your filters or search query.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredResources.map(resource => {
            const typeConfig = RESOURCE_TYPES[resource.resourceType] || RESOURCE_TYPES.cheatsheet;
            
            return (
              <div
                key={resource.id}
                onClick={() => handleResourceClick(resource)}
                className={`bg-neural-dark rounded-xl p-4 border border-gray-800 hover:border-neural-purple/50 transition-all cursor-pointer group`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 ${typeConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0 text-2xl`}>
                    {typeConfig.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-white group-hover:text-neural-purple transition-colors truncate">
                          {resource.topic}
                        </h3>
                        <p className="text-sm text-gray-500">{resource.subject}</p>
                      </div>
                      
                      {/* Type badge */}
                      <span className={`text-xs px-2 py-1 rounded-full ${typeConfig.bgColor} ${typeConfig.color} whitespace-nowrap`}>
                        {typeConfig.label}
                      </span>
                    </div>
                    
                    {/* Meta info */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Opened {formatRelativeTime(resource.lastAccessed)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {resource.accessCount || 1} view{(resource.accessCount || 1) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => handleToggleFavorite(resource.id, e)}
                      className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                      title={resource.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star className={`w-4 h-4 ${resource.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(resource.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-gray-500 hover:text-red-400"
                      title="Delete resource"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neural-dark rounded-xl border border-gray-700 p-6 max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Delete Resource?</h3>
              <p className="text-gray-400 mb-6">
                This will permanently remove this resource from your library. This action cannot be undone.
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResourceLibrary;
