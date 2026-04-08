'use strict';

const { getPool } = require('../../../../core/db/pool');
const { sqlClinicColumn } = require('../../../../core/clinic/clinicScope');

function mapClinic(row) {
  if (!row) return null;
  return {
    id: Number(row.clinic_id),
    name: row.clinic_name || '',
    address: row.clinic_address || '',
    phone: row.clinic_phone || '',
    email: row.clinic_email || ''
  };
}

function mapCreatedByStaff(row) {
  const user = {
    id: Number(row.created_by),
    username: row.created_username || '',
    email: row.created_email || ''
  };
  let staff = null;
  if (row.staff_profile_id != null) {
    staff = {
      id: Number(row.staff_profile_id),
      staffType: row.created_staff_type || null,
      department: row.created_staff_dept || null,
      joiningDate: row.created_staff_joining ? String(row.created_staff_joining).slice(0, 10) : null
    };
  }
  return { user, staff };
}

function mapAssignee(row) {
  if (row.assigned_to == null) return null;
  return {
    userId: Number(row.assigned_to),
    username: row.assign_username || '',
    email: row.assign_email || ''
  };
}

function mapComplaintCore(row) {
  return {
    id: Number(row.id),
    clinicId: Number(row.clinic_id),
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdBy: Number(row.created_by),
    assignedTo: row.assigned_to != null ? Number(row.assigned_to) : null,
    rejectionReason: row.rejection_reason || null,
    resolvedAt: row.resolved_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    currentNodeId: row.current_node_id != null ? Number(row.current_node_id) : null
  };
}

function mapListRow(row) {
  return {
    ...mapComplaintCore(row),
    clinic: mapClinic(row),
    createdByStaff: mapCreatedByStaff(row),
    assignedToUser: mapAssignee(row)
  };
}

function mapUpdateRow(row) {
  return {
    id: Number(row.cu_id),
    status: row.cu_status,
    message: row.cu_message || null,
    createdAt: row.cu_created_at || null,
    updatedBy: {
      id: Number(row.updated_by),
      username: row.upd_username || '',
      email: row.upd_email || ''
    }
  };
}

const LIST_SELECT = `
  c.id, c.clinic_id, c.title, c.description, c.category, c.priority, c.status,
  c.created_by, c.assigned_to, c.rejection_reason, c.resolved_at, c.created_at, c.updated_at,
  c.current_node_id,
  cl.name AS clinic_name, cl.address AS clinic_address, cl.phone AS clinic_phone, cl.email AS clinic_email,
  uc.username AS created_username, uc.email AS created_email,
  s.id AS staff_profile_id, s.staff_type AS created_staff_type, s.department AS created_staff_dept,
  s.joining_date AS created_staff_joining,
  ua.username AS assign_username, ua.email AS assign_email
`;

async function assertUserAssignableToComplaint(connection, assigneeUserId, complaintClinicId) {
  const [cRows] = await connection.query(
    'SELECT organization_id FROM clinic WHERE id = ? LIMIT 1',
    [Number(complaintClinicId)]
  );
  if (!cRows?.[0]) {
    const e = new Error('Clinic not found');
    e.statusCode = 404;
    throw e;
  }
  const clinicOrg = cRows[0].organization_id != null ? Number(cRows[0].organization_id) : null;

  const [uRows] = await connection.query(
    'SELECT id, clinic_id, organization_id FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
    [Number(assigneeUserId)]
  );
  if (!uRows?.[0]) {
    const e = new Error('Assignee user not found or inactive');
    e.statusCode = 400;
    throw e;
  }
  const u = uRows[0];
  const uClinic = u.clinic_id != null ? Number(u.clinic_id) : null;
  const uOrg = u.organization_id != null ? Number(u.organization_id) : null;

  if (uOrg !== clinicOrg && !(uOrg == null && clinicOrg == null)) {
    const e = new Error('Assignee must belong to the same organization as the complaint clinic');
    e.statusCode = 400;
    throw e;
  }
  if (uClinic != null && uClinic !== Number(complaintClinicId)) {
    const e = new Error('Assignee must belong to the same clinic as this complaint');
    e.statusCode = 400;
    throw e;
  }
}

