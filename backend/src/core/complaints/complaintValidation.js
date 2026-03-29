'use strict';

const { CATEGORIES, PRIORITIES, STATUSES } = require('./complaintConstants');

function parsePositiveId(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

function trimOrNull(s, maxLen) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (maxLen != null && t.length > maxLen) return t.slice(0, maxLen);
  return t;
}

function validateCreateComplaint(body) {
  const b = body || {};
  const title = trimOrNull(b.title, 150);
  if (!title) {
    return { ok: false, status: 400, message: 'title is required (max 150 characters)' };
  }
  const description =
    b.description == null || String(b.description).trim() === ''
      ? null
      : String(b.description).trim();
  const category = b.category != null && String(b.category).trim() !== '' ? String(b.category).trim() : 'other';
  if (!CATEGORIES.includes(category)) {
    return { ok: false, status: 400, message: `category must be one of: ${CATEGORIES.join(', ')}` };
  }
  const priority =
    b.priority != null && String(b.priority).trim() !== '' ? String(b.priority).trim() : 'medium';
  if (!PRIORITIES.includes(priority)) {
    return { ok: false, status: 400, message: `priority must be one of: ${PRIORITIES.join(', ')}` };
  }
  const initialMessage =
    b.initialMessage == null || String(b.initialMessage).trim() === ''
      ? null
      : String(b.initialMessage).trim();
  return {
    ok: true,
    value: { title, description, category, priority, initialMessage }
  };
}

function validateUpdateComplaint(body) {
  const b = body || {};
  const patch = {};
  if (b.title !== undefined) {
    const title = trimOrNull(b.title, 150);
    if (!title) {
      return { ok: false, status: 400, message: 'title cannot be empty' };
    }
    patch.title = title;
  }
  if (b.description !== undefined) {
    patch.description =
      b.description == null || String(b.description).trim() === ''
        ? null
        : String(b.description).trim();
  }
  if (b.category !== undefined) {
    const c = String(b.category).trim();
    if (!CATEGORIES.includes(c)) {
      return { ok: false, status: 400, message: `category must be one of: ${CATEGORIES.join(', ')}` };
    }
    patch.category = c;
  }
  if (b.priority !== undefined) {
    const p = String(b.priority).trim();
    if (!PRIORITIES.includes(p)) {
      return { ok: false, status: 400, message: `priority must be one of: ${PRIORITIES.join(', ')}` };
    }
    patch.priority = p;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, message: 'No updatable fields provided' };
  }
  return { ok: true, value: patch };
}

function validateStatusChange(body) {
  const b = body || {};
  const status = b.status != null ? String(b.status).trim() : '';
  if (!STATUSES.includes(status)) {
    return { ok: false, status: 400, message: `status must be one of: ${STATUSES.join(', ')}` };
  }
  const message =
    b.message == null || String(b.message).trim() === '' ? null : String(b.message).trim();
  let rejectionReason = null;
  if (status === 'rejected') {
    rejectionReason = trimOrNull(b.rejectionReason, 65535);
    if (!rejectionReason) {
      return { ok: false, status: 400, message: 'rejectionReason is required when status is rejected' };
    }
  }
  return { ok: true, value: { status, message, rejectionReason } };
}

function validateAssign(body) {
  const b = body || {};
  const assignedTo = parsePositiveId(b.assignedTo);
  if (assignedTo == null) {
    return { ok: false, status: 400, message: 'assignedTo must be a positive integer user id' };
  }
  return { ok: true, value: { assignedTo } };
}

function validateAddUpdate(body) {
  const b = body || {};
  const message =
    b.message == null || String(b.message).trim() === '' ? null : String(b.message).trim();
  if (!message) {
    return { ok: false, status: 400, message: 'message is required' };
  }
  return { ok: true, value: { message } };
}

function validateListQuery(query, options) {
  const q = query || {};
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 25));

  let status = null;
  if (q.status != null && String(q.status).trim() !== '') {
    const s = String(q.status).trim();
    if (!STATUSES.includes(s)) {
      return { ok: false, status: 400, message: `status must be one of: ${STATUSES.join(', ')}` };
    }
    status = s;
  }

  let priority = null;
  if (q.priority != null && String(q.priority).trim() !== '') {
    const p = String(q.priority).trim();
    if (!PRIORITIES.includes(p)) {
      return { ok: false, status: 400, message: `priority must be one of: ${PRIORITIES.join(', ')}` };
    }
    priority = p;
  }

  let clinicId = null;
  if (options && options.allowClinicFilter && q.clinicId != null && String(q.clinicId).trim() !== '') {
    clinicId = parsePositiveId(q.clinicId);
    if (clinicId == null) {
      return { ok: false, status: 400, message: 'clinicId must be a positive integer' };
    }
  }

  return { ok: true, value: { page, limit, status, priority, clinicId } };
}

module.exports = {
  parsePositiveId,
  validateCreateComplaint,
  validateUpdateComplaint,
  validateStatusChange,
  validateAssign,
  validateAddUpdate,
  validateListQuery
};
