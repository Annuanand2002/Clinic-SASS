'use strict';

const { sqlClinicColumn } = require('../../../../core/clinic/clinicScope');
const { getEntityBinding } = require('../../../../core/workflow/entityBinding');

function parseJsonField(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function mapNodeRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    nodeType: row.node_type,
    name: row.name || null,
    label: row.label || null,
    config: parseJsonField(row.config) || {},
    positionX: row.position_x != null ? Number(row.position_x) : null,
    positionY: row.position_y != null ? Number(row.position_y) : null
  };
}

function mapEdgeRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    workflowId: Number(row.workflow_id),
    fromNodeId: row.from_node_id != null ? Number(row.from_node_id) : null,
    toNodeId: row.to_node_id != null ? Number(row.to_node_id) : null,
    conditionJson: parseJsonField(row.condition_json)
  };
}

async function getActiveWorkflowForEntityType(conn, entityType) {
  const [rows] = await conn.query(
    `SELECT id, name, entity_type AS entityType, is_active AS isActive
     FROM workflow
     WHERE entity_type = ? AND is_active = 1
     ORDER BY id ASC
     LIMIT 1`,
    [String(entityType)]
  );
  const r = rows && rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    name: r.name || '',
    entityType: r.entityType || '',
    isActive: !!r.isActive
  };
}

async function findStartNodeId(conn, workflowId) {
  const [rows] = await conn.query(
    `SELECT id FROM workflow_node
     WHERE workflow_id = ? AND node_type = 'start'
     ORDER BY id ASC
     LIMIT 1`,
    [Number(workflowId)]
  );
  if (!rows?.[0]) return null;
  return Number(rows[0].id);
}

async function getNodeById(conn, nodeId) {
  const [rows] = await conn.query(
    `SELECT id, workflow_id, node_type, name, label, config, position_x, position_y
     FROM workflow_node WHERE id = ? LIMIT 1`,
    [Number(nodeId)]
  );
  return mapNodeRow(rows && rows[0]);
}

async function listEdgesFromNode(conn, workflowId, fromNodeId) {
  const [rows] = await conn.query(
    `SELECT id, workflow_id, from_node_id, to_node_id, condition_json
     FROM workflow_edge
     WHERE workflow_id = ? AND from_node_id <=> ?
     ORDER BY id ASC`,
    [Number(workflowId), fromNodeId == null ? null : Number(fromNodeId)]
  );
  return (rows || []).map(mapEdgeRow).filter(Boolean);
}

/**
 * BFS from start (or any seed) until first node_type === 'state'.
 */
async function findFirstStateNodeIdFromSeed(conn, workflowId, seedNodeId) {
  const visited = new Set();
  const queue = [Number(seedNodeId)];
  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const node = await getNodeById(conn, id);
    if (!node || node.workflowId !== Number(workflowId)) continue;
    if (node.nodeType === 'state') return id;
    const edges = await listEdgesFromNode(conn, workflowId, id);
    for (const e of edges) {
      if (e.toNodeId != null) queue.push(e.toNodeId);
    }
  }
  return null;
}

async function getEntityCurrentNodeId(binding, entityId, scope, conn) {
  const { clause, params: cParams } = sqlClinicColumn(`t.${binding.scopeColumn}`, scope);
  const [rows] = await conn.query(
    `SELECT t.${binding.currentNodeColumn} AS current_node_id
     FROM ${binding.table} t
     WHERE t.${binding.idColumn} = ? AND ${clause}
     LIMIT 1`,
    [Number(entityId), ...cParams]
  );
  if (!rows?.[0]) return undefined;
  const v = rows[0].current_node_id;
  return v == null ? null : Number(v);
}

async function setEntityCurrentNodeId(binding, entityId, nodeId, scope, conn) {
  const { clause, params: cParams } = sqlClinicColumn(`t.${binding.scopeColumn}`, scope);
  const [result] = await conn.query(
    `UPDATE ${binding.table} t
     SET t.${binding.currentNodeColumn} = ?
     WHERE t.${binding.idColumn} = ? AND ${clause}`,
    [nodeId == null ? null : Number(nodeId), Number(entityId), ...cParams]
  );
  return result.affectedRows > 0;
}

async function entityExistsInScope(binding, entityId, scope, conn) {
  const { clause, params: cParams } = sqlClinicColumn(`t.${binding.scopeColumn}`, scope);
  const [rows] = await conn.query(
    `SELECT t.${binding.idColumn} AS id FROM ${binding.table} t
     WHERE t.${binding.idColumn} = ? AND ${clause} LIMIT 1`,
    [Number(entityId), ...cParams]
  );
  return !!(rows && rows[0]);
}

