'use strict';

const { getEntityBinding } = require('../../../core/workflow/entityBinding');
const { evaluateCondition, roleAllowedForNode } = require('../../../core/workflow/conditionEvaluator');
const repo = require('../infrastructure/repositories/mysqlWorkflowRepository');

/**
 * Initialize workflow position with clinic/org scope (same WHERE as entity row).
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {{ singleClinicId: number|null, organizationId: number|null }} scope
 */
async function initializeEntityWorkflowScoped(conn, entityType, entityId, scope, executedByUserId) {
  const binding = getEntityBinding(entityType);
  if (!binding) return { applied: false, reason: 'unsupported_entity_type' };

  const wf = await repo.getActiveWorkflowForEntityType(conn, entityType);
  if (!wf) return { applied: false, reason: 'no_workflow' };

  const startId = await repo.findStartNodeId(conn, wf.id);
  if (!startId) return { applied: false, reason: 'no_start_node' };

  const firstStateId = await repo.findFirstStateNodeIdFromSeed(conn, wf.id, startId);
  if (!firstStateId) return { applied: false, reason: 'no_state_reachable' };

  const ok = await repo.setEntityCurrentNodeId(binding, entityId, firstStateId, scope, conn);
  if (!ok) return { applied: false, reason: 'entity_not_found' };

  await repo.insertWorkflowExecution(conn, {
    entityType,
    entityId,
    nodeId: firstStateId,
    actionTaken: 'workflow_init',
    message: 'Entered workflow (first state)',
    executedBy: executedByUserId
  });

  const node = await repo.getNodeById(conn, firstStateId);
  await applyNodeEntryEffects(conn, entityType, entityId, node, scope);

  return { applied: true, workflowId: wf.id, nodeId: firstStateId };
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 */
async function applyNodeEntryEffects(conn, entityType, entityId, node, scope) {
  if (!node || !node.config) return;
  const cfg = node.config;

  if (cfg.syncComplaintStatus && entityType === 'complaint') {
    await repo.applyComplaintStatusSync(conn, entityId, cfg.syncComplaintStatus, scope);
  }
  if (cfg.syncAppointmentStatus && entityType === 'appointment') {
    await repo.applyAppointmentStatusSync(conn, entityId, cfg.syncAppointmentStatus, scope);
  }

  if (node.nodeType === 'action' && cfg.actionType) {
    await repo.insertWorkflowExecution(conn, {
      entityType,
      entityId,
      nodeId: node.id,
      actionTaken: `action:${cfg.actionType}`,
      message: cfg.actionMessage || null,
      executedBy: null
    });
  }
}

function buildTransitionContext({ user, entitySnapshot, bodyContext }) {
  const ctx = {
    user: user
      ? {
          id: user.id,
          role: user.role || null
        }
      : {},
    entity: entitySnapshot || {},
    input: bodyContext && typeof bodyContext === 'object' ? bodyContext : {}
  };
  return ctx;
}

/**
 * @param {import('mysql2/promise').PoolConnection|null} conn - if null, uses pool and own transaction
 */
async function getWorkflowState(conn, entityType, entityId, scope, options = {}) {
  const binding = getEntityBinding(entityType);
  if (!binding) {
    const err = new Error('Unsupported entity type');
    err.statusCode = 400;
    throw err;
  }

  const exists = await repo.entityExistsInScope(binding, entityId, scope, conn);
  if (!exists) {
    const err = new Error('Entity not found');
    err.statusCode = 404;
    throw err;
  }

  const currentId = await repo.getEntityCurrentNodeId(binding, entityId, scope, conn);
  if (currentId == null) {
    return {
      entityType,
      entityId: Number(entityId),
      workflow: null,
      currentNode: null,
      nextOptions: [],
      history: await repo.listExecutions(conn, entityType, entityId, options.historyLimit || 50)
    };
  }

  const currentNode = await repo.getNodeById(conn, currentId);
  if (!currentNode) {
    const err = new Error('Current workflow node missing');
    err.statusCode = 409;
    throw err;
  }

  const wf = await repo.getActiveWorkflowForEntityType(conn, entityType);
  const edges = await repo.listEdgesFromNode(conn, currentNode.workflowId, currentId);
  const entitySnapshot = await repo.loadEntitySnapshotForContext(conn, entityType, entityId, scope);
  const baseCtx = buildTransitionContext({
    user: options.user,
    entitySnapshot,
    bodyContext: {}
  });

  const nextOptions = [];
  for (const edge of edges) {
    const target = await repo.getNodeById(conn, edge.toNodeId);
    if (!target) continue;
    const conditionMet = evaluateCondition(edge.conditionJson, baseCtx);
    const roleOk = roleAllowedForNode(target.config, options.user && options.user.role);
    nextOptions.push({
      edgeId: edge.id,
      toNodeId: edge.toNodeId,
      conditionMet,
      roleAllowed: roleOk,
      allowed: conditionMet && roleOk,
      targetNode: {
        id: target.id,
        nodeType: target.nodeType,
        name: target.name,
        label: target.label,
        config: target.config
      }
    });
  }

  return {
    entityType,
    entityId: Number(entityId),
    workflow: wf,
    currentNode: {
      id: currentNode.id,
      nodeType: currentNode.nodeType,
      name: currentNode.name,
      label: currentNode.label,
      config: currentNode.config
    },
    nextOptions,
    history: await repo.listExecutions(conn, entityType, entityId, options.historyLimit || 50)
  };
}

/**
 * @param {import('mysql2/promise').PoolConnection|null} conn
 */
async function transitionEntity(conn, entityType, entityId, scope, input) {
  const binding = getEntityBinding(entityType);
  if (!binding) {
    const err = new Error('Unsupported entity type');
    err.statusCode = 400;
    throw err;
  }

  const toNodeId = Number(input.toNodeId);
  if (!Number.isFinite(toNodeId) || toNodeId < 1) {
    const err = new Error('toNodeId must be a positive integer');
    err.statusCode = 400;
    throw err;
  }

  const exists = await repo.entityExistsInScope(binding, entityId, scope, conn);
  if (!exists) {
    const err = new Error('Entity not found');
    err.statusCode = 404;
    throw err;
  }

  const currentId = await repo.getEntityCurrentNodeId(binding, entityId, scope, conn);
  if (currentId == null) {
    const err = new Error('Entity has no workflow position; cannot transition');
    err.statusCode = 400;
    throw err;
  }

  const currentNode = await repo.getNodeById(conn, currentId);
  if (!currentNode) {
    const err = new Error('Current node invalid');
    err.statusCode = 409;
    throw err;
  }

  const edge = await repo.findEdge(conn, currentNode.workflowId, currentId, toNodeId);
  if (!edge) {
    const err = new Error('No workflow edge from current node to target');
    err.statusCode = 400;
    throw err;
  }

  const entitySnapshot = await repo.loadEntitySnapshotForContext(conn, entityType, entityId, scope);
  const ctx = buildTransitionContext({
    user: input.user,
    entitySnapshot,
    bodyContext: input.context || {}
  });

  if (!evaluateCondition(edge.conditionJson, ctx)) {
    const err = new Error('Edge condition not satisfied');
    err.statusCode = 400;
    throw err;
  }

  const targetNode = await repo.getNodeById(conn, toNodeId);
  if (!targetNode || targetNode.workflowId !== currentNode.workflowId) {
    const err = new Error('Target node not in same workflow');
    err.statusCode = 400;
    throw err;
  }

  if (!roleAllowedForNode(targetNode.config, input.user && input.user.role)) {
    const err = new Error('Your role is not allowed to move to this node');
    err.statusCode = 403;
    throw err;
  }

  const ok = await repo.setEntityCurrentNodeId(binding, entityId, toNodeId, scope, conn);
  if (!ok) {
    const err = new Error('Failed to update entity');
    err.statusCode = 500;
    throw err;
  }

  await repo.insertWorkflowExecution(conn, {
    entityType,
    entityId,
    nodeId: toNodeId,
    actionTaken: 'transition',
    message: input.message || null,
    executedBy: input.user && input.user.id
  });

  await applyNodeEntryEffects(conn, entityType, entityId, targetNode, scope);

  return {
    currentNode: {
      id: targetNode.id,
      nodeType: targetNode.nodeType,
      name: targetNode.name,
      label: targetNode.label,
      config: targetNode.config
    }
  };
}

module.exports = {
  initializeEntityWorkflowScoped,
  getWorkflowState,
  transitionEntity,
  applyNodeEntryEffects,
  buildTransitionContext
};
