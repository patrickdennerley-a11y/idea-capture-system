import { useState, useMemo, ChangeEvent, FC } from 'react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { X, Save, Undo, Download, Plus } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// Type definitions
interface ScheduleBlock {
  time: string;
  activity: string;
  description?: string;
  reasoning?: string;
  priority?: string;
}

interface RoutineData {
  schedule: ScheduleBlock[];
}

interface StoredEvent {
  id: number;
  title: string;
  description: string;
  start: string;
  end: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarEvent extends StoredEvent {
  start: Date | string;
  end: Date | string;
}

interface FormData {
  title: string;
  description: string;
  start: string;
  end: string;
  priority: 'high' | 'medium' | 'low';
}

interface CalendarViewProps {
  routineToLoad?: RoutineData | null;
}

interface DragDropEvent {
  event: CalendarEvent;
  start: Date;
  end: Date;
}

interface SelectSlotEvent {
  start: Date;
  end: Date;
}

interface EventStyleGetterResult {
  style: {
    backgroundColor: string;
    color: string;
    border: string;
    borderRadius: string;
    padding: string;
  };
}

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

const CalendarView: FC<CalendarViewProps> = ({ routineToLoad = null }) => {
  const [events, setEvents] = useLocalStorage<StoredEvent[]>('neural-calendar-events', []);
  const [undoStack, setUndoStack] = useLocalStorage<StoredEvent[][]>('neural-calendar-undo', []);
  const [view, setView] = useState<View>('week');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    start: '',
    end: '',
    priority: 'medium',
  });

  // Convert stored events to Date objects for calendar
  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return events.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
  }, [events]);

  // Helper: format Date to datetime-local input format
  const formatDateTimeLocal = (date: Date | string): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper: save current state for undo (keep last 10 states)
  const saveUndo = (): void => {
    setUndoStack(prev => [...prev.slice(-9), events]);
  };

  // Undo last change
  const handleUndo = (): void => {
    if (undoStack.length > 0) {
      const previousState = undoStack[undoStack.length - 1];
      setEvents(previousState);
      setUndoStack(prev => prev.slice(0, -1));
    }
  };

  // Parse time string like "9:00 AM - 10:30 AM" and create Date objects for today
  const parseTimeBlock = (timeString: string): { start: Date; end: Date } => {
    try {
      const today = new Date();
      const [startStr, endStr] = timeString.split(' - ');

      const parseTime = (timeStr: string): Date => {
        const [time, meridiem] = timeStr.trim().split(' ');
        let [hours, minutes = 0] = time.split(':').map(Number);

        if (meridiem === 'PM' && hours !== 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;

        const date = new Date(today);
        date.setHours(hours, minutes || 0, 0, 0);
        return date;
      };

      return {
        start: parseTime(startStr),
        end: parseTime(endStr)
      };
    } catch (error) {
      console.error('Error parsing time:', timeString, error);
      const now = new Date();
      return { start: now, end: new Date(now.getTime() + 30 * 60000) }; // Default 30 min
    }
  };

  // Load AI-generated routine into calendar
  const handleLoadRoutine = (): void => {
    if (!routineToLoad || !routineToLoad.schedule) {
      alert('No routine to load');
      return;
    }

    try {
      saveUndo();

      const newEvents: StoredEvent[] = routineToLoad.schedule.map((block, index) => {
        const { start, end } = parseTimeBlock(block.time);
        return {
          id: Date.now() + index,
          title: block.activity,
          description: block.description || block.reasoning || '',
          start: start.toISOString(),
          end: end.toISOString(),
          priority: (block.priority?.toLowerCase() || 'medium') as 'high' | 'medium' | 'low',
        };
      });

      setEvents([...events, ...newEvents]);
      alert(`Successfully loaded ${newEvents.length} events from AI routine!`);
    } catch (error) {
      console.error('Error loading routine:', error);
      alert('Failed to load routine. Please check the console for details.');
    }
  };

  // Handle selecting a time slot (creating new event)
  const handleSelectSlot = ({ start, end }: SelectSlotEvent): void => {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      start: formatDateTimeLocal(start),
      end: formatDateTimeLocal(end),
      priority: 'medium',
    });
    setShowModal(true);
  };

  // Handle custom event button (default to next hour, 1 hour duration)
  const handleCreateEvent = (): void => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const endTime = new Date(nextHour);
    endTime.setHours(nextHour.getHours() + 1);

    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      start: formatDateTimeLocal(nextHour),
      end: formatDateTimeLocal(endTime),
      priority: 'medium',
    });
    setShowModal(true);
  };

  // Handle clicking an existing event (editing)
  const handleSelectEvent = (event: CalendarEvent): void => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      description: event.description || '',
      start: formatDateTimeLocal(event.start),
      end: formatDateTimeLocal(event.end),
      priority: event.priority || 'medium',
    });
    setShowModal(true);
  };

  // Handle saving event (create or update)
  const handleSaveEvent = (): void => {
    if (!formData.title.trim()) {
      alert('Please enter an event title');
      return;
    }

    const startDate = new Date(formData.start);
    const endDate = new Date(formData.end);

    // Validate: end must be after start
    if (endDate <= startDate) {
      alert('Please enter an end date/time AFTER the start date/time!');
      return;
    }

    // Validate: minimum 5 minute duration
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (durationMinutes < 5) {
      alert('Events must be at least 5 minutes long');
      return;
    }

    // Save current state for undo
    saveUndo();

    const eventData: StoredEvent = {
      id: editingEvent?.id || Date.now(),
      title: formData.title,
      description: formData.description,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      priority: formData.priority,
    };

    if (editingEvent) {
      // Update existing event
      setEvents(events.map(e => e.id === editingEvent.id ? eventData : e));
    } else {
      // Create new event
      setEvents([...events, eventData]);
    }

    setShowModal(false);
  };

  // Handle deleting event
  const handleDeleteEvent = (): void => {
    if (editingEvent && confirm('Delete this event?')) {
      saveUndo();
      setEvents(events.filter(e => e.id !== editingEvent.id));
      setShowModal(false);
    }
  };

  // Handle event drag/drop (move event)
  const handleEventDrop = ({ event, start, end }: DragDropEvent): void => {
    saveUndo();
    setEvents(events.map(e =>
      e.id === event.id
        ? {
            ...e,
            start: start.toISOString(),
            end: end.toISOString(),
          }
        : e
    ));
  };

  // Handle event resize (change duration by dragging edges)
  const handleEventResize = ({ event, start, end }: DragDropEvent): void => {
    saveUndo();
    setEvents(events.map(e =>
      e.id === event.id
        ? {
            ...e,
            start: start.toISOString(),
            end: end.toISOString(),
          }
        : e
    ));
  };

  // Event styling: solid purple boxes with white text, NO borders
  const eventStyleGetter = (): EventStyleGetterResult => ({
    style: {
      backgroundColor: '#7c3aed',
      color: '#ffffff',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 6px',
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-400">
          {events.length} event{events.length !== 1 ? 's' : ''} scheduled
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateEvent}
            className="neural-button flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Create Event
          </button>
          {routineToLoad && routineToLoad.schedule && routineToLoad.schedule.length > 0 && (
            <button
              onClick={handleLoadRoutine}
              className="neural-button flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Load AI Routine
            </button>
          )}
          {undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="neural-button-secondary flex items-center gap-2 text-sm"
            >
              <Undo className="w-4 h-4" />
              Undo
            </button>
          )}
        </div>
      </div>

      <div className="bg-neural-darker rounded-lg border border-gray-800 p-4">
        <DnDCalendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          scrollToTime={new Date()}
          style={{ height: 800 }}
          views={['month', 'week', 'day']}
          step={15}
          timeslots={2}
          dayLayoutAlgorithm="no-overlap"
          eventPropGetter={eventStyleGetter}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          resizable
          draggableAccessor={() => true}
          resizableAccessor={() => true}
        />
      </div>

      {/* Event Creation/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-neural-darker border border-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                  placeholder="Event description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Start
                </label>
                <input
                  type="datetime-local"
                  value={formData.start}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, start: e.target.value })}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  End
                </label>
                <input
                  type="datetime-local"
                  value={formData.end}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, end: e.target.value })}
                  className="w-full bg-neural-dark border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-neural-purple"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveEvent}
                  className="neural-button flex-1 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Event
                </button>
                {editingEvent && (
                  <button
                    onClick={handleDeleteEvent}
                    className="neural-button-danger px-4"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
