const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const {
  getPatients,
  createPatientHandler,
  updatePatientHandler,
  deletePatientHandler,
  getPatientMedicalRecordsHandler,
  createPatientMedicalRecordHandler,
  deletePatientMedicalRecordHandler
} = require('../controllers/patientController');

const router = express.Router();

router.get('/', authRequired, resolveClinicContext, getPatients);
router.post('/', authRequired, resolveClinicContext, createPatientHandler);
router.put('/:id', authRequired, resolveClinicContext, updatePatientHandler);
router.delete('/:id', authRequired, resolveClinicContext, deletePatientHandler);
router.get('/:id/medical-records', authRequired, resolveClinicContext, getPatientMedicalRecordsHandler);
router.post('/:id/medical-records', authRequired, resolveClinicContext, createPatientMedicalRecordHandler);
router.delete('/:id/medical-records/:recordId', authRequired, resolveClinicContext, deletePatientMedicalRecordHandler);

module.exports = router;