async function createComplaint(payload, clinicId, createdByUserId, scope) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [ins] = await connection.query(
      `INSERT INTO complaint (clinic_id, title, description, category, priority, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
      [
        Number(clinicId),
        payload.title,
        payload.description,
        payload.category,
        payload.priority,
        Number(createdByUserId)
      ]
    );
    const id = Number(ins.insertId);
    await connection.query(
      `INSERT INTO complaint_updates (complaint_id, status, message, updated_by)
       VALUES (?, 'open', ?, ?)`,
      [id, payload.initialMessage, Number(createdByUserId)]
    );
    await connection.commit();
    return id;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function listComplaints(scope, filters) {
  const pool = getPool();
  const { page, limit, status, priority, clinicId } = filters;
  const offset = (page - 1) * limit;
  const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);

  let extraClause = '';
  const extraParams = [];
  if (clinicId != null) {
    extraClause += ' AND c.clinic_id = ?';
    extraParams.push(Number(clinicId));
  }
  if (status) {
    extraClause += ' AND c.status = ?';
    extraParams.push(status);
  }
  if (priority) {
    extraClause += ' AND c.priority = ?';
    extraParams.push(priority);
  }

  const whereSql = `WHERE ${clause}${extraClause}`;

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM complaint c ${whereSql}`,
    [...cParams, ...extraParams]
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT ${LIST_SELECT}
     FROM complaint c
     INNER JOIN clinic cl ON cl.id = c.clinic_id
     INNER JOIN users uc ON uc.id = c.created_by
     LEFT JOIN staff s ON s.user_id = c.created_by
     LEFT JOIN users ua ON ua.id = c.assigned_to
     ${whereSql}
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT ? OFFSET ?`,
    [...cParams, ...extraParams, limit, offset]
  );

  return {
    complaints: (rows || []).map(mapListRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function getComplaintWithDetails(complaintId, scope) {
  const pool = getPool();
  const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
  const [rows] = await pool.query(
    `SELECT ${LIST_SELECT}
     FROM complaint c
     INNER JOIN clinic cl ON cl.id = c.clinic_id
     INNER JOIN users uc ON uc.id = c.created_by
     LEFT JOIN staff s ON s.user_id = c.created_by
     LEFT JOIN users ua ON ua.id = c.assigned_to
     WHERE c.id = ? AND ${clause}
     LIMIT 1`,
    [Number(complaintId), ...cParams]
  );
  const row = rows && rows[0];
  if (!row) return null;

  const [updRows] = await pool.query(
    `SELECT cu.id AS cu_id, cu.status AS cu_status, cu.message AS cu_message, cu.created_at AS cu_created_at,
            cu.updated_by, u.username AS upd_username, u.email AS upd_email
     FROM complaint_updates cu
     INNER JOIN users u ON u.id = cu.updated_by
     WHERE cu.complaint_id = ?
     ORDER BY cu.created_at ASC, cu.id ASC`,
    [Number(complaintId)]
  );

  const complaint = {
    ...mapComplaintCore(row),
    clinic: mapClinic(row),
    createdByStaff: mapCreatedByStaff(row),
    assignedToUser: mapAssignee(row),
    updates: (updRows || []).map(mapUpdateRow)
  };
  return complaint;
}

async function updateComplaintFields(complaintId, scope, patch) {
  const pool = getPool();
  const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
  const [check] = await pool.query(
    `SELECT c.id FROM complaint c WHERE c.id = ? AND ${clause} LIMIT 1`,
    [Number(complaintId), ...cParams]
  );
  if (!check?.[0]) {
    const e = new Error('Complaint not found');
    e.statusCode = 404;
    throw e;
  }

  const sets = [];
  const vals = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    vals.push(patch.title);
  }
  if (patch.description !== undefined) {
    sets.push('description = ?');
    vals.push(patch.description);
  }
  if (patch.category !== undefined) {
    sets.push('category = ?');
    vals.push(patch.category);
  }
  if (patch.priority !== undefined) {
    sets.push('priority = ?');
    vals.push(patch.priority);
  }
  if (sets.length === 0) return;

  vals.push(Number(complaintId));
  await pool.query(`UPDATE complaint SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, vals);
}

async function updateComplaintStatus(complaintId, scope, actorUserId, { status, message, rejectionReason }) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
    const [rows] = await connection.query(
      `SELECT c.id FROM complaint c WHERE c.id = ? AND ${clause} LIMIT 1 FOR UPDATE`,
      [Number(complaintId), ...cParams]
    );
    if (!rows?.[0]) {
      const e = new Error('Complaint not found');
      e.statusCode = 404;
      throw e;
    }

    const rej = status === 'rejected' ? rejectionReason : null;
    await connection.query(
      `UPDATE complaint SET
         status = ?,
         rejection_reason = ?,
         resolved_at = IF(? = 'resolved', CURRENT_TIMESTAMP, NULL),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, rej, status, Number(complaintId)]
    );

    await connection.query(
      `INSERT INTO complaint_updates (complaint_id, status, message, updated_by)
       VALUES (?, ?, ?, ?)`,
      [Number(complaintId), status, message, Number(actorUserId)]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function assignComplaint(complaintId, scope, assigneeUserId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
    const [rows] = await connection.query(
      `SELECT c.id, c.clinic_id FROM complaint c WHERE c.id = ? AND ${clause} LIMIT 1 FOR UPDATE`,
      [Number(complaintId), ...cParams]
    );
    if (!rows?.[0]) {
      const e = new Error('Complaint not found');
      e.statusCode = 404;
      throw e;
    }
    const complaintClinicId = Number(rows[0].clinic_id);
    await assertUserAssignableToComplaint(connection, assigneeUserId, complaintClinicId);

    await connection.query(
      'UPDATE complaint SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Number(assigneeUserId), Number(complaintId)]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function addComplaintComment(complaintId, scope, actorUserId, message) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
    const [rows] = await connection.query(
      `SELECT c.id, c.status FROM complaint c WHERE c.id = ? AND ${clause} LIMIT 1 FOR UPDATE`,
      [Number(complaintId), ...cParams]
    );
    if (!rows?.[0]) {
      const e = new Error('Complaint not found');
      e.statusCode = 404;
      throw e;
    }
    const currentStatus = rows[0].status;
    await connection.query(
      `INSERT INTO complaint_updates (complaint_id, status, message, updated_by)
       VALUES (?, ?, ?, ?)`,
      [Number(complaintId), currentStatus, message, Number(actorUserId)]
    );
    await connection.query(
      'UPDATE complaint SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [Number(complaintId)]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deleteComplaint(complaintId, scope) {
  const pool = getPool();
  const { clause, params: cParams } = sqlClinicColumn('c.clinic_id', scope);
  const [result] = await pool.query(
    `DELETE c FROM complaint c WHERE c.id = ? AND ${clause}`,
    [Number(complaintId), ...cParams]
  );
  if (!result.affectedRows) {
    const e = new Error('Complaint not found');
    e.statusCode = 404;
    throw e;
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  getComplaintWithDetails,
  updateComplaintFields,
  updateComplaintStatus,
  assignComplaint,
  addComplaintComment,
  deleteComplaint
};
