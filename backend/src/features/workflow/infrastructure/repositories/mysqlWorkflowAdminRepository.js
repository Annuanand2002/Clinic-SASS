'use strict';

const { listSupportedEntityTypes } = require('../../../../core/workflow/entityBinding');

const NODE_TYPES = new Set(['start', 'state', 'action', 'decision', 'end']);

function parseJsonField(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function mapWorkflowRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || '',
    entityType: row.entity_type || '',
    isActive: !!row.is_active,
    createdAt: row.created_at || null
  };
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
    positionX: row.position_x != null ? Number(row.position_x) : 0,
    positionY: row.position_y != null ? Number(row.position_y) : 0
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

async function listWorkflows(conn, entityTypeFilter) {
  let sql = `SELECT id, name, entity_type, is_active, created_at FROM workflow WHERE 1=1`;
  const params = [];
  if (entityTypeFilter) {
    sql += ` AND entity_type = ?`;
    params.push(String(entityTypeFilter));
  }
  sql += ` ORDER BY entity_type ASC, id ASC`;
  const [rows] = await conn.query(sql, params);
  return (rows || []).map(mapWorkflowRow).filter(Boolean);
}

async function getWorkflowById(conn, workflowId) {
  const [rows] = await conn.query(
    `SELECT id, name, entity_type, is_active, created_at FROM workflow WHERE id = ? LIMIT 1`,
    [Number(workflowId)]
  );
  return mapWorkflowRow(rows && rows[0]);
}

