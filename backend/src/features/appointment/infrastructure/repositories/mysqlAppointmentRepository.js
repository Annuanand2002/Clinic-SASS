const { getPool } = require('../../../../core/db/pool');
const { sqlClinicColumn } = require('../../../../core/clinic/clinicScope');
const { initializeEntityWorkflowScoped } = require('../../../workflow/application/workflowEngine');

function mapAppointmentRow(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    title: row.title || '',
    description: row.description || '',
    color: row.color || 'green',
    currentNodeId: row.current_node_id != null ? Number(row.current_node_id) : null
  };
}

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function listAppointments(pageInput, limitInput, filters = {}, scope) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(filters.search || '').trim();
  const date = String(filters.date || '').trim();
  const month = String(filters.month || '').trim();
  const colPatient = String(filters.colPatient || '').trim();
  const colDoctor = String(filters.colDoctor || '').trim();
  const colTitle = String(filters.colTitle || '').trim();
  const colStatus = String(filters.colStatus || '').trim();
  const colDate = String(filters.colDate || '').trim();
  const colTime = String(filters.colTime || '').trim();
  const { clause: clinicClause, params: clinicParams } = sqlClinicColumn('a.clinic_id', scope);

  const whereParts = [clinicClause];
  const whereParams = [...clinicParams];

  if (q) {
    whereParts.push('(up.username LIKE ? OR ud.username LIKE ? OR a.title LIKE ? OR a.description LIKE ?)');
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (date) {
    whereParts.push('a.appointment_date = ?');
    whereParams.push(date);
  } else if (month) {
    whereParts.push("DATE_FORMAT(a.appointment_date, '%Y-%m') = ?");
    whereParams.push(month);
  }
  if (colPatient) {
    whereParts.push('up.username LIKE ?');
    whereParams.push(`%${colPatient}%`);
  }
  if (colDoctor) {
    whereParts.push('ud.username LIKE ?');
    whereParams.push(`%${colDoctor}%`);
  }
  if (colTitle) {
    whereParts.push('(a.title LIKE ? OR a.description LIKE ?)');
    whereParams.push(`%${colTitle}%`, `%${colTitle}%`);
  }
  if (colStatus) {
    const allowed = ['scheduled', 'completed', 'cancelled', 'no_show'];
    if (allowed.includes(colStatus)) {
      whereParts.push('a.status = ?');
      whereParams.push(colStatus);
    } else {
      whereParts.push('a.status LIKE ?');
      whereParams.push(`%${colStatus}%`);
    }
  }
  if (colDate) {
    whereParts.push("DATE_FORMAT(a.appointment_date, '%Y-%m-%d') LIKE ?");
    whereParams.push(`%${colDate}%`);
  }
  if (colTime) {
    whereParts.push(
      "(CONCAT(TIME_FORMAT(a.start_time, '%H:%i'), ' ', TIME_FORMAT(a.end_time, '%H:%i')) LIKE ?)"
    );
    whereParams.push(`%${colTime}%`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM appointment a
     INNER JOIN patient p ON p.id = a.patient_id
     INNER JOIN doctor d ON d.id = a.doctor_id
     INNER JOIN users up ON up.id = p.user_id
     INNER JOIN users ud ON ud.id = d.user_id
     ${whereSql}`,
    whereParams
  );
  const total = Number(countRows?.[0]?.total || 0);

    const [rows] = await pool.query(
    `SELECT
      a.id,
      a.patient_id,
      a.doctor_id,
      a.appointment_date,
      a.start_time,
      a.end_time,
      a.status,
      a.title,
      a.description,
      a.color,
      a.current_node_id,
      up.username AS patient_name,
      ud.username AS doctor_name
    FROM appointment a
    INNER JOIN patient p ON p.id = a.patient_id
    INNER JOIN doctor d ON d.id = a.doctor_id
    INNER JOIN users up ON up.id = p.user_id
    INNER JOIN users ud ON ud.id = d.user_id
    ${whereSql}
    ORDER BY a.appointment_date ASC, a.start_time ASC
    LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );
  return {
    rows: (rows || []).map(mapAppointmentRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

async function hasDoctorTimeConflict(doctorId, appointmentDate, startTime, endTime, excludeAppointmentId, scope) {
  const pool = getPool();
  const { clause, params: cParams } = sqlClinicColumn('clinic_id', scope);
  const sql = `
    SELECT id
    FROM appointment
    WHERE doctor_id = ?
      AND ${clause}
      AND appointment_date = ?
      AND start_time < ?
      AND end_time > ?
      ${excludeAppointmentId ? 'AND id <> ?' : ''}
    LIMIT 1
  `;
  const params = excludeAppointmentId
    ? [doctorId, ...cParams, appointmentDate, endTime, startTime, excludeAppointmentId]
    : [doctorId, ...cParams, appointmentDate, endTime, startTime];
  const [rows] = await pool.query(sql, params);
  return !!(rows && rows[0]);
}

async function createAppointment(payload, clinicId, scope) {
  const pool = getPool();
  const cid = Number(clinicId);
  if (!Number.isFinite(cid) || cid < 1) {
    const err = new Error('Clinic context required: appointment must be created under a specific clinic');
    err.statusCode = 400;
    throw err;
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [pRows] = await connection.query(
      'SELECT id FROM patient WHERE id = ? AND clinic_id = ? LIMIT 1',
      [payload.patientId, cid]
    );
    const [dRows] = await connection.query(
      'SELECT id FROM doctor WHERE id = ? AND clinic_id = ? LIMIT 1',
      [payload.doctorId, cid]
    );
    if (!pRows?.[0] || !dRows?.[0]) {
      const err = new Error('Patient or doctor not found in this clinic');
      err.statusCode = 400;
      throw err;
    }
    const [ins] = await connection.query(
      `INSERT INTO appointment (
      patient_id, doctor_id, appointment_date, start_time, end_time, status, title, description, color, clinic_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.patientId,
        payload.doctorId,
        payload.appointmentDate,
        payload.startTime,
        payload.endTime,
        payload.status || 'scheduled',
        payload.title || null,
        payload.description || null,
        payload.color || 'green',
        cid
      ]
    );
    const appointmentId = Number(ins.insertId);
    await initializeEntityWorkflowScoped(connection, 'appointment', appointmentId, scope, null);
    await connection.commit();
    return appointmentId;
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

async function updateAppointment(appointmentId, payload, scope) {
  const pool = getPool();
  const { clause: pClinic, params: pParams } = sqlClinicColumn('clinic_id', scope);
  const { clause: dClinic, params: dParams } = sqlClinicColumn('clinic_id', scope);
  const { clause: aClinic, params: aParams } = sqlClinicColumn('clinic_id', scope);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [pRows] = await connection.query(`SELECT id FROM patient WHERE id = ? AND ${pClinic} LIMIT 1`, [
      payload.patientId,
      ...pParams
    ]);
    const [dRows] = await connection.query(`SELECT id FROM doctor WHERE id = ? AND ${dClinic} LIMIT 1`, [
      payload.doctorId,
      ...dParams
    ]);
    if (!pRows?.[0] || !dRows?.[0]) {
      const err = new Error('Patient or doctor not found in this clinic');
      err.statusCode = 400;
      throw err;
    }
    const [upd] = await connection.query(
      `UPDATE appointment
     SET patient_id = ?,
         doctor_id = ?,
         appointment_date = ?,
         start_time = ?,
         end_time = ?,
         status = ?,
         title = ?,
         description = ?,
         color = ?
     WHERE id = ? AND ${aClinic}`,
      [
        payload.patientId,
        payload.doctorId,
        payload.appointmentDate,
        payload.startTime,
        payload.endTime,
        payload.status || 'scheduled',
        payload.title || null,
        payload.description || null,
        payload.color || 'green',
        appointmentId,
        ...aParams
      ]
    );
    if (!upd.affectedRows) {
      const err = new Error('Appointment not found');
      err.statusCode = 404;
      throw err;
    }
    await connection.commit();
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

async function deleteAppointment(appointmentId, scope) {
  const pool = getPool();
  const { clause, params } = sqlClinicColumn('clinic_id', scope);
  const [r] = await pool.query(`DELETE FROM appointment WHERE id = ? AND ${clause}`, [appointmentId, ...params]);
  if (!r.affectedRows) {
    const err = new Error('Appointment not found');
    err.statusCode = 404;
    throw err;
  }
}

module.exports = {
  listAppointments,
  hasDoctorTimeConflict,
  createAppointment,
  updateAppointment,
  deleteAppointment
};
