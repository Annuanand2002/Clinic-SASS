const repo = require('../repositories/mysqlInventoryRepository');
const inventoryService = require('../../application/inventoryService');
const { scopeFromReq, rejectIfClinicScopeAllCreate } = require('../../../../core/clinic/clinicScope');

const CATEGORIES = new Set(['consumable', 'medicine', 'equipment']);

function validateCategory(category) {
  if (!category || !CATEGORIES.has(String(category))) {
    const err = new Error(`category must be one of: ${[...CATEGORIES].join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
}

function meta(req, res) {
  return res.json({
    categories: [
      { value: 'consumable', label: 'Consumable' },
      { value: 'medicine', label: 'Medicine' },
      { value: 'equipment', label: 'Equipment' }
    ],
    units: [
      { value: 'piece', label: 'Piece' },
      { value: 'box', label: 'Box' },
      { value: 'strip', label: 'Strip' },
      { value: 'bottle', label: 'Bottle' },
      { value: 'vial', label: 'Vial' },
      { value: 'pack', label: 'Pack' },
      { value: 'ml', label: 'mL' },
      { value: 'g', label: 'g' },
      { value: 'unit', label: 'Unit' }
    ]
  });
}

async function itemAvailability(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = await inventoryService.getItemAvailability(id, scopeFromReq(req));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function batchesReport(req, res, next) {
  try {
    const rows = await repo.listBatchesReport(
      {
        mode: req.query.mode,
        itemId: req.query.itemId,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate
      },
      scopeFromReq(req)
    );
    return res.json({ batches: rows });
  } catch (err) {
    return next(err);
  }
}

async function listItems(req, res, next) {
  try {
    const result = await repo.listItems(
      req.query.page,
      req.query.limit,
      req.query.q,
      true,
      req.query.category,
      scopeFromReq(req)
    );
    return res.json({ items: result.rows, pagination: result.pagination });
  } catch (err) {
    return next(err);
  }
}

async function getItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const scope = scopeFromReq(req);
    const item = await repo.getItemById(id, scope);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    const total = await repo.getTotalStockByItem(id, scope);
    return res.json({ item: { ...item, totalQuantity: total } });
  } catch (err) {
    return next(err);
  }
}

async function createItem(req, res, next) {
  try {
    if (rejectIfClinicScopeAllCreate(req, res)) return;
    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }
    validateCategory(body.category);
    const id = await repo.createItem(
      {
        name,
        category: body.category,
        description: body.description,
        unit: body.unit,
        minStock: body.minStock,
        isActive: body.isActive
      },
      req.clinicId
    );
    const item = await repo.getItemById(id, {
      singleClinicId: req.clinicId,
      organizationId: req.clinicContext && req.clinicContext.organizationId
    });
    return res.status(201).json({ item });
  } catch (err) {
    return next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    if (body.category !== undefined) validateCategory(body.category);
    await repo.updateItem(id, body, scopeFromReq(req));
    const roScope = {
      singleClinicId: req.clinicId,
      organizationId: req.clinicContext && req.clinicContext.organizationId
    };
    const item = await repo.getItemById(id, roScope);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    const total = await repo.getTotalStockByItem(id, roScope);
    return res.json({ item: { ...item, totalQuantity: total } });
  } catch (err) {
    return next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    await repo.deleteItem(id, scopeFromReq(req));
    return res.json({ message: 'Item deleted' });
  } catch (err) {
    return next(err);
  }
}

async function purchaseStock(req, res, next) {
  try {
    const body = req.body || {};
    const result = await repo.addPurchaseStock(body, scopeFromReq(req));
    return res.status(201).json({ message: 'Stock added', ...result });
  } catch (err) {
    return next(err);
  }
}

async function useStock(req, res, next) {
  try {
    const body = req.body || {};
    const result = await repo.consumeStockFifo(body, scopeFromReq(req));
    return res.json({ message: 'Stock issued', ...result });
  } catch (err) {
    return next(err);
  }
}

async function summary(req, res, next) {
  try {
    const days = req.query.expiringWithinDays;
    const data = await repo.getInventorySummary({ expiringWithinDays: days }, scopeFromReq(req));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function stockBatches(req, res, next) {
  try {
    const id = Number(req.params.id);
    const batches = await repo.listStockBatches(id, scopeFromReq(req));
    return res.json({ itemId: id, batches });
  } catch (err) {
    return next(err);
  }
}

async function movements(req, res, next) {
  try {
    const result = await repo.listMovements(
      req.query.page,
      req.query.limit,
      {
        itemId: req.query.itemId,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate
      },
      scopeFromReq(req)
    );
    return res.json({
      movements: result.movements,
      pagination: result.pagination
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
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
};
