const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const { attachOrganizationContext } = require('../../../../web/middleware/organizationContextMiddleware');
const {
  listClinics,
  getClinic,
  postClinic,
  putClinic,
  removeClinic
} = require('../controllers/clinicController');

const router = express.Router();

router.get('/', authRequired, requireElevatedRole, attachOrganizationContext, listClinics);
router.get('/:id', authRequired, requireElevatedRole, attachOrganizationContext, getClinic);
router.post('/', authRequired, requireElevatedRole, attachOrganizationContext, postClinic);
router.put('/:id', authRequired, requireElevatedRole, attachOrganizationContext, putClinic);
router.delete('/:id', authRequired, requireElevatedRole, attachOrganizationContext, removeClinic);

module.exports = router;
