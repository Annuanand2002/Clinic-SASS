const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const {
  getStaff,
  createStaffHandler,
  updateStaffHandler,
  deleteStaffHandler
} = require('../controllers/staffController');

const router = express.Router();

router.get('/', authRequired, resolveClinicContext, requireElevatedRole, getStaff);
router.post('/', authRequired, resolveClinicContext, requireElevatedRole, createStaffHandler);
router.put('/:id', authRequired, resolveClinicContext, requireElevatedRole, updateStaffHandler);
router.delete('/:id', authRequired, resolveClinicContext, requireElevatedRole, deleteStaffHandler);

module.exports = router;
