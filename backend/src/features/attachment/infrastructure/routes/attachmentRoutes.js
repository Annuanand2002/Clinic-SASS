const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const {
  listAttachments,
  browseAttachmentsHandler,
  uploadAttachment,
  updateAttachment,
  getAttachment,
  deleteAttachment
} = require('../controllers/attachmentController');

const router = express.Router();

router.get('/browse', authRequired, resolveClinicContext, browseAttachmentsHandler);
router.get('/', authRequired, resolveClinicContext, listAttachments);
router.post('/', authRequired, resolveClinicContext, uploadAttachment);
router.put('/:id', authRequired, resolveClinicContext, updateAttachment);
router.get('/:id', authRequired, resolveClinicContext, getAttachment);
router.delete('/:id', authRequired, resolveClinicContext, deleteAttachment);

module.exports = router;
