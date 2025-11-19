import { useState, useEffect, useCallback, useRef, FC } from 'react';
import { CheckCircle2, Circle, Flame, Trophy, Plus, X, Calendar, Star, Trash2 } from 'lucide-react';
import { getTodayString, isToday } from '../utils/dateUtils';
import { useLocalStorage } from '../hooks/useLocalStorage';

// Type definitions
interface ChecklistItem {
  id: string;
  category: string;
  text: string;
  important: boolean;
  isDefault: boolean;
  completed?: boolean;
  completedAt?: string | null;
}

interface DailyChecklistData {
  date: string;
  items: ChecklistItem[];
  _check?: number;
}

interface HistoryEntry {
  completed: string[];
  timestamps: Record<string, string>;
  completionRate: number;
  totalItems: number;
  isToday?: boolean;
}

interface DailyChecklistProps {
  checklist: DailyChecklistData;
  setChecklist: (checklist: DailyChecklistData | ((prev: DailyChecklistData) => DailyChecklistData)) => void;
}

interface CalendarViewProps {
  history: Record<string, HistoryEntry>;
  checklist: DailyChecklistData;
  onClose: () => void;
}

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  dayOfMonth: number;
  data: HistoryEntry | null;
  isToday: boolean;
}

// Your actual routines from your notes
const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'morning-1',
    category: 'Morning',
    text: 'Take alpha-GPC + L-tyrosine together',
    important: true,
    isDefault: true,
  },
  {
    id: 'morning-2',
    category: 'Morning',
    text: 'Drink hot beverage',
    important: false,
    isDefault: true,
  },
  {
    id: 'morning-3',
    category: 'Morning',
    text: 'Check if pink/brown noise is playing',
    important: false,
    isDefault: true,
  },
  {
    id: 'morning-4',
    category: 'Morning',
    text: 'Charge earphones',
    important: false,
    isDefault: true,
  },
  {
    id: 'throughout-1',
    category: 'Throughout Day',
    text: 'Drink electrolyte mix after each urination',
    important: true,
    isDefault: true,
  },
  {
    id: 'throughout-2',
    category: 'Throughout Day',
    text: '2 hours after electrolytes: Milk with cocoa powder (no magnesium)',
    important: true,
    isDefault: true,
  },
  {
    id: 'throughout-3',
    category: 'Throughout Day',
    text: 'After milk: 2 bites dark chocolate (100% Lindt for cerebral blood flow)',
    important: true,
    isDefault: true,
  },
  {
    id: 'throughout-4',
    category: 'Throughout Day',
    text: '50 minutes brisk walking (mon-sat goal: 300min/week)',
    important: false,
    isDefault: true,
  },
  {
    id: 'study-1',
    category: 'Study',
    text: 'Study session (Geometry/Group Theory/Linear Algebra/Statistics)',
    important: false,
    isDefault: true,
  },
  {
    id: 'study-2',
    category: 'Study',
    text: 'Use NotebookLM flashcards (most effective)',
    important: false,
    isDefault: true,
  },
  {
    id: 'study-3',
    category: 'Study',
    text: 'Practice problems (best study material for math)',
    important: false,
    isDefault: true,
  },
  {
    id: 'study-4',
    category: 'Study',
    text: 'Review geometry problem sheet PDF',
    important: false,
    isDefault: true,
  },
  {
    id: 'evening-1',
    category: 'Evening',
    text: 'After dinner: Electrolyte mix',
    important: false,
    isDefault: true,
  },
  {
    id: 'evening-2',
    category: 'Evening',
    text: 'Last meal: Yogurt with berries (blueberries/blackberries/strawberries)',
    important: false,
    isDefault: true,
  },
  {
    id: 'bed-1',
    category: 'Before Bed',
    text: 'Magnesium tablets (no liquids)',
    important: true,
    isDefault: true,
  },
  {
    id: 'bed-2',
    category: 'Before Bed',
    text: 'Tidy room check',
    important: false,
    isDefault: true,
  },
  {
    id: 'bed-3',
    category: 'Before Bed',
    text: 'Tomorrow prep: keys, wallet, unimelb card, visa, myki',
    important: false,
    isDefault: true,
  },
  {
    id: 'bed-4',
    category: 'Before Bed',
    text: 'Check bank and myki balance',
    important: false,
    isDefault: true,
  },
];

