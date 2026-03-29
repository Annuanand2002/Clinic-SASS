'use strict';

const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const { requireElevatedRole, requireStaffRole } = require('../../../../web/middleware/roleMiddleware');
const {
  createComplaintHandler,
  listComplaintsHandler,
  getComplaintHandler,
  updateComplaintHandler,
  updateComplaintStatusHandler,
  assignComplaintHandler,
  addComplaintUpdateHandler,
  deleteComplaintHandler
} = require('../controllers/complaintController');

const router = express.Router();

router.get('/', authRequired, resolveClinicContext, listComplaintsHandler);
router.post('/', authRequired, resolveClinicContext, requireStaffRole, createComplaintHandler);
router.patch('/:id/status', authRequired, resolveClinicContext, requireElevatedRole, updateComplaintStatusHandler);
router.patch('/:id/assign', authRequired, resolveClinicContext, requireElevatedRole, assignComplaintHandler);
router.post('/:id/updates', authRequired, resolveClinicContext, requireElevatedRole, addComplaintUpdateHandler);
router.get('/:id', authRequired, resolveClinicContext, getComplaintHandler);
router.patch('/:id', authRequired, resolveClinicContext, requireElevatedRole, updateComplaintHandler);
router.delete('/:id', authRequired, resolveClinicContext, requireElevatedRole, deleteComplaintHandler);

module.exports = router;
