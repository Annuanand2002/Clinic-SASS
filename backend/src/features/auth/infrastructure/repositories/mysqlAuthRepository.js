const { getPool } = require('../../../../core/db/pool');
const { ALLOWED_APP_ROLES } = require('../../../../core/auth/appRoles');

async function findByUsernameOrEmailAndPassword(usernameOrEmail, password) {
  const pool = getPool();

  const placeholders = ALLOWED_APP_ROLES.map(() => '?').join(', ');

  const sql = `
    SELECT
      u.id,
      u.username,
      u.email,
      u.password,
      u.organization_id,
      u.clinic_id,
      r.role_name
    FROM users u
    INNER JOIN user_role r ON u.role_id = r.id
    LEFT JOIN staff s ON s.user_id = u.id
    LEFT JOIN doctor doc ON doc.user_id = u.id
    WHERE
      u.is_active = 1
      AND (u.username = ? OR u.email = ?)
      AND u.password = ?
      AND r.role_name IN (${placeholders})
      AND (
        r.role_name IN ('Super Admin', 'Admin')
        OR (
          r.role_name = 'Staff'
          AND IFNULL(s.can_login, 0) = 1
          AND IFNULL(s.is_active, 0) = 1
        )
        OR (
          r.role_name = 'Doctor'
          AND doc.id IS NOT NULL
        )
      )
    LIMIT 1
  `;

  const params = [usernameOrEmail, usernameOrEmail, password, ...ALLOWED_APP_ROLES];
  const [rows] = await pool.query(sql, params);
  return rows && rows[0] ? rows[0] : null;
}

async function findUserAuthContextById(userId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT u.id, u.organization_id, u.clinic_id, r.role_name
     FROM users u
     INNER JOIN user_role r ON r.id = u.role_id
     WHERE u.id = ? AND u.is_active = 1
     LIMIT 1`,
    [Number(userId)]
  );
  if (!rows?.[0]) return null;
  const u = rows[0];
  return {
    id: Number(u.id),
    organizationId: u.organization_id != null ? Number(u.organization_id) : null,
    clinicId: u.clinic_id != null ? Number(u.clinic_id) : null,
    roleName: u.role_name || null
  };
}

module.exports = { findByUsernameOrEmailAndPassword, findUserAuthContextById };

