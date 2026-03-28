const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const {
  getAppointments,
  createAppointmentHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler
} = require('../controllers/appointmentController');

const router = express.Router();

router.get('/', authRequired, resolveClinicContext, getAppointments);
router.post('/', authRequired, resolveClinicContext, createAppointmentHandler);
router.put('/:id', authRequired, resolveClinicContext, updateAppointmentHandler);
router.delete('/:id', authRequired, resolveClinicContext, deleteAppointmentHandler);

module.exports = router;
