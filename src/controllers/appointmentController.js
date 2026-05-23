import { validationResult } from 'express-validator';
import { format, isBefore, startOfDay, parseISO } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import prisma from '../config/db.js';
import { createEvent, updateEvent, cancelEvent } from '../services/googleCalendarService.js';
import { formatResponse } from '../utils/responseHelper.js';

const TIMEZONE = 'America/Toronto';

const getFirstName = (fullName) => {
  if (!fullName) return '';
  return fullName.split(' ')[0];
};

const isDateInPast = (dateStr) => {
  const today = toDate(new Date(), { timeZone: TIMEZONE });
  const targetDate = toDate(`${dateStr}T00:00:00`, { timeZone: TIMEZONE });
  return isBefore(targetDate, startOfDay(today));
};

const formatSpeakableDate = (dateStr) => {
  const date = toDate(`${dateStr}T00:00:00`, { timeZone: TIMEZONE });
  return format(date, 'EEEE, MMMM do');
};

const formatSpeakableTime = (timeStr) => {
  const [hour, minute] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hour, 10));
  date.setMinutes(parseInt(minute, 10));
  return format(date, 'h:mm a');
};

export const bookAppointment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map(e => e.msg).join('. ');
      return res.status(400).json(formatResponse(
        false,
        `I'm missing some information to complete the booking. ${msg}`,
        null,
        'VALIDATION_ERROR'
      ));
    }

    const { patientName, patientEmail, patientPhone, reason, appointmentDate, appointmentTime } = req.body;
    const firstName = getFirstName(patientName);

    if (isDateInPast(appointmentDate)) {
      return res.status(400).json(formatResponse(
        false,
        "I'm sorry, I can only book appointments for future dates. What date works for you?",
        null,
        "PAST_DATE_NOT_ALLOWED"
      ));
    }

    // Check if slot is taken
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        appointmentDate,
        appointmentTime,
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        }
      }
    });

    if (existingAppointment) {
      return res.status(400).json(formatResponse(
        false,
        "I'm sorry, that time slot is already taken. Could you choose a different time?",
        null,
        "SLOT_ALREADY_BOOKED"
      ));
    }

    // Find or Create Patient (Lead)
    let patient = await prisma.patient.findUnique({
      where: { phone: patientPhone }
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: patientName,
          email: patientEmail || null,
          phone: patientPhone
        }
      });
    } else {
      // Optionally update name/email if they provided new ones
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: {
          name: patientName,
          email: patientEmail || patient.email
        }
      });
    }

    const tempAppointment = {
      reason,
      appointmentDate,
      appointmentTime
    };

    let googleEventId = null;
    let googleMeetLink = null;
    let syncFailed = false;

    try {
      const gcalData = await createEvent(tempAppointment, patient);
      googleEventId = gcalData.googleEventId;
      googleMeetLink = gcalData.googleMeetLink;
    } catch (error) {
      console.error('Calendar sync error during booking:', error);
      syncFailed = true;
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        reason,
        appointmentDate,
        appointmentTime,
        status: 'SCHEDULED',
        googleEventId,
        googleMeetLink
      },
      include: {
        patient: true
      }
    });

    const speakableDate = formatSpeakableDate(appointmentDate);
    const speakableTime = formatSpeakableTime(appointmentTime);

    if (syncFailed) {
      return res.status(201).json(formatResponse(
        true,
        `Your appointment is booked! We had a small issue syncing with our calendar, but our team will sort it out. You're confirmed for ${speakableDate} at ${speakableTime}.`,
        appointment
      ));
    }

    return res.status(201).json(formatResponse(
      true,
      `You're all set, ${firstName}! Your appointment is booked for ${speakableDate} at ${speakableTime}. We look forward to seeing you at BrightSmile Dental Clinic!`,
      appointment
    ));
  } catch (error) {
    next(error);
  }
};

