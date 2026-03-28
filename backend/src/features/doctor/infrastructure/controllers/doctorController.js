const {
  listDoctors,
  createDoctor,
  updateDoctor,
  deleteDoctor
} = require('../repositories/mysqlDoctorRepository');
const { scopeFromReq, rejectIfClinicScopeAllCreate } = require('../../../../core/clinic/clinicScope');

async function getDoctors(req, res, next) {
  try {
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const activeOnly =
      req.query.activeOnly === '1' ||
      String(req.query.activeOnly || '').toLowerCase() === 'true';
    const result = await listDoctors(page, limit, q, activeOnly, scopeFromReq(req));
    return res.json({
      doctors: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function createDoctorHandler(req, res, next) {
  try {
    if (rejectIfClinicScopeAllCreate(req, res)) return;
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const activeOnly =
      req.query.activeOnly === '1' ||
      String(req.query.activeOnly || '').toLowerCase() === 'true';
    await createDoctor(payload, actorId, req.clinicId);
    const result = await listDoctors(page, limit, q, activeOnly, scopeFromReq(req));
    return res.status(201).json({
      message: 'Doctor created successfully',
      doctors: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function updateDoctorHandler(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const doctorId = Number(req.params.id);
    const payload = req.body || {};
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const activeOnly =
      req.query.activeOnly === '1' ||
      String(req.query.activeOnly || '').toLowerCase() === 'true';
    await updateDoctor(doctorId, payload, actorId, scopeFromReq(req));
    const result = await listDoctors(page, limit, q, activeOnly, scopeFromReq(req));
    return res.json({
      message: 'Doctor updated successfully',
      doctors: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteDoctorHandler(req, res, next) {
  try {
    const doctorId = Number(req.params.id);
    const page = req.query.page;
    const limit = req.query.limit;
    const q = req.query.q;
    const activeOnly =
      req.query.activeOnly === '1' ||
      String(req.query.activeOnly || '').toLowerCase() === 'true';
    await deleteDoctor(doctorId, scopeFromReq(req));
    const result = await listDoctors(page, limit, q, activeOnly, scopeFromReq(req));
    return res.json({
      message: 'Doctor deleted successfully',
      doctors: result.rows,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDoctors,
  createDoctorHandler,
  updateDoctorHandler,
  deleteDoctorHandler
};
