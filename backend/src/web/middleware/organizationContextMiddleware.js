const { getPool } = require('../../core/db/pool');
const { isElevatedRole } = require('../../core/auth/appRoles');

/**
 * After authRequired + requireElevatedRole. Loads the user's organization_id for org-level APIs
 * (e.g. clinic CRUD) that must not require X-Clinic-Id.
 */
async function attachOrganizationContext(req, res, next) {
  try {
    const role = req.auth && req.auth.role;
    if (!isElevatedRole(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const userId = req.auth && req.auth.sub ? Number(req.auth.sub) : NaN;
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT organization_id AS organizationId FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
      [userId]
    );
    if (!rows?.[0]) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    const v = rows[0].organizationId;
    req.organizationId = v == null ? null : Number(v);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { attachOrganizationContext };
