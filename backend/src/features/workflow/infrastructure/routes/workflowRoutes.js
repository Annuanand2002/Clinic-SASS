'use strict';

const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const {
  getEntityWorkflowStateHandler,
  postEntityWorkflowTransitionHandler
} = require('../controllers/workflowController');
const {
  listWorkflowsHandler,
  postWorkflowHandler,
  patchWorkflowHandler,
  getWorkflowGraphHandler,
  putWorkflowGraphHandler
} = require('../controllers/workflowAdminController');

const router = express.Router();

router.get(
  '/entities/:entityType/:entityId',
  authRequired,
  resolveClinicContext,
  getEntityWorkflowStateHandler
);

router.post(
  '/entities/:entityType/:entityId/transition',
  authRequired,
  resolveClinicContext,
  requireElevatedRole,
  postEntityWorkflowTransitionHandler
);

router.get('/admin/workflows', authRequired, requireElevatedRole, listWorkflowsHandler);
router.post('/admin/workflows', authRequired, requireElevatedRole, postWorkflowHandler);
router.patch('/admin/workflows/:id', authRequired, requireElevatedRole, patchWorkflowHandler);
router.get('/admin/workflows/:id/graph', authRequired, requireElevatedRole, getWorkflowGraphHandler);
router.put('/admin/workflows/:id/graph', authRequired, requireElevatedRole, putWorkflowGraphHandler);

module.exports = router;
