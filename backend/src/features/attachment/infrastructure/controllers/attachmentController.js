const {
  validateUploadPayload,
  validateListQuery,
  validateBrowseQuery,
  validateUpdatePayload
} = require('../../../../core/attachments/attachmentValidation');
const {
  insertAttachment,
  listAttachmentsByEntity,
  browseAttachments,
  getAttachmentById,
  updateAttachmentById,
  deleteAttachmentById
} = require('../repositories/mysqlAttachmentRepository');
const { scopeFromReq, rejectIfClinicScopeAllCreate } = require('../../../../core/clinic/clinicScope');

async function listAttachments(req, res, next) {
  try {
    const v = validateListQuery(req.query);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const { entityType, entityId, page, limit } = v.value;
    const result = await listAttachmentsByEntity(entityType, entityId, page, limit, false, scopeFromReq(req));
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function browseAttachmentsHandler(req, res, next) {
  try {
    const v = validateBrowseQuery(req.query);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const result = await browseAttachments(v.value, scopeFromReq(req));
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function uploadAttachment(req, res, next) {
  try {
    const actorId = req.auth && req.auth.sub ? Number(req.auth.sub) : null;
    const v = validateUploadPayload(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const id = await insertAttachment(v.value, actorId, req.clinicId);
    const row = await getAttachmentById(id, {
      singleClinicId: req.clinicId,
      organizationId: req.clinicContext && req.clinicContext.organizationId
    });
    return res.status(201).json({ message: 'Uploaded', attachment: row });
  } catch (err) {
    return next(err);
  }
}

async function updateAttachment(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid attachment id' });
    }
    const v = validateUpdatePayload(req.body);
    if (!v.ok) {
      return res.status(v.status).json({ message: v.message });
    }
    const row = await updateAttachmentById(id, v.value, scopeFromReq(req));
    if (!row) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    return res.json({ message: 'Updated', attachment: row });
  } catch (err) {
    return next(err);
  }
}

async function getAttachment(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid attachment id' });
    }
    const row = await getAttachmentById(id, scopeFromReq(req));
    if (!row) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    return res.json({ attachment: row });
  } catch (err) {
    return next(err);
  }
}

async function deleteAttachment(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid attachment id' });
    }
    const ok = await deleteAttachmentById(id, scopeFromReq(req));
    if (!ok) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listAttachments,
  browseAttachmentsHandler,
  uploadAttachment,
  updateAttachment,
  getAttachment,
  deleteAttachment
};
