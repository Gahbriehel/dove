import { createEvent } from 'ics';

export function generateGoogleCalendarUrl(event: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location: string;
}): string {
  const baseUrl = 'https://calendar.google.com/calendar/render';
  const text = encodeURIComponent(event.title);
  const dates = `${formatDateForGoogleCalendar(event.startDate)}/${formatDateForGoogleCalendar(event.endDate)}`;
  const details = encodeURIComponent(event.description);
  const location = encodeURIComponent(event.location);

  return `${baseUrl}?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

function formatDateForGoogleCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateIcsBuffer(event: {
  title: string;
  startDate: Date;
  endDate: Date;
  description: string;
  location: string;
  organizerName: string;
  organizerEmail: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const start: [number, number, number, number, number] = [
      event.startDate.getUTCFullYear(),
      event.startDate.getUTCMonth() + 1,
      event.startDate.getUTCDate(),
      event.startDate.getUTCHours(),
      event.startDate.getUTCMinutes(),
    ];
    const end: [number, number, number, number, number] = [
      event.endDate.getUTCFullYear(),
      event.endDate.getUTCMonth() + 1,
      event.endDate.getUTCDate(),
      event.endDate.getUTCHours(),
      event.endDate.getUTCMinutes(),
    ];

    createEvent(
      {
        start,
        end,
        startInputType: 'utc',
        startOutputType: 'utc',
        endInputType: 'utc',
        endOutputType: 'utc',
        calName: `${event.title} (Africa/Lagos)`,
        title: event.title,
        description: event.description,
        location: event.location,
        organizer: { name: event.organizerName, email: event.organizerEmail },
      },
      (error, value) => {
        if (error) {
          reject(error);
        } else {
          resolve(Buffer.from(value, 'utf-8'));
        }
      },
    );
  });
}
