const {
  listAppointments,
  hasDoctorTimeConflict,
  createAppointment,
  updateAppointment,
  deleteAppointment
} = require('../repositories/mysqlAppointmentRepository');
const { scopeFromReq, rejectIfClinicScopeAllCreate } = require('../../../../core/clinic/clinicScope');

async function getAppointments(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const result = await listAppointments(
      page,
      limit,
      {
        search: req.query.q,
        date: req.query.date,
        month: req.query.month
      },
      scopeFromReq(req)
    );
    return res.json({
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function createAppointmentHandler(req, res, next) {
  try {
    if (rejectIfClinicScopeAllCreate(req, res)) return;
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;

    const hasConflict = await hasDoctorTimeConflict(
      payload.doctorId,
      payload.appointmentDate,
      payload.startTime,
      payload.endTime,
      null,
      scopeFromReq(req)
    );
    if (hasConflict) {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }

    await createAppointment(payload, req.clinicId);
    const result = await listAppointments(
      page,
      limit,
      {
        search: req.query.q,
        date: req.query.date,
        month: req.query.month
      },
      scopeFromReq(req)
    );
    return res.status(201).json({
      message: 'Appointment created successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }
    return next(err);
  }
}

async function updateAppointmentHandler(req, res, next) {
  try {
    const payload = req.body || {};
    const appointmentId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;

    const hasConflict = await hasDoctorTimeConflict(
      payload.doctorId,
      payload.appointmentDate,
      payload.startTime,
      payload.endTime,
      appointmentId,
      scopeFromReq(req)
    );
    if (hasConflict) {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }

    await updateAppointment(appointmentId, payload, scopeFromReq(req));
    const result = await listAppointments(
      page,
      limit,
      {
        search: req.query.q,
        date: req.query.date,
        month: req.query.month
      },
      scopeFromReq(req)
    );
    return res.json({
      message: 'Appointment updated successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Doctor is not available for this timeslot.' });
    }
    return next(err);
  }
}

async function deleteAppointmentHandler(req, res, next) {
  try {
    const appointmentId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;
    await deleteAppointment(appointmentId, scopeFromReq(req));
    const result = await listAppointments(
      page,
      limit,
      {
        search: req.query.q,
        date: req.query.date,
        month: req.query.month
      },
      scopeFromReq(req)
    );
    return res.json({
      message: 'Appointment deleted successfully',
      appointments: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAppointments,
  createAppointmentHandler,
  updateAppointmentHandler,
  deleteAppointmentHandler
};
