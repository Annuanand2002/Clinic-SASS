const { UnauthorizedError } = require('../../../../core/domain/errors/UnauthorizedError');
const { isElevatedRole } = require('../../../../core/auth/appRoles');

/**
 * Login use-case.
 * Compares the password in plain text (as requested).
 */
async function loginUseCase(
  { authRepository, jwtService, listClinicsByOrganization },
  { usernameOrEmail, password }
) {
  const user = await authRepository.findByUsernameOrEmailAndPassword(usernameOrEmail, password);
  if (!user) {
    throw new UnauthorizedError('Invalid username/email or password');
  }

  const role = user.role_name || null;
  const organizationId = user.organization_id != null ? Number(user.organization_id) : null;
  const homeClinicId = user.clinic_id != null ? Number(user.clinic_id) : null;

  const tokenPayload = {
    sub: String(user.id),
    username: user.username,
    role,
    organizationId,
    homeClinicId: isElevatedRole(role) ? null : homeClinicId
  };

  const token = jwtService.signAccessToken(tokenPayload);

  let clinics = null;
  if (isElevatedRole(role) && typeof listClinicsByOrganization === 'function') {
    clinics = await listClinicsByOrganization(organizationId);
  }

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      organizationId,
      clinicId: isElevatedRole(role) ? null : homeClinicId,
      clinics
    }
  };
}

module.exports = { loginUseCase };

