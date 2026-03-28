const { getPool } = require('../../core/db/pool');
const { isElevatedRole, isClinicBoundRole } = require('../../core/auth/appRoles');
const { clinicBelongsToOrganization, clinicExists } = require('../../features/clinic/infrastructure/repositories/mysqlClinicRepository');

/**
 * @returns {{ all: true }|{ id: number }|null}
 */
function parseClinicSelectorFromRequest(req) {
  const rawHeader = req.headers['x-clinic-id'];
  const rawQuery = req.query && req.query.clinicId;
  const raw = rawHeader != null && String(rawHeader).trim() !== '' ? rawHeader : rawQuery;
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  const low = s.toLowerCase();
  if (low === 'all' || low === '0') return { all: true };
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return { id: n };
  return null;
}

/**
 * After authRequired. Sets req.clinicId and req.clinicContext.
 * Elevated users must send X-Clinic-Id (or ?clinicId=) for each request.
 * Staff/Doctor always use users.clinic_id; mismatching header/query → 403.
 */
async function resolveClinicContext(req, res, next) {
  try {
    const userId = req.auth && req.auth.sub ? Number(req.auth.sub) : NaN;
    if (!Number.isFinite(userId) || userId < 1) {
      return res.status(401).json({ message: 'Invalid authentication' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.organization_id AS organizationId, u.clinic_id AS clinicId, r.role_name AS roleName
       FROM users u
       INNER JOIN user_role r ON r.id = u.role_id
       WHERE u.id = ? AND u.is_active = 1
       LIMIT 1`,
      [userId]
    );
    const row = rows && rows[0];
    if (!row) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    const roleName = row.roleName || null;
    const organizationId = row.organizationId != null ? Number(row.organizationId) : null;
    const homeClinicId = row.clinicId != null ? Number(row.clinicId) : null;

    req.clinicContext = {
      userId,
      roleName,
      organizationId,
      homeClinicId
    };

    const selector = parseClinicSelectorFromRequest(req);

    if (isElevatedRole(roleName)) {
      if (!selector) {
        return res.status(400).json({
          message: 'Clinic context required: send X-Clinic-Id header or clinicId query parameter'
        });
      }
      if (selector.all) {
        req.clinicId = null;
        req.clinicScopeAll = true;
        return next();
      }
      const requestedClinicId = selector.id;
      const allowed = organizationId == null
        ? await clinicExists(requestedClinicId)
        : await clinicBelongsToOrganization(requestedClinicId, organizationId);
      if (!allowed) {
        return res.status(403).json({ message: 'Clinic not found or not allowed for your organization' });
      }
      req.clinicId = requestedClinicId;
      req.clinicScopeAll = false;
      return next();
    }

    if (isClinicBoundRole(roleName)) {
      if (homeClinicId == null) {
        return res.status(403).json({ message: 'Your account is not assigned to a clinic' });
      }
      const boundSel = parseClinicSelectorFromRequest(req);
      const requestedClinicId =
        boundSel && boundSel.id != null ? boundSel.id : boundSel && boundSel.all ? null : null;
      if (boundSel && boundSel.all) {
        return res.status(403).json({ message: 'You cannot use organization-wide clinic scope' });
      }
      if (requestedClinicId != null && requestedClinicId !== homeClinicId) {
        return res.status(403).json({ message: 'You cannot access a different clinic' });
      }
      req.clinicId = homeClinicId;
      req.clinicScopeAll = false;
      return next();
    }

    return res.status(403).json({ message: 'Access denied for this account' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { resolveClinicContext, parseClinicSelectorFromRequest };
