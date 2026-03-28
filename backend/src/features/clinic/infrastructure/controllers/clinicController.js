const {
  listClinicsByOrganization,
  getClinicByIdForOrganization,
  createClinic,
  updateClinic,
  deleteClinic
} = require('../repositories/mysqlClinicRepository');

async function listClinics(req, res, next) {
  try {
    const clinics = await listClinicsByOrganization(req.organizationId);
    return res.json({ clinics });
  } catch (err) {
    return next(err);
  }
}

async function getClinic(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid clinic id' });
    }
    const clinic = await getClinicByIdForOrganization(id, req.organizationId);
    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }
    return res.json({ clinic });
  } catch (err) {
    return next(err);
  }
}

async function postClinic(req, res, next) {
  try {
    const body = req.body || {};
    const clinic = await createClinic(
      {
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email
      },
      req.organizationId
    );
    return res.status(201).json({ clinic });
  } catch (err) {
    return next(err);
  }
}

async function putClinic(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid clinic id' });
    }
    const body = req.body || {};
    const clinic = await updateClinic(
      id,
      {
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email
      },
      req.organizationId
    );
    return res.json({ clinic });
  } catch (err) {
    return next(err);
  }
}

async function removeClinic(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ message: 'Invalid clinic id' });
    }
    const result = await deleteClinic(id, req.organizationId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listClinics,
  getClinic,
  postClinic,
  putClinic,
  removeClinic
};
