const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const {
  meta,
  itemAvailability,
  batchesReport,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  purchaseStock,
  useStock,
  summary,
  stockBatches,
  movements
} = require('../controllers/inventoryController');

const router = express.Router();

router.get('/meta', authRequired, resolveClinicContext, meta);
router.get('/summary', authRequired, resolveClinicContext, summary);
router.get('/batches-report', authRequired, resolveClinicContext, batchesReport);
router.get('/movements', authRequired, resolveClinicContext, movements);
router.get('/items', authRequired, resolveClinicContext, listItems);
router.get('/items/:id/availability', authRequired, resolveClinicContext, itemAvailability);
router.get('/items/:id/batches', authRequired, resolveClinicContext, stockBatches);
router.get('/items/:id', authRequired, resolveClinicContext, getItem);
router.post('/items', authRequired, resolveClinicContext, createItem);
router.put('/items/:id', authRequired, resolveClinicContext, updateItem);
router.delete('/items/:id', authRequired, resolveClinicContext, deleteItem);
router.post('/purchase', authRequired, resolveClinicContext, purchaseStock);
router.post('/use', authRequired, resolveClinicContext, useStock);

module.exports = router;
