export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  isAllDay: boolean;
  source: 'imported' | 'manual';
  sourceFile?: string;
}

// Parse ICS datetime format (YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ)
function parseICSDateTime(value: string): Date | null {
  try {
    const dateStr = value.replace('Z', '');
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = dateStr.length >= 11 ? parseInt(dateStr.substring(9, 11)) : 0;
    const minute = dateStr.length >= 13 ? parseInt(dateStr.substring(11, 13)) : 0;
    const second = dateStr.length >= 15 ? parseInt(dateStr.substring(13, 15)) : 0;

    if (value.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  } catch {
    return null;
  }
}

// Parse ICS file content
export function parseICS(content: string, sourceFile: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r?\n/);

  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line folding (lines starting with space/tab are continuations)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[++i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = {
        id: `cal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: 'imported',
        sourceFile,
        isAllDay: false,
      };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.title && currentEvent.startDate) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
    } else if (inEvent && currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).split(';')[0];
        const value = line.substring(colonIndex + 1);

        switch (key) {
          case 'SUMMARY':
            currentEvent.title = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'DESCRIPTION':
            currentEvent.description = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'LOCATION':
            currentEvent.location = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            break;
          case 'DTSTART':
            if (line.includes('VALUE=DATE:') || value.length === 8) {
              currentEvent.isAllDay = true;
              const year = parseInt(value.substring(0, 4));
              const month = parseInt(value.substring(4, 6)) - 1;
              const day = parseInt(value.substring(6, 8));
              currentEvent.startDate = new Date(year, month, day);
            } else {
              const parsed = parseICSDateTime(value);
              if (parsed) currentEvent.startDate = parsed;
            }
            break;
          case 'DTEND':
            if (line.includes('VALUE=DATE:') || value.length === 8) {
              const year = parseInt(value.substring(0, 4));
              const month = parseInt(value.substring(4, 6)) - 1;
              const day = parseInt(value.substring(6, 8));
              currentEvent.endDate = new Date(year, month, day);
            } else {
              const parsed = parseICSDateTime(value);
              if (parsed) currentEvent.endDate = parsed;
            }
            break;
        }
      }
    }
  }

  return events;
}
