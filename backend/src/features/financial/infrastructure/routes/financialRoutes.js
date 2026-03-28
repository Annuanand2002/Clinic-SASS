const express = require('express');
const { authRequired } = require('../../../../web/middleware/authMiddleware');
const { resolveClinicContext } = require('../../../../web/middleware/clinicContextMiddleware');
const { requireElevatedRole } = require('../../../../web/middleware/roleMiddleware');
const {
  dashboard,
  createBill,
  listBills,
  getBill,
  createPayment,
  listPayments,
  createExpense,
  listExpenses,
  ledger
} = require('../controllers/financialController');

const router = express.Router();

router.get('/dashboard', authRequired, resolveClinicContext, requireElevatedRole, dashboard);
router.get('/bills', authRequired, resolveClinicContext, listBills);
router.post('/bills', authRequired, resolveClinicContext, createBill);
router.get('/bills/:id', authRequired, resolveClinicContext, getBill);
router.get('/payments', authRequired, resolveClinicContext, listPayments);
router.post('/payments', authRequired, resolveClinicContext, createPayment);
router.get('/expenses', authRequired, resolveClinicContext, listExpenses);
router.post('/expenses', authRequired, resolveClinicContext, createExpense);
router.get('/ledger', authRequired, resolveClinicContext, ledger);

module.exports = router;
