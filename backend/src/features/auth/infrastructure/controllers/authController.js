const { loginUseCase } = require('../../domain/usecases/loginUseCase');
const { findByUsernameOrEmailAndPassword } = require('../repositories/mysqlAuthRepository');
const jwtService = require('../../../../core/auth/jwtService');
const { UnauthorizedError } = require('../../../../core/domain/errors/UnauthorizedError');
const { listClinicsByOrganization } = require('../../../clinic/infrastructure/repositories/mysqlClinicRepository');
const { findUserAuthContextById } = require('../repositories/mysqlAuthRepository');
const { isElevatedRole } = require('../../../../core/auth/appRoles');

async function login(req, res, next) {
  try {
    const { usernameOrEmail, password } = req.body || {};

    if (typeof usernameOrEmail !== 'string' || usernameOrEmail.trim().length === 0) {
      return res.status(400).json({ message: 'username/email is required' });
    }
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'password is required' });
    }

    const result = await loginUseCase(
      {
        authRepository: { findByUsernameOrEmailAndPassword },
        jwtService,
        listClinicsByOrganization
      },
      {
        usernameOrEmail: usernameOrEmail.trim(),
        password
      }
    );

    return res.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const userId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const ctx = userId ? await findUserAuthContextById(userId) : null;
    let clinics = null;
    if (ctx && isElevatedRole(ctx.roleName)) {
      clinics = await listClinicsByOrganization(ctx.organizationId);
    }
    return res.json({
      auth: req.auth,
      user: ctx
        ? {
            id: ctx.id,
            organizationId: ctx.organizationId,
            clinicId: ctx.clinicId,
            role: ctx.roleName,
            clinics
          }
        : null
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { login, getMe };

