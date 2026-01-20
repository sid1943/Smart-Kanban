import React from 'react';
import { CalendarEvent } from '../features/calendarImport';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

interface CalendarViewProps {
  selectedCalendarDate: Date;
  calendarDays: CalendarDay[];
  selectedDateEvents: CalendarEvent[];
  calendarEvents: CalendarEvent[];
  getEventsForDate: (date: Date) => CalendarEvent[];
  today: Date;
  showAddEventModal: boolean;
  newEventTitle: string;
  newEventDate: string;
  newEventEndDate: string;
  newEventTime: string;
  newEventEndTime: string;
  newEventLocation: string;
  newEventIsAllDay: boolean;
  onBack: () => void;
  onImportIcs: (file: File) => void;
  onOpenAddEvent: () => void;
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDeleteEvent: (id: string) => void;
  onCloseAddEventModal: () => void;
  onSetNewEventTitle: (value: string) => void;
  onSetNewEventDate: (value: string) => void;
  onSetNewEventEndDate: (value: string) => void;
  onSetNewEventTime: (value: string) => void;
  onSetNewEventEndTime: (value: string) => void;
  onSetNewEventLocation: (value: string) => void;
  onSetNewEventIsAllDay: (value: boolean) => void;
  onAddEvent: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  selectedCalendarDate,
  calendarDays,
  selectedDateEvents,
  calendarEvents,
  getEventsForDate,
  today,
  showAddEventModal,
  newEventTitle,
  newEventDate,
  newEventEndDate,
  newEventTime,
  newEventEndTime,
  newEventLocation,
  newEventIsAllDay,
  onBack,
  onImportIcs,
  onOpenAddEvent,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onDeleteEvent,
  onCloseAddEventModal,
  onSetNewEventTitle,
  onSetNewEventDate,
  onSetNewEventEndDate,
  onSetNewEventTime,
  onSetNewEventEndTime,
  onSetNewEventLocation,
  onSetNewEventIsAllDay,
  onAddEvent,
}) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen bg-[#1d2125]">
      {/* Header */}
      <div className="bg-[#1d2125] border-b border-[#3d444d] px-4 py-3 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#9fadbc] hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-white">Calendar</h1>
          <div className="flex items-center gap-2">
            <label className="px-4 py-2 bg-[#3d444d] hover:bg-[#4d545d] text-white font-medium
                           rounded transition-all text-sm flex items-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import .ics
              <input
                type="file"
                accept=".ics"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportIcs(file);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={onOpenAddEvent}
              className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white font-medium
                       rounded transition-all text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Event
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={onPrevMonth}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-white font-semibold text-lg">
                {monthNames[selectedCalendarDate.getMonth()]} {selectedCalendarDate.getFullYear()}
              </h2>
              <button
                onClick={onNextMonth}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-[#9fadbc] text-xs font-medium py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDate(day.date);
                const isToday = day.date.getTime() === today.getTime();
                const isSelected = day.date.toDateString() === selectedCalendarDate.toDateString();

                return (
                  <button
                    key={idx}
                    onClick={() => onSelectDate(day.date)}
                    className={`aspect-square p-1 rounded-lg transition-all relative
                              ${day.isCurrentMonth ? 'text-white' : 'text-[#9fadbc]/50'}
                              ${isSelected ? 'bg-[#579dff]' : isToday ? 'bg-[#3d444d]' : 'hover:bg-[#3d444d]'}`}
                  >
                    <span className="text-sm">{day.date.getDate()}</span>
                    {dayEvents.length > 0 && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((_, i) => (
                          <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#579dff]'}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Events List */}
          <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            <h3 className="text-white font-semibold mb-4">
              {selectedCalendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>

            {selectedDateEvents.length === 0 ? (
              <p className="text-[#9fadbc] text-sm">No events for this day</p>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map(event => (
                  <div
                    key={event.id}
                    className="bg-[#1a1f26] rounded-lg p-3 border border-[#3d444d]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-white font-medium text-sm">{event.title}</h4>
                        {!event.isAllDay && (
                          <p className="text-[#9fadbc] text-xs mt-1">
                            {event.startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {event.endDate && ` - ${event.endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                          </p>
                        )}
                        {event.isAllDay && (
                          <p className="text-[#9fadbc] text-xs mt-1">All day</p>
                        )}
                        {event.location && (
                          <p className="text-[#9fadbc] text-xs mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {event.location}
                          </p>
                        )}
                        {event.source === 'imported' && event.sourceFile && (
                          <p className="text-[#9fadbc]/60 text-xs mt-1">Imported from {event.sourceFile}</p>
                        )}
                      </div>
                      <button
                        onClick={() => onDeleteEvent(event.id)}
                        className="p-1 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming Events */}
            {calendarEvents.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#3d444d]">
                <h4 className="text-[#9fadbc] text-xs font-semibold uppercase tracking-wider mb-3">Upcoming Events</h4>
                <div className="space-y-2">
                  {calendarEvents
                    .filter(e => new Date(e.startDate) >= today)
                    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
                    .slice(0, 5)
                    .map(event => (
                      <div
                        key={event.id}
                        onClick={() => onSelectDate(new Date(event.startDate))}
                        className="text-sm text-[#9fadbc] hover:text-white cursor-pointer transition-all"
                      >
                        <span className="text-[#579dff] text-xs mr-2">
                          {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {event.title}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddEventModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
          onClick={onCloseAddEventModal}
        >
          <div
            className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#3d444d] flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add Event</h2>
              <button
                onClick={onCloseAddEventModal}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[#9fadbc] text-sm mb-2 block">Title</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => onSetNewEventTitle(e.target.value)}
                  placeholder="Event title"
                  className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                           focus:outline-none focus:border-[#579dff] text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={newEventIsAllDay}
                  onChange={(e) => onSetNewEventIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#22272b] border-[#3d444d]"
                />
                <label htmlFor="allDay" className="text-[#9fadbc] text-sm">All day event</label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">Start Date</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => onSetNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>
                {!newEventIsAllDay && (
                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">Start Time</label>
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => onSetNewEventTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                               focus:outline-none focus:border-[#579dff] text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#9fadbc] text-sm mb-2 block">End Date</label>
                  <input
                    type="date"
                    value={newEventEndDate}
                    onChange={(e) => onSetNewEventEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                             focus:outline-none focus:border-[#579dff] text-sm"
                  />
                </div>
                {!newEventIsAllDay && (
                  <div>
                    <label className="text-[#9fadbc] text-sm mb-2 block">End Time</label>
                    <input
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => onSetNewEventEndTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                               focus:outline-none focus:border-[#579dff] text-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[#9fadbc] text-sm mb-2 block">Location (optional)</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => onSetNewEventLocation(e.target.value)}
                  placeholder="Event location"
                  className="w-full px-3 py-2 bg-[#22272b] border border-[#3d444d] rounded text-white
                           focus:outline-none focus:border-[#579dff] text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={onCloseAddEventModal}
                  className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={onAddEvent}
                  disabled={!newEventTitle.trim() || !newEventDate}
                  className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded text-sm
                           disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