async function createWorkflow(conn, { name, entityType }) {
  const et = String(entityType || '')
    .trim()
    .toLowerCase();
  if (!listSupportedEntityTypes().includes(et)) {
    const err = new Error(`entityType must be one of: ${listSupportedEntityTypes().join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const [dupRows] = await conn.query(
    `SELECT id FROM workflow WHERE entity_type = ? LIMIT 1`,
    [et]
  );
  if (dupRows && dupRows.length) {
    const err = new Error(
      `A workflow already exists for entity type "${et}". Only one workflow per entity type is allowed.`
    );
    err.statusCode = 409;
    throw err;
  }

  const nm = name != null ? String(name).trim().slice(0, 100) : 'New workflow';
  const [ins] = await conn.query(
    `INSERT INTO workflow (name, entity_type, is_active) VALUES (?, ?, 0)`,
    [nm || 'New workflow', et]
  );
  const wid = Number(ins.insertId);
  await conn.query(
    `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
     VALUES (?, 'start', 'start', 'Start', NULL, 0, 0)`,
    [wid]
  );
  return getWorkflowById(conn, wid);
}

async function patchWorkflow(conn, workflowId, { name, isActive }) {
  const wf = await getWorkflowById(conn, workflowId);
  if (!wf) {
    const err = new Error('Workflow not found');
    err.statusCode = 404;
    throw err;
  }
  const updates = [];
  const params = [];
  if (name != null) {
    updates.push('name = ?');
    params.push(String(name).trim().slice(0, 100));
  }
  if (typeof isActive === 'boolean') {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  if (!updates.length) return wf;
  params.push(Number(workflowId));
  await conn.query(`UPDATE workflow SET ${updates.join(', ')} WHERE id = ?`, params);

  if (isActive === true) {
    await conn.query(
      `UPDATE workflow SET is_active = 0 WHERE entity_type = ? AND id <> ?`,
      [wf.entityType, Number(workflowId)]
    );
  }

  return getWorkflowById(conn, workflowId);
}

async function getFullGraph(conn, workflowId) {
  const wf = await getWorkflowById(conn, workflowId);
  if (!wf) {
    const err = new Error('Workflow not found');
    err.statusCode = 404;
    throw err;
  }
  const [nodeRows] = await conn.query(
    `SELECT id, workflow_id, node_type, name, label, config, position_x, position_y
     FROM workflow_node WHERE workflow_id = ? ORDER BY id ASC`,
    [Number(workflowId)]
  );
  const [edgeRows] = await conn.query(
    `SELECT id, workflow_id, from_node_id, to_node_id, condition_json
     FROM workflow_edge WHERE workflow_id = ? ORDER BY id ASC`,
    [Number(workflowId)]
  );
  return {
    workflow: wf,
    nodes: (nodeRows || []).map(mapNodeRow).filter(Boolean),
    edges: (edgeRows || []).map(mapEdgeRow).filter(Boolean)
  };
}

async function countEntitiesReferencingNodes(conn, nodeIds) {
  if (!nodeIds.length) return 0;
  const placeholders = nodeIds.map(() => '?').join(',');
  const [c1] = await conn.query(
    `SELECT COUNT(*) AS c FROM complaint WHERE current_node_id IN (${placeholders})`,
    nodeIds
  );
  const [c2] = await conn.query(
    `SELECT COUNT(*) AS c FROM appointment WHERE current_node_id IN (${placeholders})`,
    nodeIds
  );
  return Number((c1 && c1[0] && c1[0].c) || 0) + Number((c2 && c2[0] && c2[0].c) || 0);
}

/**
 * Replace graph: upsert nodes (temp negative ids -> insert), replace all edges, delete removed nodes.
 * @param {import('mysql2/promise').PoolConnection} conn
 */
async function saveFullGraph(conn, workflowId, { nodes, edges }) {
  const wf = await getWorkflowById(conn, workflowId);
  if (!wf) {
    const err = new Error('Workflow not found');
    err.statusCode = 404;
    throw err;
  }
  const wid = Number(workflowId);

  if (!Array.isArray(nodes) || !nodes.length) {
    const err = new Error('At least one node is required');
    err.statusCode = 400;
    throw err;
  }

  const idMap = new Map();
  const normalizedNodes = [];
  const seenTempIds = new Set();

  for (const n of nodes) {
    const nodeType = String(n.nodeType || n.node_type || '').toLowerCase();
    if (!NODE_TYPES.has(nodeType)) {
      const err = new Error(`Invalid node_type: ${nodeType}`);
      err.statusCode = 400;
      throw err;
    }
    let rawId = n.id != null ? Number(n.id) : null;
    if (rawId != null && !Number.isFinite(rawId)) rawId = null;
    const name = n.name != null ? String(n.name).slice(0, 100) : null;
    const label = n.label != null ? String(n.label).slice(0, 100) : null;
    const posX = Math.round(Number(n.positionX ?? n.position_x ?? 0)) || 0;
    const posY = Math.round(Number(n.positionY ?? n.position_y ?? 0)) || 0;
    let config = n.config;
    if (config != null && typeof config !== 'object') {
      const err = new Error('config must be an object');
      err.statusCode = 400;
      throw err;
    }
    const configJson = config == null ? null : JSON.stringify(config);
    normalizedNodes.push({
      rawId,
      nodeType,
      name,
      label,
      configJson,
      posX,
      posY
    });
  }

  const starts = normalizedNodes.filter((n) => n.nodeType === 'start');
  if (starts.length !== 1) {
    const err = new Error('Workflow must have exactly one start node');
    err.statusCode = 400;
    throw err;
  }

  const [existingRows] = await conn.query(`SELECT id FROM workflow_node WHERE workflow_id = ?`, [wid]);
  const existingIds = new Set((existingRows || []).map((r) => Number(r.id)));

  for (const n of normalizedNodes) {
    if (n.rawId != null && n.rawId > 0) {
      if (!existingIds.has(n.rawId)) {
        const err = new Error(`Node id ${n.rawId} does not belong to this workflow`);
        err.statusCode = 400;
        throw err;
      }
      await conn.query(
        `UPDATE workflow_node SET node_type = ?, name = ?, label = ?, config = ?, position_x = ?, position_y = ?
         WHERE id = ? AND workflow_id = ?`,
        [n.nodeType, n.name, n.label, n.configJson, n.posX, n.posY, n.rawId, wid]
      );
      idMap.set(n.rawId, n.rawId);
    } else {
      if (n.rawId == null || n.rawId >= 0) {
        const err = new Error('New nodes must use a negative temporary id (e.g. -1, -2) for save');
        err.statusCode = 400;
        throw err;
      }
      if (seenTempIds.has(n.rawId)) {
        const err = new Error(`Duplicate temporary node id ${n.rawId}`);
        err.statusCode = 400;
        throw err;
      }
      seenTempIds.add(n.rawId);
      const [ins] = await conn.query(
        `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [wid, n.nodeType, n.name, n.label, n.configJson, n.posX, n.posY]
      );
      const newId = Number(ins.insertId);
      idMap.set(n.rawId, newId);
    }
  }

  function resolveEndpoint(v) {
    const num = Number(v);
    if (!Number.isFinite(num)) return null;
    if (num < 0) {
      const mapped = idMap.get(num);
      if (mapped == null) {
        const err = new Error(`Unresolved temporary node id ${num} in edge`);
        err.statusCode = 400;
        throw err;
      }
      return mapped;
    }
    return num;
  }

  if (!Array.isArray(edges)) {
    const err = new Error('edges must be an array');
    err.statusCode = 400;
    throw err;
  }

  const resolvedEdges = [];
  for (const e of edges) {
    const fromId = resolveEndpoint(e.fromNodeId ?? e.from_node_id);
    const toId = resolveEndpoint(e.toNodeId ?? e.to_node_id);
    if (fromId == null || toId == null || fromId < 1 || toId < 1) {
      const err = new Error('Each edge requires valid fromNodeId and toNodeId');
      err.statusCode = 400;
      throw err;
    }
    let cond = e.conditionJson ?? e.condition_json;
    if (cond != null && typeof cond !== 'object') {
      const err = new Error('conditionJson must be an object or null');
      err.statusCode = 400;
      throw err;
    }
    const conditionJson = cond == null ? null : JSON.stringify(cond);
    resolvedEdges.push({ fromId, toId, conditionJson });
  }

  const finalNodeIds = new Set([...idMap.values()].filter((v) => v > 0));

  const toRemove = [...existingIds].filter((id) => !finalNodeIds.has(id));
  if (toRemove.length) {
    const refCount = await countEntitiesReferencingNodes(conn, toRemove);
    if (refCount > 0) {
      const err = new Error('Cannot remove nodes that are still referenced by complaints or appointments');
      err.statusCode = 409;
      throw err;
    }
  }

  await conn.query(`DELETE FROM workflow_edge WHERE workflow_id = ?`, [wid]);

  if (toRemove.length) {
    const ph = toRemove.map(() => '?').join(',');
    await conn.query(`DELETE FROM workflow_node WHERE workflow_id = ? AND id IN (${ph})`, [wid, ...toRemove]);
  }

  for (const e of resolvedEdges) {
    await conn.query(
      `INSERT INTO workflow_edge (workflow_id, from_node_id, to_node_id, condition_json) VALUES (?, ?, ?, ?)`,
      [wid, e.fromId, e.toId, e.conditionJson]
    );
  }

  return getFullGraph(conn, wid);
}

module.exports = {
  listWorkflows,
  getWorkflowById,
  createWorkflow,
  patchWorkflow,
  getFullGraph,
  saveFullGraph
};