export const lookupAppointment = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json(formatResponse(
        false,
        "I need a phone number to look up your appointments.",
        null,
        "VALIDATION_ERROR"
      ));
    }

    const patient = await prisma.patient.findUnique({
      where: { phone }
    });

    if (!patient) {
       return res.status(200).json(formatResponse(
        true,
        "I don't see any upcoming appointments linked to that phone number. Would you like to book one?",
        []
      ));
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: patient.id,
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        }
      },
      orderBy: [
        { appointmentDate: 'asc' },
        { appointmentTime: 'asc' }
      ],
      include: {
        patient: true
      }
    });

    if (appointments.length === 0) {
      return res.status(200).json(formatResponse(
        true,
        "I don't see any upcoming appointments linked to that phone number. Would you like to book one?",
        []
      ));
    }

    const nextAppt = appointments[0];
    const speakableDate = formatSpeakableDate(nextAppt.appointmentDate);
    const speakableTime = formatSpeakableTime(nextAppt.appointmentTime);

    return res.status(200).json(formatResponse(
      true,
      `I found ${appointments.length} upcoming appointment(s) for you. Your next appointment is on ${speakableDate} at ${speakableTime}.`,
      appointments
    ));
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({ 
      where: { id },
      include: { patient: true }
    });

    if (!appointment) {
      return res.status(404).json(formatResponse(
        false,
        "I couldn't find that appointment in our system. Could you double-check the details?",
        null,
        "APPOINTMENT_NOT_FOUND"
      ));
    }

    if (appointment.status === 'CANCELLED') {
      return res.status(400).json(formatResponse(
        false,
        "It looks like this appointment has already been cancelled. Is there anything else I can help you with?",
        null,
        "APPOINTMENT_ALREADY_CANCELLED"
      ));
    }

    if (appointment.googleEventId) {
      try {
        await cancelEvent(appointment.googleEventId);
      } catch (error) {
        console.error('Failed to cancel Google Calendar event:', error);
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason || null
      },
      include: { patient: true }
    });

    const speakableDate = formatSpeakableDate(updatedAppointment.appointmentDate);
    const speakableTime = formatSpeakableTime(updatedAppointment.appointmentTime);

    return res.status(200).json(formatResponse(
      true,
      `Done! Your appointment on ${speakableDate} at ${speakableTime} has been cancelled. We hope to see you again soon. Just give us a call whenever you're ready to rebook!`,
      updatedAppointment
    ));
  } catch (error) {
    next(error);
  }
};

export const rescheduleAppointment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const msg = errors.array().map(e => e.msg).join('. ');
      return res.status(400).json(formatResponse(
        false,
        `I'm missing some information to complete the rescheduling. ${msg}`,
        null,
        'VALIDATION_ERROR'
      ));
    }

    const { id } = req.params;
    const { newDate, newTime } = req.body;

    const appointment = await prisma.appointment.findUnique({ 
      where: { id },
      include: { patient: true }
    });

    if (!appointment) {
      return res.status(404).json(formatResponse(
        false,
        "I couldn't find that appointment in our system. Could you double-check the details?",
        null,
        "APPOINTMENT_NOT_FOUND"
      ));
    }

    if (isDateInPast(newDate)) {
      return res.status(400).json(formatResponse(
        false,
        "I can only reschedule to a future date. What date would you prefer?",
        null,
        "PAST_DATE_NOT_ALLOWED"
      ));
    }

    // Check if new slot is taken
    const existingAppointment = await prisma.appointment.findFirst({
      where: {
        appointmentDate: newDate,
        appointmentTime: newTime,
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        },
        id: {
          not: id // Exclude current appointment
        }
      }
    });

    if (existingAppointment) {
      return res.status(400).json(formatResponse(
        false,
        "I'm sorry, that new time slot is also taken. Could you suggest another time that works for you?",
        null,
        "SLOT_ALREADY_BOOKED"
      ));
    }

    if (appointment.googleEventId) {
      try {
        await updateEvent(appointment.googleEventId, newDate, newTime);
      } catch (error) {
        console.error('Failed to update Google Calendar event:', error);
      }
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        appointmentDate: newDate,
        appointmentTime: newTime
      },
      include: { patient: true }
    });

    const firstName = getFirstName(updatedAppointment.patient.name);
    const speakableDate = formatSpeakableDate(newDate);
    const speakableTime = formatSpeakableTime(newTime);

    return res.status(200).json(formatResponse(
      true,
      `Great news, ${firstName}! Your appointment has been moved to ${speakableDate} at ${speakableTime}. See you then!`,
      updatedAppointment
    ));
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({ 
      where: { id },
      include: { patient: true }
    });

    if (!appointment) {
      return res.status(404).json(formatResponse(
        false,
        "I couldn't find an appointment with that ID.",
        null,
        "APPOINTMENT_NOT_FOUND"
      ));
    }

    const speakableDate = formatSpeakableDate(appointment.appointmentDate);
    const speakableTime = formatSpeakableTime(appointment.appointmentTime);

    return res.status(200).json(formatResponse(
      true,
      `Here are your appointment details: ${appointment.reason} on ${speakableDate} at ${speakableTime}. Your status is ${appointment.status.toLowerCase()}.`,
      appointment
    ));
  } catch (error) {
    next(error);
  }
};
