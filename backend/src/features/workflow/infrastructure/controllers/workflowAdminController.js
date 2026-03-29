'use strict';

const { getPool } = require('../../../../core/db/pool');
const { listSupportedEntityTypes } = require('../../../../core/workflow/entityBinding');
const adminRepo = require('../repositories/mysqlWorkflowAdminRepository');

function parsePositiveId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function normalizeEntityTypeQuery(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim().toLowerCase();
  if (!listSupportedEntityTypes().includes(s)) return null;
  return s;
}

async function listWorkflowsHandler(req, res, next) {
  const entityType = normalizeEntityTypeQuery(req.query.entityType);
  if (req.query.entityType != null && String(req.query.entityType).trim() !== '' && entityType == null) {
    return res.status(400).json({
      message: `entityType must be one of: ${listSupportedEntityTypes().join(', ')}`
    });
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const list = await adminRepo.listWorkflows(conn, entityType);
    return res.json({ workflows: list });
  } catch (err) {
    return next(err);
  } finally {
    conn.release();
  }
}

async function postWorkflowHandler(req, res, next) {
  const body = req.body || {};
  const name = body.name;
  const entityType = body.entityType != null ? String(body.entityType).trim().toLowerCase() : '';
  if (!listSupportedEntityTypes().includes(entityType)) {
    return res.status(400).json({
      message: `entityType must be one of: ${listSupportedEntityTypes().join(', ')}`
    });
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const wf = await adminRepo.createWorkflow(conn, { name, entityType });
    await conn.commit();
    return res.status(201).json(wf);
  } catch (err) {
    await conn.rollback();
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    return next(err);
  } finally {
    conn.release();
  }
}

async function patchWorkflowHandler(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: 'Invalid workflow id' });
  const body = req.body || {};
  const patch = {};
  if (body.name != null) patch.name = body.name;
  if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
  if (!Object.keys(patch).length) {
    return res.status(400).json({ message: 'Provide name and/or isActive' });
  }
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const wf = await adminRepo.patchWorkflow(conn, id, patch);
    await conn.commit();
    return res.json(wf);
  } catch (err) {
    await conn.rollback();
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    return next(err);
  } finally {
    conn.release();
  }
}

async function getWorkflowGraphHandler(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: 'Invalid workflow id' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const graph = await adminRepo.getFullGraph(conn, id);
    return res.json(graph);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    return next(err);
  } finally {
    conn.release();
  }
}

async function putWorkflowGraphHandler(req, res, next) {
  const id = parsePositiveId(req.params.id);
  if (id == null) return res.status(400).json({ message: 'Invalid workflow id' });
  const body = req.body || {};
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const graph = await adminRepo.saveFullGraph(conn, id, {
      nodes: body.nodes,
      edges: body.edges
    });
    await conn.commit();
    return res.json(graph);
  } catch (err) {
    await conn.rollback();
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    return next(err);
  } finally {
    conn.release();
  }
}

module.exports = {
  listWorkflowsHandler,
  postWorkflowHandler,
  patchWorkflowHandler,
  getWorkflowGraphHandler,
  putWorkflowGraphHandler
};
