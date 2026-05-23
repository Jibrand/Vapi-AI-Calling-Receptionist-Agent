import { google } from 'googleapis';
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Initializes and returns the Google Calendar API client.
 */
const getCalendarClient = () => {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.warn('GOOGLE_SERVICE_ACCOUNT_KEY is not set. Google Calendar integration will be disabled.');
      return null;
    }

    // The key is provided as a base64 encoded JSON string
    const credentialsBuffer = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64');
    const credentials = JSON.parse(credentialsBuffer.toString('utf-8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error('Error initializing Google Calendar client:', error);
    return null;
  }
};

const TIMEZONE = 'America/Toronto';

/**
 * Helper to construct a proper ISO string for Google Calendar
 * using the date (YYYY-MM-DD) and time (HH:MM).
 */
const buildDateTime = (dateStr, timeStr) => {
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;
  return {
    dateTime: localDateTimeStr,
    timeZone: TIMEZONE
  };
};

/**
 * Helper to build end time (assuming 1 hour duration)
 */
const buildEndDateTime = (dateStr, timeStr) => {
  const [hour, minute] = timeStr.split(':').map(Number);
  const endHour = (hour + 1).toString().padStart(2, '0');
  const endMinute = minute.toString().padStart(2, '0');
  return {
    dateTime: `${dateStr}T${endHour}:${endMinute}:00`,
    timeZone: TIMEZONE
  };
};

export const createEvent = async (appointment, patient) => {
  const calendar = getCalendarClient();
  if (!calendar) return { googleEventId: null, googleMeetLink: null };

  const calendarId = process.env.CLINIC_GOOGLE_CALENDAR_ID;
  if (!calendarId) {
    console.warn('CLINIC_GOOGLE_CALENDAR_ID is not set.');
    return { googleEventId: null, googleMeetLink: null };
  }

  const { reason, appointmentDate, appointmentTime } = appointment;
  const { name: patientName, phone: patientPhone, email: patientEmail } = patient;

  const event = {
    summary: `Dental Appointment - ${reason} - ${patientName}`,
    description: `Patient: ${patientName}\nPhone: ${patientPhone}\nEmail: ${patientEmail || 'N/A'}\nReason: ${reason}`,
    start: buildDateTime(appointmentDate, appointmentTime),
    end: buildEndDateTime(appointmentDate, appointmentTime),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 },
      ],
    },
    // Removed conferenceData as standard gmail accounts do not support automatic Meet link creation
  };

  try {
    const response = await calendar.events.insert({
      calendarId,
      resource: event,
    });

    return {
      googleEventId: response.data.id,
      googleMeetLink: null, // Removed Meet link as it was failing for standard gmail account
    };
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    throw error;
  }
};

export const updateEvent = async (googleEventId, newDate, newTime) => {
  const calendar = getCalendarClient();
  if (!calendar) return null;

  const calendarId = process.env.CLINIC_GOOGLE_CALENDAR_ID;
  if (!calendarId) return null;

  try {
    const response = await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      resource: {
        start: buildDateTime(newDate, newTime),
        end: buildEndDateTime(newDate, newTime)
      }
    });

    return response.data;
  } catch (error) {
    console.error('Failed to update Google Calendar event:', error);
    throw error;
  }
};

export const cancelEvent = async (googleEventId) => {
  const calendar = getCalendarClient();
  if (!calendar) return null;

  const calendarId = process.env.CLINIC_GOOGLE_CALENDAR_ID;
  if (!calendarId) return null;

  try {
    await calendar.events.delete({
      calendarId,
      eventId: googleEventId,
    });
    return true;
  } catch (error) {
    console.error('Failed to cancel Google Calendar event:', error);
    throw error;
  }
};
