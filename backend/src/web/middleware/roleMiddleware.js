const { isElevatedRole } = require('../../core/auth/appRoles');

/**
 * Requires a valid JWT (use after authRequired) and role Super Admin or Admin.
 */
function requireElevatedRole(req, res, next) {
  const role = req.auth && req.auth.role;
  if (!isElevatedRole(role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
}

/**
 * After resolveClinicContext. Only the Staff role may create complaints.
 */
function requireStaffRole(req, res, next) {
  const role = req.clinicContext && req.clinicContext.roleName;
  if (role !== 'Staff') {
    return res.status(403).json({ message: 'Only staff users can create complaints' });
  }
  return next();
}

module.exports = { requireElevatedRole, requireStaffRole };
