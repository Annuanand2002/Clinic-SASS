const { getPool } = require('../../../../core/db/pool');
const { sqlClinicColumn } = require('../../../../core/clinic/clinicScope');
const inventoryService = require('../../application/inventoryService');

function mapItemRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    unit: row.unit || '',
    minStock: row.min_stock != null ? Number(row.min_stock) : 0,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    totalQuantity: row.total_quantity != null ? Number(row.total_quantity) : undefined
  };
}

function mapStockRow(row) {
  const q = Number(row.quantity);
  const rem =
    row.remaining_quantity != null && row.remaining_quantity !== ''
      ? Number(row.remaining_quantity)
      : q;
  return {
    id: row.id,
    itemId: row.item_id,
    quantity: q,
    remainingQuantity: rem,
    batchNumber: row.batch_number || '',
    expiryDate: row.expiry_date ? String(row.expiry_date).slice(0, 10) : null,
    purchaseDate: row.purchase_date ? String(row.purchase_date).slice(0, 10) : null,
    purchasePrice: row.purchase_price != null ? Number(row.purchase_price) : null,
    supplierName: row.supplier_name || '',
    createdAt: row.created_at
  };
}

function mapMovementRow(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    stockId: row.stock_id != null ? Number(row.stock_id) : null,
    itemName: row.item_name || '',
    type: row.type,
    quantity: Number(row.quantity),
    referenceType: row.reference_type || '',
    referenceId: row.reference_id != null ? Number(row.reference_id) : null,
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

function normalizePagination(pageInput, limitInput) {
  const page = Math.max(1, Number(pageInput) || 1);
  const limit = Math.min(100, Math.max(1, Number(limitInput) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function listItems(pageInput, limitInput, searchInput, includeTotals = true, categoryInput = null, scope) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const q = String(searchInput || '').trim();
  const cat = String(categoryInput || '').trim();
  const validCat = ['consumable', 'medicine', 'equipment'].includes(cat) ? cat : '';
  const { clause: iClinic, params: iParams } = sqlClinicColumn('i.clinic_id', scope);
  const { clause: sClinic, params: sParams } = sqlClinicColumn('s.clinic_id', scope);

  const conditions = [iClinic];
  const whereParams = [...iParams];
  if (q) {
    conditions.push('(i.name LIKE ? OR i.category LIKE ? OR IFNULL(i.description,\'\') LIKE ?)');
    whereParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (validCat) {
    conditions.push('i.category = ?');
    whereParams.push(validCat);
  }
  const whereSql = `WHERE ${conditions.join(' AND ')}`;

  const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM inventory_item i ${whereSql}`, whereParams);
  const total = Number(countRows?.[0]?.total || 0);

  const remSum = inventoryService.sqlAvailableRemainingExpr('s');
  const totalSelect = includeTotals
    ? `, COALESCE((
         SELECT SUM(${remSum}) FROM inventory_stock s WHERE s.item_id = i.id AND ${sClinic}
       ), 0) AS total_quantity`
    : '';

  const listParams = includeTotals ? [...whereParams, ...sParams, limit, offset] : [...whereParams, limit, offset];

  const [rows] = await pool.query(
    `SELECT i.id, i.name, i.category, i.description, i.unit, i.min_stock, i.is_active, i.created_at, i.updated_at
     ${totalSelect}
     FROM inventory_item i
     ${whereSql}
     ORDER BY i.id DESC
     LIMIT ? OFFSET ?`,
    listParams
  );

  return {
    rows: (rows || []).map(mapItemRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

async function getItemById(itemId, scope) {
  const pool = getPool();
  const { clause, params } = sqlClinicColumn('clinic_id', scope);
  const [rows] = await pool.query(`SELECT * FROM inventory_item WHERE id = ? AND ${clause} LIMIT 1`, [
    itemId,
    ...params
  ]);
  if (!rows || !rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description || '',
    unit: r.unit || '',
    minStock: r.min_stock != null ? Number(r.min_stock) : 0,
    isActive: !!r.is_active
  };
}

async function createItem(payload, clinicId) {
  const pool = getPool();
  const cid = Number(clinicId);
  const [result] = await pool.query(
    `INSERT INTO inventory_item (name, category, description, unit, min_stock, is_active, clinic_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.name,
      payload.category,
      payload.description || null,
      payload.unit || null,
      payload.minStock != null ? Number(payload.minStock) : 0,
      payload.isActive !== false ? 1 : 0,
      cid
    ]
  );
  return Number(result.insertId);
}

async function updateItem(itemId, payload, scope) {
  const pool = getPool();
  const { clause, params: cParams } = sqlClinicColumn('clinic_id', scope);
  const fields = [];
  const values = [];
  if (payload.name !== undefined) {
    fields.push('name = ?');
    values.push(payload.name);
  }
  if (payload.category !== undefined) {
    fields.push('category = ?');
    values.push(payload.category);
  }
  if (payload.description !== undefined) {
    fields.push('description = ?');
    values.push(payload.description);
  }
  if (payload.unit !== undefined) {
    fields.push('unit = ?');
    values.push(payload.unit);
  }
  if (payload.minStock !== undefined) {
    fields.push('min_stock = ?');
    values.push(Number(payload.minStock));
  }
  if (payload.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(payload.isActive ? 1 : 0);
  }
  if (!fields.length) return;
  values.push(itemId, ...cParams);
  await pool.query(`UPDATE inventory_item SET ${fields.join(', ')} WHERE id = ? AND ${clause}`, values);
}

async function deleteItem(itemId, scope) {
  const pool = getPool();
  const { clause, params } = sqlClinicColumn('clinic_id', scope);
  await pool.query(`DELETE FROM inventory_item WHERE id = ? AND ${clause}`, [itemId, ...params]);
}

async function addPurchaseStock(payload, scope) {
  return inventoryService.addPurchaseFromPayload(payload, scope);
}

async function consumeStockFifo(payload, scope) {
  return inventoryService.deductFromPayload(payload, scope);
}

async function getTotalStockByItem(itemId, scope) {
  return inventoryService.getAvailableStock(itemId, scope);
}

/**
 * Per-item totals, low-stock flag, expiring batches within N days.
 */
async function getInventorySummary(options = {}, scope) {
  const pool = getPool();
  const expiringDays = Math.max(1, Number(options.expiringWithinDays) || 30);
  const { clause: subClinic, params: subParams } = sqlClinicColumn('s.clinic_id', scope);
  const { clause: iClinic, params: iParams } = sqlClinicColumn('i.clinic_id', scope);
  const remSum = inventoryService.sqlAvailableRemainingExpr('s');

  const [items] = await pool.query(
    `
    SELECT
      i.id,
      i.name,
      i.category,
      i.unit,
      i.min_stock,
      COALESCE(t.total_qty, 0) AS total_quantity
    FROM inventory_item i
    LEFT JOIN (
      SELECT s.item_id, SUM(${remSum}) AS total_qty
      FROM inventory_stock s
      WHERE ${subClinic}
      GROUP BY s.item_id
    ) t ON t.item_id = i.id
    WHERE i.is_active = 1 AND ${iClinic}
    ORDER BY i.name
  `,
    [...subParams, ...iParams]
  );

  const summary = (items || []).map((row) => {
    const total = Number(row.total_quantity || 0);
    const min = Number(row.min_stock || 0);
    return {
      itemId: row.id,
      name: row.name,
      category: row.category,
      unit: row.unit || '',
      minStock: min,
      totalQuantity: total,
      isLowStock: total < min
    };
  });

  const lowStockItems = summary.filter((s) => s.isLowStock);

  const { clause: sEx, params: sExP } = sqlClinicColumn('s.clinic_id', scope);
  const { clause: iEx, params: iExP } = sqlClinicColumn('i.clinic_id', scope);
  const [expiring] = await pool.query(
    `SELECT
       s.id AS stock_id,
       s.item_id,
       i.name AS item_name,
       s.quantity,
       s.batch_number,
       s.expiry_date,
       s.purchase_date
     FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id
     WHERE ${sEx} AND ${iEx}
       AND COALESCE(s.remaining_quantity, s.quantity) > 0
       AND s.expiry_date IS NOT NULL
       AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       AND s.expiry_date >= CURDATE()
     ORDER BY s.expiry_date ASC, s.id ASC`,
    [...sExP, ...iExP, expiringDays]
  );

  return {
    items: summary,
    lowStockItems,
    expiringWithinDays: expiringDays,
    expiringBatches: (expiring || []).map((r) => ({
      stockId: r.stock_id,
      itemId: r.item_id,
      itemName: r.item_name,
      quantity: Number(r.quantity),
      batchNumber: r.batch_number || '',
      expiryDate: r.expiry_date ? String(r.expiry_date).slice(0, 10) : null,
      purchaseDate: r.purchase_date ? String(r.purchase_date).slice(0, 10) : null
    }))
  };
}

async function listStockBatches(itemId, scope) {
  const pool = getPool();
  const { clause: sC, params: sP } = sqlClinicColumn('s.clinic_id', scope);
  const { clause: iC, params: iP } = sqlClinicColumn('i.clinic_id', scope);
  const [rows] = await pool.query(
    `SELECT s.* FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id
     WHERE s.item_id = ? AND ${sC} AND ${iC}
     ORDER BY COALESCE(s.purchase_date, DATE(s.created_at)) ASC, s.id ASC`,
    [itemId, ...sP, ...iP]
  );
  return (rows || []).map(mapStockRow);
}

/**
 * @param {{ mode?: string, itemId?: string|number, fromDate?: string, toDate?: string }} query
 */
async function listBatchesReport(query, scope) {
  const pool = getPool();
  const mode = String(query.mode || 'all').toLowerCase();
  const itemIdFilter = query.itemId != null && query.itemId !== '' ? Number(query.itemId) : null;
  const fromExp = query.fromDate ? String(query.fromDate).slice(0, 10) : '';
  const toExp = query.toDate ? String(query.toDate).slice(0, 10) : '';

  const { clause: sC, params: sP } = sqlClinicColumn('s.clinic_id', scope);
  const { clause: iC, params: iP } = sqlClinicColumn('i.clinic_id', scope);
  const rem = inventoryService.sqlRemainingExpr('s');

  const parts = [sC, iC, `${rem} > 0`];
  const params = [...sP, ...iP];

  if (itemIdFilter) {
    parts.push('s.item_id = ?');
    params.push(itemIdFilter);
  }

  if (mode === 'expired') {
    parts.push('s.expiry_date IS NOT NULL');
    parts.push('s.expiry_date < CURDATE()');
  } else if (mode === 'expiring') {
    parts.push('s.expiry_date IS NOT NULL');
    parts.push('s.expiry_date >= CURDATE()');
    parts.push('s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
  }

  if (fromExp) {
    parts.push('(s.expiry_date IS NULL OR s.expiry_date >= ?)');
    params.push(fromExp);
  }
  if (toExp) {
    parts.push('(s.expiry_date IS NULL OR s.expiry_date <= ?)');
    params.push(toExp);
  }

  const whereSql = `WHERE ${parts.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT s.id AS stockId, s.item_id AS itemId, i.name AS itemName, s.batch_number AS batchNumber,
            ${rem} AS remainingQuantity,
            s.purchase_date AS purchaseDate, s.expiry_date AS expiryDate
     FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id
     ${whereSql}
     ORDER BY i.name ASC, s.expiry_date IS NULL, s.expiry_date ASC, s.id ASC`,
    params
  );

  return (rows || []).map((r) => ({
    stockId: r.stockId,
    itemId: r.itemId,
    itemName: r.itemName || '',
    batchNumber: r.batchNumber || '',
    remainingQuantity: Number(r.remainingQuantity || 0),
    purchaseDate: r.purchaseDate ? String(r.purchaseDate).slice(0, 10) : null,
    expiryDate: r.expiryDate ? String(r.expiryDate).slice(0, 10) : null
  }));
}

async function listMovements(pageInput, limitInput, filters = {}, scope) {
  const pool = getPool();
  const { page, limit, offset } = normalizePagination(pageInput, limitInput);
  const itemId = filters.itemId != null && filters.itemId !== '' ? Number(filters.itemId) : null;
  const fromDate = filters.fromDate ? String(filters.fromDate).trim() : '';
  const toDate = filters.toDate ? String(filters.toDate).trim() : '';
  const { clause: mClinic, params: mParams } = sqlClinicColumn('i.clinic_id', scope);

  const parts = [mClinic];
  const params = [...mParams];
  if (itemId) {
    parts.push('m.item_id = ?');
    params.push(itemId);
  }
  if (fromDate) {
    parts.push('DATE(m.created_at) >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    parts.push('DATE(m.created_at) <= ?');
    params.push(toDate);
  }
  const whereSql = parts.length ? `WHERE ${parts.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM stock_movement m
     INNER JOIN inventory_item i ON i.id = m.item_id
     ${whereSql}`,
    params
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT m.*, i.name AS item_name
     FROM stock_movement m
     INNER JOIN inventory_item i ON i.id = m.item_id
     ${whereSql}
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    movements: (rows || []).map(mapMovementRow),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
  };
}

module.exports = {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  addPurchaseStock,
  consumeStockFifo,
  getTotalStockByItem,
  getAvailableStock: (itemId, scope) => inventoryService.getAvailableStock(itemId, scope),
  getInventorySummary,
  listStockBatches,
  listBatchesReport,
  listMovements
};
