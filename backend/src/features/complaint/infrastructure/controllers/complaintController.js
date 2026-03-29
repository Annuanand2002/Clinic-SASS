'use strict';

const { isElevatedRole } = require('../../../../core/auth/appRoles');
const { scopeFromReq, rejectIfClinicScopeAllCreate } = require('../../../../core/clinic/clinicScope');
const {
  validateCreateComplaint,
  validateUpdateComplaint,
  validateStatusChange,
  validateAssign,
  validateAddUpdate,
  validateListQuery,
  parsePositiveId
} = require('../../../../core/complaints/complaintValidation');
const { clinicBelongsToOrganization } = require('../../../clinic/infrastructure/repositories/mysqlClinicRepository');
const {
  createComplaint,
  listComplaints,
  getComplaintWithDetails,
  updateComplaintFields,
  updateComplaintStatus,
  assignComplaint,
  addComplaintComment,
  deleteComplaint
} = require('../repositories/mysqlComplaintRepository');
const { listAttachmentsByEntity } = require('../../../attachment/infrastructure/repositories/mysqlAttachmentRepository');

async function createComplaintHandler(req, res, next) {
  try {
    if (rejectIfClinicScopeAllCreate(req, res)) return;
    const v = validateCreateComplaint(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const scope = scopeFromReq(req);
    const complaintId = await createComplaint(v.value, req.clinicId, actorId, scope);
    const complaint = await getComplaintWithDetails(complaintId, scope);
    const attachments = await listAttachmentsByEntity('complaint', complaintId, 1, 100, false, scope);
    return res.status(201).json({
      message: 'Complaint created',
      complaint: { ...complaint, attachments: attachments.attachments, attachmentsPagination: attachments.pagination }
    });
  } catch (err) {
    return next(err);
  }
}

async function listComplaintsHandler(req, res, next) {
  try {
    const roleName = req.clinicContext && req.clinicContext.roleName;
    const allowClinicFilter = !!(req.clinicScopeAll && isElevatedRole(roleName));
    const v = validateListQuery(req.query, { allowClinicFilter });
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    if (v.value.clinicId != null) {
      const orgId = req.clinicContext && req.clinicContext.organizationId;
      const allowed = await clinicBelongsToOrganization(v.value.clinicId, orgId);
      if (!allowed) {
        return res.status(403).json({ message: 'Clinic not found or not allowed for your organization' });
      }
    }
    const result = await listComplaints(scopeFromReq(req), v.value);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getComplaintHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    const scope = scopeFromReq(req);
    const complaint = await getComplaintWithDetails(id, scope);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    const attachments = await listAttachmentsByEntity('complaint', id, 1, 100, false, scope);
    return res.json({
      complaint: {
        ...complaint,
        attachments: attachments.attachments,
        attachmentsPagination: attachments.pagination
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function updateComplaintHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    const v = validateUpdateComplaint(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    await updateComplaintFields(id, scopeFromReq(req), v.value);
    const complaint = await getComplaintWithDetails(id, scopeFromReq(req));
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    return res.json({ message: 'Complaint updated', complaint });
  } catch (err) {
    return next(err);
  }
}

async function updateComplaintStatusHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    const v = validateStatusChange(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    await updateComplaintStatus(id, scopeFromReq(req), actorId, v.value);
    const complaint = await getComplaintWithDetails(id, scopeFromReq(req));
    return res.json({ message: 'Status updated', complaint });
  } catch (err) {
    return next(err);
  }
}

async function assignComplaintHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    const v = validateAssign(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    await assignComplaint(id, scopeFromReq(req), v.value.assignedTo);
    const complaint = await getComplaintWithDetails(id, scopeFromReq(req));
    return res.json({ message: 'Complaint assigned', complaint });
  } catch (err) {
    return next(err);
  }
}

async function addComplaintUpdateHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    const v = validateAddUpdate(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    await addComplaintComment(id, scopeFromReq(req), actorId, v.value.message);
    const complaint = await getComplaintWithDetails(id, scopeFromReq(req));
    return res.status(201).json({ message: 'Update added', complaint });
  } catch (err) {
    return next(err);
  }
}

async function deleteComplaintHandler(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);
    if (id == null) {
      return res.status(400).json({ message: 'Invalid complaint id' });
    }
    await deleteComplaint(id, scopeFromReq(req));
    return res.json({ message: 'Complaint deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createComplaintHandler,
  listComplaintsHandler,
  getComplaintHandler,
  updateComplaintHandler,
  updateComplaintStatusHandler,
  assignComplaintHandler,
  addComplaintUpdateHandler,
  deleteComplaintHandler
};
