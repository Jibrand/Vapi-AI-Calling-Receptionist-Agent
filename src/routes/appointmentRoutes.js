import { Router } from 'express';
import { body } from 'express-validator';
import {
  bookAppointment,
  lookupAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAppointment
} from '../controllers/appointmentController.js';

const router = Router();

// 1. POST /api/appointments/book
router.post(
  '/book',
  [
    body('patientName').notEmpty().withMessage('patientName is required'),
    body('patientPhone').notEmpty().withMessage('patientPhone is required'),
    body('reason').notEmpty().withMessage('reason is required'),
    body('appointmentDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('appointmentDate must be in YYYY-MM-DD format'),
    body('appointmentTime').matches(/^\d{2}:\d{2}$/).withMessage('appointmentTime must be in HH:MM format'),
  ],
  bookAppointment
);

// 2. GET /api/appointments/lookup?phone=...
router.get('/lookup', lookupAppointment);

// 3. PUT /api/appointments/:id/cancel
router.put(
  '/:id/cancel',
  [
    body('reason').optional().isString()
  ],
  cancelAppointment
);

// 4. PUT /api/appointments/:id/reschedule
router.put(
  '/:id/reschedule',
  [
    body('newDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('newDate must be in YYYY-MM-DD format'),
    body('newTime').matches(/^\d{2}:\d{2}$/).withMessage('newTime must be in HH:MM format'),
  ],
  rescheduleAppointment
);

// 5. GET /api/appointments/:id
router.get('/:id', getAppointment);

export default router;
