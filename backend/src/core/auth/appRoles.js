/**
 * Roles that may use the staff/admin application (login + API access).
 * Must match `user_role.role_name` values in the database.
 */
const ALLOWED_APP_ROLES = Object.freeze(['Super Admin', 'Admin', 'Staff', 'Doctor']);

/** Roles that may manage staff APIs and user account activation. */
const ELEVATED_ROLES = Object.freeze(['Super Admin', 'Admin']);

/** Roles tied to a single clinic (cannot switch via X-Clinic-Id). */
const CLINIC_BOUND_ROLES = Object.freeze(['Staff', 'Doctor']);

function isAllowedAppRole(roleName) {
  if (!roleName || typeof roleName !== 'string') return false;
  return ALLOWED_APP_ROLES.includes(roleName);
}

function isElevatedRole(roleName) {
  if (!roleName || typeof roleName !== 'string') return false;
  return ELEVATED_ROLES.includes(roleName);
}

function isClinicBoundRole(roleName) {
  if (!roleName || typeof roleName !== 'string') return false;
  return CLINIC_BOUND_ROLES.includes(roleName);
}

module.exports = {
  ALLOWED_APP_ROLES,
  ELEVATED_ROLES,
  CLINIC_BOUND_ROLES,
  isAllowedAppRole,
  isElevatedRole,
  isClinicBoundRole
};
