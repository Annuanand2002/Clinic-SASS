'use strict';

/**
 * Evaluate edge / decision JSON conditions against a context object.
 * conditionJson: null | undefined | object
 *
 * Supported shapes (extensible for UI builder):
 * - Missing / null → true
 * - { "equals": [ pathOrLiteral, pathOrLiteral ] }  — second can be literal or path starting with "context."
 * - { "in": [ pathOrLiteral, [ "a", "b" ] ] }
 * - { "all": [ subCondition, ... ] }
 * - { "any": [ subCondition, ... ] }
 *
 * Paths: "context.user.role", "context.entity.priority", dot notation.
 */
function getByPath(obj, path) {
  if (path == null || path === '') return undefined;
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function resolveValue(token, context) {
  if (token == null) return token;
  if (typeof token === 'number' || typeof token === 'boolean') return token;
  if (typeof token === 'string') {
    if (token.startsWith('context.')) {
      return getByPath(context, token.slice('context.'.length));
    }
    return token;
  }
  return token;
}

function evaluateCondition(conditionJson, context) {
  if (conditionJson == null) return true;
  let cond = conditionJson;
  if (typeof cond === 'string') {
    try {
      cond = JSON.parse(cond);
    } catch {
      return false;
    }
  }
  if (typeof cond !== 'object' || cond === null) return true;

  if (Array.isArray(cond.all)) {
    return cond.all.every((c) => evaluateCondition(c, context));
  }
  if (Array.isArray(cond.any)) {
    return cond.any.some((c) => evaluateCondition(c, context));
  }
  if (cond.equals && Array.isArray(cond.equals) && cond.equals.length >= 2) {
    const a = resolveValue(cond.equals[0], context);
    const b = resolveValue(cond.equals[1], context);
    return a === b;
  }
  if (cond.in && Array.isArray(cond.in) && cond.in.length >= 2) {
    const val = resolveValue(cond.in[0], context);
    const list = cond.in[1];
    if (!Array.isArray(list)) return false;
    return list.includes(val);
  }

  return true;
}

/**
 * Node config: { allowedRoles?: string[] } — if absent or empty, any authenticated role may transition in.
 */
function roleAllowedForNode(nodeConfig, userRole) {
  if (!nodeConfig || typeof nodeConfig !== 'object') return true;
  const roles = nodeConfig.allowedRoles;
  if (!roles || !Array.isArray(roles) || roles.length === 0) return true;
  if (!userRole || typeof userRole !== 'string') return false;
  return roles.includes(userRole);
}

module.exports = {
  evaluateCondition,
  roleAllowedForNode
};
