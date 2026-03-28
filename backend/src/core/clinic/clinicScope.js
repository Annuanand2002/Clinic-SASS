'use strict';

/**
 * @typedef {{ singleClinicId: number|null, organizationId: number|null }} ClinicScope
 */

/**
 * Build a WHERE fragment for a clinic_id column (or aliased, e.g. p.clinic_id).
 * Single-clinic: equality. Org-wide (elevated + "all"): IN (clinics for organization).
 *
 * @param {string} columnExpr
 * @param {ClinicScope} scope
 * @returns {{ clause: string, params: any[] }}
 */
function sqlClinicColumn(columnExpr, scope) {
  if (scope.singleClinicId != null && Number(scope.singleClinicId) > 0) {
    return { clause: `${columnExpr} = ?`, params: [Number(scope.singleClinicId)] };
  }
  return {
    clause: `${columnExpr} IN (SELECT id FROM clinic WHERE organization_id <=> ?)`,
    params: [scope.organizationId]
  };
}

/**
 * @param {import('express').Request} req
 * @returns {ClinicScope}
 */
function scopeFromReq(req) {
  const ctx = req.clinicContext || {};
  const orgRaw = ctx.organizationId;
  const single =
    req.clinicId != null && Number(req.clinicId) > 0 ? Number(req.clinicId) : null;
  const organizationId = orgRaw == null ? null : Number(orgRaw);
  return { singleClinicId: single, organizationId };
}

/**
 * Use in POST handlers that insert a new row tied to one clinic (patient, doctor, …).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean} true if response was sent (caller should return)
 */
function rejectIfClinicScopeAllCreate(req, res) {
  if (req.clinicScopeAll) {
    res.status(400).json({
      message:
        'Select a single clinic to create new records. Choose one clinic in the clinic switcher (not “All clinics”).'
    });
    return true;
  }
  return false;
}

module.exports = {
  sqlClinicColumn,
  scopeFromReq,
  rejectIfClinicScopeAllCreate
};
