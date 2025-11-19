import React, { useState, useMemo, FC } from 'react';
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Plus, X, Trash2, Edit } from 'lucide-react';

// ========== TYPE DEFINITIONS ==========

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  color?: string;
}

interface RoutineToLoad {
  schedule?: Array<{
    time: string;
    activity: string;
    description?: string;
    priority?: string;
  }>;
}

interface CalendarViewProps {
  routineToLoad?: RoutineToLoad | null;
}

// ========== CALENDAR SETUP ==========

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

// ========== COMPONENT ==========

const CalendarView: FC<CalendarViewProps> = ({ routineToLoad }) => {
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('neural-calendar-events', []);
  const [currentView, setCurrentView] = useState<View>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form state
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDescription, setEventDescription] = useState<string>('');
  const [eventStart, setEventStart] = useState<string>('');
  const [eventEnd, setEventEnd] = useState<string>('');
  const [eventColor, setEventColor] = useState<string>('#a855f7');

  // Load routine schedule into calendar
  const loadRoutineIntoCalendar = (): void => {
    if (!routineToLoad?.schedule) return;

    const today = new Date();
    const newEvents = routineToLoad.schedule
      .map((block, index): CalendarEvent | null => {
        // Parse time (e.g., "9:00 AM" or "9:00 AM - 10:30 AM")
        const timeMatch = block.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) return null;

        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const isPM = timeMatch[3].toUpperCase() === 'PM';

        const startHour = isPM && hours !== 12 ? hours + 12 : hours === 12 && !isPM ? 0 : hours;

        const start = new Date(today);
        start.setHours(startHour, minutes, 0);

        const end = new Date(start);
        end.setHours(startHour + 1, minutes, 0); // Default 1 hour duration

        // Set color based on priority
        let color = '#a855f7'; // default purple
        if (block.priority === 'high') color = '#ef4444'; // red
        else if (block.priority === 'medium') color = '#f59e0b'; // orange
        else if (block.priority === 'low') color = '#10b981'; // green

        return {
          id: Date.now() + index,
          title: block.activity,
          start,
          end,
          description: block.description,
          color,
        };
      })
      .filter((event): event is CalendarEvent => event !== null);

    setEvents(prev => [...prev, ...newEvents]);
    alert(`Added ${newEvents.length} events from routine to calendar!`);
  };

  // Handle slot selection (clicking on calendar)
  const handleSelectSlot = (slotInfo: SlotInfo): void => {
    setSelectedSlot({ start: slotInfo.start, end: slotInfo.end });
    setEventTitle('');
    setEventDescription('');
    setEventStart(format(slotInfo.start, "yyyy-MM-dd'T'HH:mm"));
    setEventEnd(format(slotInfo.end, "yyyy-MM-dd'T'HH:mm"));
    setEventColor('#a855f7');
    setEditingEvent(null);
    setShowEventModal(true);
  };

  // Handle event click (edit existing event)
  const handleSelectEvent = (event: CalendarEvent): void => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDescription(event.description ?? '');
    setEventStart(format(event.start, "yyyy-MM-dd'T'HH:mm"));
    setEventEnd(format(event.end, "yyyy-MM-dd'T'HH:mm"));
    setEventColor(event.color ?? '#a855f7');
    setShowEventModal(true);
  };

  // Save event (create or update)
  const handleSaveEvent = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!eventTitle.trim() || !eventStart || !eventEnd) {
      alert('Please fill in all required fields');
      return;
    }

    const newEvent: CalendarEvent = {
      id: editingEvent?.id ?? Date.now(),
      title: eventTitle.trim(),
      start: new Date(eventStart),
      end: new Date(eventEnd),
      description: eventDescription.trim(),
      color: eventColor,
    };

    if (editingEvent) {
      // Update existing event
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? newEvent : e));
    } else {
      // Create new event
      setEvents(prev => [...prev, newEvent]);
    }

    setShowEventModal(false);
    resetForm();
  };

  // Delete event
  const handleDeleteEvent = (): void => {
    if (!editingEvent) return;

    if (confirm('Delete this event?')) {
      setEvents(prev => prev.filter(e => e.id !== editingEvent.id));
      setShowEventModal(false);
      resetForm();
    }
  };

  // Reset form
  const resetForm = (): void => {
    setEventTitle('');
    setEventDescription('');
    setEventStart('');
    setEventEnd('');
    setEventColor('#a855f7');
    setEditingEvent(null);
    setSelectedSlot(null);
  };

  // Convert stored events to Date objects (in case they were serialized)
  const processedEvents = useMemo(() => {
    return events.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
  }, [events]);

  // Custom event style
  const eventStyleGetter = (event: CalendarEvent) => {
    const style: React.CSSProperties = {
      backgroundColor: event.color ?? '#a855f7',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: 'none',
      display: 'block',
    };
    return { style };
  };

  return (
    <div className="space-y-4">
      {/* Load Routine Button */}
      {routineToLoad?.schedule && (
        <div className="bg-neural-purple/10 border border-neural-purple/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Generated routine available</p>
              <p className="text-sm text-gray-400">Add {routineToLoad.schedule.length} time blocks to your calendar</p>
            </div>
            <button
              onClick={loadRoutineIntoCalendar}
              className="neural-button flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Load Routine
            </button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-lg p-4 min-h-[600px]">
        <Calendar
          localizer={localizer}
          events={processedEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%', minHeight: 600 }}
          view={currentView}
          onView={(view: View) => setCurrentView(view)}
          date={currentDate}
          onNavigate={(date: Date) => setCurrentDate(date)}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          popup
        />
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neural-dark border border-neural-purple rounded-xl max-w-md w-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingEvent ? 'Edit Event' : 'New Event'}
              </h3>
              <button
                onClick={() => {
                  setShowEventModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="neural-input w-full"
                  placeholder="Event title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="neural-textarea w-full min-h-[80px]"
                  placeholder="Event description (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start *</label>
                  <input
                    type="datetime-local"
                    value={eventStart}
                    onChange={(e) => setEventStart(e.target.value)}
                    className="neural-input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End *</label>
                  <input
                    type="datetime-local"
                    value={eventEnd}
                    onChange={(e) => setEventEnd(e.target.value)}
                    className="neural-input w-full"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={eventColor}
                    onChange={(e) => setEventColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={eventColor}
                    onChange={(e) => setEventColor(e.target.value)}
                    className="neural-input flex-1"
                    placeholder="#a855f7"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {editingEvent && (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="neural-button-secondary text-red-400 hover:text-red-300 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="neural-button flex-1 flex items-center justify-center gap-2"
                >
                  {editingEvent ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
