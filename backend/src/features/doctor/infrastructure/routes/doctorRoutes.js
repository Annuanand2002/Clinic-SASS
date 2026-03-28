const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const {
  getDoctors,
  createDoctorHandler,
  updateDoctorHandler,
  deleteDoctorHandler
} = require('../controllers/doctorController');

const router = express.Router();

router.get('/', authRequired, resolveClinicContext, getDoctors);
router.post('/', authRequired, resolveClinicContext, createDoctorHandler);
router.put('/:id', authRequired, resolveClinicContext, updateDoctorHandler);
router.delete('/:id', authRequired, resolveClinicContext, deleteDoctorHandler);

module.exports = router;