async function insertWorkflowExecution(
  conn,
  { entityType, entityId, nodeId, actionTaken, message, executedBy }
) {
  await conn.query(
    `INSERT INTO workflow_execution (entity_type, entity_id, node_id, action_taken, message, executed_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      String(entityType),
      Number(entityId),
      nodeId != null ? Number(nodeId) : null,
      actionTaken || null,
      message || null,
      executedBy != null ? Number(executedBy) : null
    ]
  );
}

async function listExecutions(conn, entityType, entityId, limit = 100) {
  const lim = Math.min(500, Math.max(1, Number(limit) || 100));
  const [rows] = await conn.query(
    `SELECT e.id, e.entity_type AS entityType, e.entity_id AS entityId, e.node_id AS nodeId,
            e.action_taken AS actionTaken, e.message, e.executed_by AS executedBy, e.created_at AS createdAt,
            wn.name AS nodeName, wn.label AS nodeLabel
     FROM workflow_execution e
     LEFT JOIN workflow_node wn ON wn.id = e.node_id
     WHERE e.entity_type = ? AND e.entity_id = ?
     ORDER BY e.id DESC
     LIMIT ?`,
    [String(entityType), Number(entityId), lim]
  );
  return (rows || []).map((r) => ({
    id: Number(r.id),
    entityType: r.entityType,
    entityId: Number(r.entityId),
    nodeId: r.nodeId != null ? Number(r.nodeId) : null,
    nodeName: r.nodeName || null,
    nodeLabel: r.nodeLabel || null,
    actionTaken: r.actionTaken || null,
    message: r.message || null,
    executedBy: r.executedBy != null ? Number(r.executedBy) : null,
    createdAt: r.createdAt || null
  }));
}

/**
 * Find a direct edge from -> to (same workflow).
 */
async function findEdge(conn, workflowId, fromNodeId, toNodeId) {
  const [rows] = await conn.query(
    `SELECT id, workflow_id, from_node_id, to_node_id, condition_json
     FROM workflow_edge
     WHERE workflow_id = ? AND from_node_id <=> ? AND to_node_id = ?
     LIMIT 1`,
    [Number(workflowId), Number(fromNodeId), Number(toNodeId)]
  );
  return mapEdgeRow(rows && rows[0]);
}

async function loadComplaintEntitySnapshot(conn, entityId, scope) {
  const binding = getEntityBinding('complaint');
  const { clause, params: cParams } = sqlClinicColumn(`c.${binding.scopeColumn}`, scope);
  const [rows] = await conn.query(
    `SELECT c.id, c.status, c.priority, c.category, c.clinic_id AS clinicId
     FROM complaint c
     WHERE c.id = ? AND ${clause} LIMIT 1`,
    [Number(entityId), ...cParams]
  );
  const r = rows && rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    status: r.status,
    priority: r.priority,
    category: r.category,
    clinicId: r.clinicId != null ? Number(r.clinicId) : null
  };
}

async function loadAppointmentEntitySnapshot(conn, entityId, scope) {
  const binding = getEntityBinding('appointment');
  const { clause, params: cParams } = sqlClinicColumn(`a.${binding.scopeColumn}`, scope);
  const [rows] = await conn.query(
    `SELECT a.id, a.status, a.clinic_id AS clinicId
     FROM appointment a
     WHERE a.id = ? AND ${clause} LIMIT 1`,
    [Number(entityId), ...cParams]
  );
  const r = rows && rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    status: r.status,
    clinicId: r.clinicId != null ? Number(r.clinicId) : null
  };
}

async function loadEntitySnapshotForContext(conn, entityType, entityId, scope) {
  if (entityType === 'complaint') return loadComplaintEntitySnapshot(conn, entityId, scope);
  if (entityType === 'appointment') return loadAppointmentEntitySnapshot(conn, entityId, scope);
  return null;
}

async function applyComplaintStatusSync(conn, entityId, statusValue, scope) {
  const binding = getEntityBinding('complaint');
  const { clause, params: cParams } = sqlClinicColumn(`t.${binding.scopeColumn}`, scope);
  await conn.query(
    `UPDATE complaint t SET t.status = ? WHERE t.id = ? AND ${clause}`,
    [String(statusValue), Number(entityId), ...cParams]
  );
}

async function applyAppointmentStatusSync(conn, entityId, statusValue, scope) {
  const binding = getEntityBinding('appointment');
  const { clause, params: cParams } = sqlClinicColumn(`t.${binding.scopeColumn}`, scope);
  await conn.query(
    `UPDATE appointment t SET t.status = ? WHERE t.id = ? AND ${clause}`,
    [String(statusValue), Number(entityId), ...cParams]
  );
}

module.exports = {
  getActiveWorkflowForEntityType,
  findStartNodeId,
  getNodeById,
  listEdgesFromNode,
  findFirstStateNodeIdFromSeed,
  getEntityCurrentNodeId,
  setEntityCurrentNodeId,
  entityExistsInScope,
  insertWorkflowExecution,
  listExecutions,
  findEdge,
  loadEntitySnapshotForContext,
  applyComplaintStatusSync,
  applyAppointmentStatusSync
};
