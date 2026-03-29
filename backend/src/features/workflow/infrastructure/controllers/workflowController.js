'use strict';

const { getPool } = require('../../../../core/db/pool');
const { scopeFromReq } = require('../../../../core/clinic/clinicScope');
const { listSupportedEntityTypes } = require('../../../../core/workflow/entityBinding');
const {
  getWorkflowState,
  transitionEntity
} = require('../../application/workflowEngine');

function parsePositiveId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function normalizeEntityType(raw) {
  const s = raw != null ? String(raw).trim().toLowerCase() : '';
  const allowed = new Set(listSupportedEntityTypes());
  if (!allowed.has(s)) return null;
  return s;
}

async function getEntityWorkflowStateHandler(req, res, next) {
  const entityType = normalizeEntityType(req.params.entityType);
  const entityId = parsePositiveId(req.params.entityId);
  if (!entityType) {
    return res.status(400).json({
      message: `entityType must be one of: ${listSupportedEntityTypes().join(', ')}`
    });
  }
  if (entityId == null) {
    return res.status(400).json({ message: 'Invalid entity id' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const state = await getWorkflowState(conn, entityType, entityId, scopeFromReq(req), {
      user: {
        id: req.auth && req.auth.sub ? Number(req.auth.sub) : null,
        role: req.clinicContext && req.clinicContext.roleName
      },
      historyLimit: Math.min(200, Math.max(1, Number(req.query.historyLimit) || 80))
    });
    return res.json(state);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    return next(err);
  } finally {
    conn.release();
  }
}

async function postEntityWorkflowTransitionHandler(req, res, next) {
  const entityType = normalizeEntityType(req.params.entityType);
  const entityId = parsePositiveId(req.params.entityId);
  if (!entityType) {
    return res.status(400).json({
      message: `entityType must be one of: ${listSupportedEntityTypes().join(', ')}`
    });
  }
  if (entityId == null) {
    return res.status(400).json({ message: 'Invalid entity id' });
  }

  const body = req.body || {};
  const toNodeId = Number(body.toNodeId);
  if (!Number.isFinite(toNodeId) || toNodeId < 1) {
    return res.status(400).json({ message: 'toNodeId is required and must be a positive integer' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await transitionEntity(conn, entityType, entityId, scopeFromReq(req), {
      toNodeId,
      message: body.message == null ? null : String(body.message).trim() || null,
      context: body.context && typeof body.context === 'object' ? body.context : {},
      user: {
        id: req.auth && req.auth.sub ? Number(req.auth.sub) : null,
        role: req.clinicContext && req.clinicContext.roleName
      }
    });
    await conn.commit();

    const readConn = await pool.getConnection();
    try {
      const state = await getWorkflowState(readConn, entityType, entityId, scopeFromReq(req), {
        user: {
          id: req.auth && req.auth.sub ? Number(req.auth.sub) : null,
          role: req.clinicContext && req.clinicContext.roleName
        }
      });
      return res.json({ message: 'Transition applied', ...state });
    } finally {
      readConn.release();
    }
  } catch (err) {
    await conn.rollback();
    if (err.statusCode) {
      return res.status(err.statusCode).json({ message: err.message });
    }
    return next(err);
  } finally {
    conn.release();
  }
}

module.exports = {
  getEntityWorkflowStateHandler,
  postEntityWorkflowTransitionHandler
};
