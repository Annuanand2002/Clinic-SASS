const { getPool } = require('../../../../core/db/pool');

/**
 * @param {number|null|undefined} organizationId
 */
async function listClinicsByOrganization(organizationId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, address, phone, email, organization_id AS organizationId, created_at AS createdAt
     FROM clinic
     WHERE organization_id <=> ?
     ORDER BY name ASC, id ASC`,
    [organizationId == null ? null : Number(organizationId)]
  );
  return (rows || []).map((r) => ({
    id: Number(r.id),
    name: r.name || '',
    address: r.address || '',
    phone: r.phone || '',
    email: r.email || '',
    organizationId: r.organizationId != null ? Number(r.organizationId) : null,
    createdAt: r.createdAt || null
  }));
}

async function getOrganizationIdForClinic(clinicId) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT organization_id AS organizationId FROM clinic WHERE id = ? LIMIT 1',
    [Number(clinicId)]
  );
  if (!rows?.[0]) return undefined;
  const v = rows[0].organizationId;
  return v == null ? null : Number(v);
}

async function clinicExists(clinicId) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id FROM clinic WHERE id = ? LIMIT 1', [Number(clinicId)]);
  return !!(rows && rows[0]);
}

/**
 * Clinic is allowed if it exists and organization_id matches user's organization (both NULL matches).
 */
async function clinicBelongsToOrganization(clinicId, organizationId) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id FROM clinic WHERE id = ? AND organization_id <=> ? LIMIT 1',
    [Number(clinicId), organizationId == null ? null : Number(organizationId)]
  );
  return !!(rows && rows[0]);
}

function mapClinicRow(r) {
  if (!r) return null;
  return {
    id: Number(r.id),
    name: r.name || '',
    address: r.address || '',
    phone: r.phone || '',
    email: r.email || '',
    organizationId: r.organizationId != null ? Number(r.organizationId) : null,
    createdAt: r.createdAt || null
  };
}

/**
 * @param {number} clinicId
 * @param {number|null|undefined} organizationId
 */
async function getClinicByIdForOrganization(clinicId, organizationId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, name, address, phone, email, organization_id AS organizationId, created_at AS createdAt
     FROM clinic WHERE id = ? AND organization_id <=> ? LIMIT 1`,
    [Number(clinicId), organizationId == null ? null : Number(organizationId)]
  );
  return mapClinicRow(rows && rows[0]);
}

/**
 * @param {{ name: string, address?: string|null, phone?: string|null, email?: string|null }} payload
 * @param {number|null|undefined} organizationId
 */
async function createClinic(payload, organizationId) {
  const pool = getPool();
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('name is required');
    err.statusCode = 400;
    throw err;
  }
  const [result] = await pool.query(
    `INSERT INTO clinic (name, address, phone, email, organization_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      name,
      payload.address != null && String(payload.address).trim() !== '' ? String(payload.address).trim() : null,
      payload.phone != null && String(payload.phone).trim() !== '' ? String(payload.phone).trim() : null,
      payload.email != null && String(payload.email).trim() !== '' ? String(payload.email).trim() : null,
      organizationId == null ? null : Number(organizationId)
    ]
  );
  return getClinicByIdForOrganization(result.insertId, organizationId);
}

/**
 * @param {number} clinicId
 * @param {{ name?: string, address?: string|null, phone?: string|null, email?: string|null }} payload
 * @param {number|null|undefined} organizationId
 */
async function updateClinic(clinicId, payload, organizationId) {
  const existing = await getClinicByIdForOrganization(clinicId, organizationId);
  if (!existing) {
    const err = new Error('Clinic not found');
    err.statusCode = 404;
    throw err;
  }
  const name =
    payload.name !== undefined ? String(payload.name || '').trim() : existing.name;
  if (!name) {
    const err = new Error('name cannot be empty');
    err.statusCode = 400;
    throw err;
  }
  const address =
    payload.address !== undefined
      ? payload.address != null && String(payload.address).trim() !== ''
        ? String(payload.address).trim()
        : null
      : existing.address || null;
  const phone =
    payload.phone !== undefined
      ? payload.phone != null && String(payload.phone).trim() !== ''
        ? String(payload.phone).trim()
        : null
      : existing.phone || null;
  const email =
    payload.email !== undefined
      ? payload.email != null && String(payload.email).trim() !== ''
        ? String(payload.email).trim()
        : null
      : existing.email || null;

  const pool = getPool();
  await pool.query(
    `UPDATE clinic SET name = ?, address = ?, phone = ?, email = ? WHERE id = ? AND organization_id <=> ?`,
    [
      name,
      address,
      phone,
      email,
      Number(clinicId),
      organizationId == null ? null : Number(organizationId)
    ]
  );
  return getClinicByIdForOrganization(clinicId, organizationId);
}

/**
 * @param {number} clinicId
 * @param {number|null|undefined} organizationId
 */
async function deleteClinic(clinicId, organizationId) {
  const existing = await getClinicByIdForOrganization(clinicId, organizationId);
  if (!existing) {
    const err = new Error('Clinic not found');
    err.statusCode = 404;
    throw err;
  }
  const pool = getPool();
  try {
    await pool.query('DELETE FROM clinic WHERE id = ? AND organization_id <=> ?', [
      Number(clinicId),
      organizationId == null ? null : Number(organizationId)
    ]);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      const e = new Error(
        'Cannot delete this clinic while patients, staff, or other records still reference it'
      );
      e.statusCode = 409;
      throw e;
    }
    throw err;
  }
  return { ok: true };
}

module.exports = {
  listClinicsByOrganization,
  getOrganizationIdForClinic,
  clinicExists,
  clinicBelongsToOrganization,
  getClinicByIdForOrganization,
  createClinic,
  updateClinic,
  deleteClinic
};