const CATEGORIES: string[] = ['Morning', 'Throughout Day', 'Study', 'Evening', 'Before Bed'];

const DailyChecklist: FC<DailyChecklistProps> = ({ checklist, setChecklist }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [newItemText, setNewItemText] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('Morning');
  const [newItemImportant, setNewItemImportant] = useState<boolean>(false);
  const [customItems, setCustomItems] = useLocalStorage<ChecklistItem[]>('neural-custom-routines', []);
  const [disabledDefaults, setDisabledDefaults] = useLocalStorage<string[]>('neural-disabled-defaults', []);
  const [history, setHistory] = useLocalStorage<Record<string, HistoryEntry>>('neural-checklist-history', {});

  // Combine default items (excluding disabled ones) with custom items
  const allItems: ChecklistItem[] = [
    ...DEFAULT_CHECKLIST_ITEMS.filter(item => !disabledDefaults.includes(item.id)),
    ...customItems
  ];
  const categories: string[] = ['All', ...CATEGORIES];

  const initRef = useRef<boolean>(false);

  // Initialize or reset checklist when needed
  useEffect(() => {
    const itemsToUse: ChecklistItem[] = [
      ...DEFAULT_CHECKLIST_ITEMS.filter(item => !disabledDefaults.includes(item.id)),
      ...customItems
    ];
    const now = getTodayString();

    // First time initialization or empty items
    if (!checklist || !checklist.date || !checklist.items || checklist.items.length === 0) {
      if (!initRef.current) {
        initRef.current = true;
        setChecklist({
          date: now,
          items: itemsToUse.map(item => ({
            ...item,
            completed: false,
            completedAt: null,
          })),
        });
      }
      return;
    }

    // Date changed - save history and reset
    if (checklist.date !== now) {
      const completed = checklist.items
        .filter(item => item.completed)
        .map(item => item.id);

      const timestamps: Record<string, string> = {};
      checklist.items.forEach(item => {
        if (item.completedAt) {
          timestamps[item.id] = item.completedAt;
        }
      });

      const completionRate = checklist.items.length > 0
        ? completed.length / checklist.items.length
        : 0;

      if (completed.length > 0 || completionRate > 0) {
        setHistory(prev => ({
          ...prev,
          [checklist.date]: {
            completed,
            timestamps,
            completionRate,
            totalItems: checklist.items.length,
          }
        }));
      }

      // Reset for new day
      setChecklist({
        date: now,
        items: itemsToUse.map(item => ({
          ...item,
          completed: false,
          completedAt: null,
        })),
      });
    }
  }, [checklist?.date, checklist?.items?.length, customItems, disabledDefaults]);

  // Check for midnight every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = getTodayString();
      const currentDate = checklist?.date;

      if (currentDate && currentDate !== now) {
        // Force re-check by updating a dummy value
        setChecklist(prev => ({ ...prev, _check: Date.now() }));
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [checklist?.date]);

  // Safety check - if checklist is invalid, show loading
  if (!checklist || !checklist.items) {
    return (
      <div className="neural-card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neural-purple mx-auto mb-4"></div>
            <p className="text-gray-400">Loading routines...</p>
          </div>
        </div>
      </div>
    );
  }

  const toggleItem = (id: string): void => {
    const now = new Date().toISOString();
    setChecklist(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
              completedAt: !item.completed ? now : null,
            }
          : item
      ),
    }));
  };

  const addCustomItem = (): void => {
    if (!newItemText.trim()) return;

    const newItem: ChecklistItem = {
      id: `custom-${Date.now()}`,
      category: newItemCategory,
      text: newItemText.trim(),
      important: newItemImportant,
      isDefault: false,
    };

    setCustomItems(prev => [...prev, newItem]);

    // Add to today's checklist too
    setChecklist(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, completed: false, completedAt: null }],
    }));

    // Reset form
    setNewItemText('');
    setNewItemImportant(false);
    setShowAddForm(false);
  };

  const deleteItem = (id: string): void => {
    const isDefaultItem = DEFAULT_CHECKLIST_ITEMS.some(item => item.id === id);

    if (isDefaultItem) {
      // Add to disabled defaults list (won't appear in future resets)
      setDisabledDefaults(prev => [...prev, id]);
    } else {
      // Remove from custom items
      setCustomItems(prev => prev.filter(item => item.id !== id));
    }

    // Remove from today's checklist
    setChecklist(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  };

  const completionRate: number = checklist.items
    ? Math.round((checklist.items.filter(i => i.completed).length / checklist.items.length) * 100)
    : 0;

  const filteredItems: ChecklistItem[] = checklist.items
    ? checklist.items.filter(item =>
        selectedCategory === 'All' || item.category === selectedCategory
      )
    : [];

  const completedToday: number = checklist.items?.filter(i => i.completed).length || 0;
  const totalItems: number = checklist.items?.length || 0;

  // Calculate streak from history
  const calculateStreak = (): number => {
    const dates = Object.keys(history).sort().reverse();
    let streak = 0;
    const today = getTodayString();

    // Check if today is complete (>70%)
    if (completionRate >= 70) {
      streak = 1;
    }

    // Count backwards from yesterday
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      if (date >= today) continue; // Skip today

      const dayData = history[date];
      if (dayData.completionRate >= 0.7) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const streak: number = calculateStreak();

  // Get yesterday's completion rate
  const getYesterdayCompletion = (): number | null => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    if (history[yesterdayString]) {
      return Math.round(history[yesterdayString].completionRate * 100);
    }
    return null;
  };

  const yesterdayCompletion: number | null = getYesterdayCompletion();

  // Render calendar view
  if (showCalendar) {
    return (
      <CalendarView
        history={history}
        checklist={checklist}
        onClose={() => setShowCalendar(false)}
      />
    );
  }

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-neural-purple" />
            Daily Routines
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            External structure for your ADHD brain
          </p>
          {yesterdayCompletion !== null && (
            <p className="text-xs text-gray-500 mt-1">
              Yesterday: {yesterdayCompletion}% completed
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-orange-400 mb-1">
            <Flame className="w-5 h-5" />
            <span className="text-2xl font-bold">{streak}</span>
            <span className="text-sm">day streak</span>
          </div>
          <div className="text-sm text-gray-400">
            {completedToday}/{totalItems} completed
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">Today's Progress</span>
          <span className="text-sm font-bold text-neural-purple">{completionRate}%</span>
        </div>
        <div className="h-3 bg-neural-darker rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neural-purple to-neural-pink transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowCalendar(true)}
          className="neural-button-secondary flex items-center gap-2 flex-1"
        >
          <Calendar className="w-4 h-4" />
          History
        </button>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="neural-button flex items-center gap-2 flex-1"
        >
          <Plus className="w-4 h-4" />
          Add Custom Routine
        </button>
      </div>

      {/* Add Custom Routine Form */}
      {showAddForm && (
        <div className="bg-neural-darker border border-neural-purple rounded-lg p-4 mb-4 animate-slide-in">
          <h3 className="font-bold mb-3">Add New Routine</h3>

          <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            addCustomItem();
          }}>
            <input
              type="text"
              value={newItemText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewItemText(e.target.value)}
              placeholder="Enter routine text..."
              className="neural-input mb-3"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Category</label>
                <select
                  value={newItemCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewItemCategory(e.target.value)}
                  className="neural-input"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <button
                  type="button"
                  onClick={() => setNewItemImportant(!newItemImportant)}
                  className={`w-full py-2 px-4 rounded-lg border-2 transition-all ${
                    newItemImportant
                      ? 'border-red-400 bg-red-400/20 text-red-400'
                      : 'border-gray-700 bg-neural-dark text-gray-400'
                  }`}
                >
                  <Star className={`w-4 h-4 inline mr-1 ${newItemImportant ? 'fill-current' : ''}`} />
                  {newItemImportant ? 'Important' : 'Normal'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newItemText.trim()}
                className="neural-button flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Routine
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItemText('');
                  setNewItemImportant(false);
                }}
                className="neural-button-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-neural-purple text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Checklist Items */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              item.completed
                ? 'bg-neural-purple/10 border border-neural-purple/30'
                : 'bg-neural-darker border border-gray-800 hover:border-gray-700'
            }`}
          >
            <div
              className="flex-shrink-0 mt-0.5 cursor-pointer"
              onClick={() => toggleItem(item.id)}
            >
              {item.completed ? (
                <CheckCircle2 className="w-5 h-5 text-neural-purple" />
              ) : (
                <Circle className="w-5 h-5 text-gray-600" />
              )}
            </div>
            <div className="flex-1 cursor-pointer" onClick={() => toggleItem(item.id)}>
              <p className={`${item.completed ? 'line-through text-gray-500' : 'text-gray-200'} ${
                item.important ? 'font-medium' : ''
              }`}>
                {item.text}
                {item.important && <span className="text-red-400 ml-2">*</span>}
                {!item.isDefault && <span className="text-xs text-gray-500 ml-2">(custom)</span>}
              </p>
              <p className="text-xs text-gray-600 mt-1">{item.category}</p>
              {item.completedAt && (
                <p className="text-xs text-neural-purple mt-1">
                  ✓ Completed at {new Date(item.completedAt).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
            <button
              onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                const confirmMsg = item.isDefault
                  ? 'Remove this default routine? It won\'t appear again.'
                  : 'Delete this custom routine?';
                if (confirm(confirmMsg)) {
                  deleteItem(item.id);
                }
              }}
              className="flex-shrink-0 text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {completionRate === 100 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-neural-purple/20 to-neural-pink/20 border border-neural-purple/50 rounded-lg animate-slide-in">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="font-bold text-lg">All done for today! 🎉</p>
              <p className="text-sm text-gray-400">You completed all your routines. Excellent work!</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 text-center">
          <span className="text-red-400">*</span> = High priority items
        </p>
      </div>
    </div>
  );
};

// Calendar View Component
const CalendarView: FC<CalendarViewProps> = ({ history, checklist, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calculate today's completion data from live checklist
  const getTodayData = (): HistoryEntry | null => {
    if (!checklist || !checklist.items || checklist.items.length === 0) return null;

    const completed = checklist.items
      .filter(item => item.completed)
      .map(item => item.id);

    const timestamps: Record<string, string> = {};
    checklist.items.forEach(item => {
      if (item.completedAt) {
        timestamps[item.id] = item.completedAt;
      }
    });

    const completionRate = checklist.items.length > 0
      ? completed.length / checklist.items.length
      : 0;

    return {
      completed,
      timestamps,
      completionRate,
      totalItems: checklist.items.length,
      isToday: true,
    };
  };

  // Generate last 30 days
  const generateCalendarDays = (): CalendarDay[] => {
    const days: CalendarDay[] = [];
    const today = new Date();
    const todayString = getTodayString();
    const todayData = getTodayData();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];

      // Use today's live data if it's today, otherwise use history
      const data = dateString === todayString ? todayData : (history[dateString] || null);

      days.push({
        date: dateString,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayOfMonth: date.getDate(),
        data: data,
        isToday: dateString === todayString,
      });
    }

    return days;
  };

  const days: CalendarDay[] = generateCalendarDays();

  // Calculate stats
  const daysWithData: number = days.filter(d => d.data).length;
  const avgCompletion: number = daysWithData > 0
    ? Math.round((days.reduce((sum, d) => sum + (d.data?.completionRate || 0), 0) / daysWithData) * 100)
    : 0;
  const bestDay: CalendarDay = days.reduce((best, d) =>
    (d.data?.completionRate || 0) > (best.data?.completionRate || 0) ? d : best
  , { date: '', dayOfWeek: '', dayOfMonth: 0, data: { completed: [], timestamps: {}, completionRate: 0, totalItems: 0 }, isToday: false });

  const getColorClass = (completionRate: number | undefined): string => {
    if (!completionRate) return 'bg-gray-800 border-gray-700';
    if (completionRate >= 0.7) return 'bg-green-600/30 border-green-600/50';
    if (completionRate >= 0.4) return 'bg-yellow-600/30 border-yellow-600/50';
    return 'bg-red-600/30 border-red-600/50';
  };

  return (
    <div className="neural-card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-neural-purple" />
            Completion History
          </h2>
          <p className="text-sm text-gray-400 mt-1">Last 30 days</p>
        </div>
        <button onClick={onClose} className="neural-button-secondary">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">Days Tracked</div>
          <div className="text-2xl font-bold text-neural-purple">{daysWithData}/30</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">Avg Completion</div>
          <div className="text-2xl font-bold text-neural-blue">{avgCompletion}%</div>
        </div>
        <div className="bg-neural-darker border border-gray-800 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-1">Best Day</div>
          <div className="text-2xl font-bold text-green-400">
            {bestDay.data.completionRate > 0 ? Math.round(bestDay.data.completionRate * 100) + '%' : '-'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-600/30 border border-green-600/50"></div>
          <span className="text-gray-400">&gt;70%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-600/30 border border-yellow-600/50"></div>
          <span className="text-gray-400">40-70%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-600/30 border border-red-600/50"></div>
          <span className="text-gray-400">&lt;40%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-800 border border-gray-700"></div>
          <span className="text-gray-400">No data</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2 mb-6">
        {days.map(day => (
          <button
            key={day.date}
            onClick={() => setSelectedDate(day.data ? day.date : null)}
            className={`p-3 rounded-lg border-2 transition-all ${
              getColorClass(day.data?.completionRate)
            } ${
              selectedDate === day.date
                ? 'ring-2 ring-neural-purple'
                : 'hover:border-neural-purple/50'
            } ${
              day.data ? 'cursor-pointer' : 'cursor-default'
            } ${
              day.isToday ? 'border-neural-blue' : ''
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">
              {day.dayOfWeek}
              {day.isToday && <span className="text-neural-blue ml-1">●</span>}
            </div>
            <div className="text-lg font-bold">{day.dayOfMonth}</div>
            {day.data && (
              <div className="text-xs text-gray-400 mt-1">
                {Math.round(day.data.completionRate * 100)}%
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Day Details */}
      {selectedDate && (() => {
        const selectedDay = days.find(d => d.date === selectedDate);
        const dayData = selectedDay?.data;
        if (!dayData) return null;

        return (
          <div className="bg-neural-darker border border-neural-purple rounded-lg p-4 animate-slide-in">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
              {selectedDay.isToday && (
                <span className="text-xs px-2 py-1 bg-neural-blue/20 text-neural-blue rounded-full">
                  Today
                </span>
              )}
            </h3>
            <div className="mb-3">
              <div className="text-sm text-gray-400 mb-1">Completion Rate</div>
              <div className="text-2xl font-bold text-neural-purple">
                {Math.round(dayData.completionRate * 100)}%
              </div>
              <div className="text-sm text-gray-500">
                {dayData.completed.length} of {dayData.totalItems} items
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Completed Items:</div>
              {dayData.completed.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No items completed yet</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {dayData.completed.map(itemId => {
                    const timestamp = dayData.timestamps[itemId];
                    // Get item text from checklist for better display
                    const item = selectedDay.isToday && checklist?.items
                      ? checklist.items.find(i => i.id === itemId)
                      : null;
                    const displayText = item ? item.text : itemId;

                    return (
                      <div key={itemId} className="text-sm text-gray-400 flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-neural-purple" />
                        <span className="flex-1">{displayText}</span>
                        {timestamp && (
                          <span className="text-xs text-gray-600">
                            {new Date(timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DailyChecklist;
