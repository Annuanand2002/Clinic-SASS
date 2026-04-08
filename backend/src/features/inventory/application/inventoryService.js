'use strict';

const { getPool } = require('../../../core/db/pool');
const { sqlClinicColumn } = require('../../../core/clinic/clinicScope');

/** @typedef {{ singleClinicId: number|null, organizationId: number|null }} ClinicScope */

/**
 * Remaining in a batch (falls back to quantity if remaining_quantity not set).
 */
function sqlRemainingExpr(alias = 's') {
  return `COALESCE(${alias}.remaining_quantity, ${alias}.quantity)`;
}

/**
 * Non-expired, usable quantity from a row.
 */
function sqlAvailableRemainingExpr(alias = 's') {
  const rem = sqlRemainingExpr(alias);
  return `CASE
    WHEN ${alias}.expiry_date IS NOT NULL AND ${alias}.expiry_date < CURDATE() THEN 0
    ELSE ${rem}
  END`;
}

/**
 * Sum of usable (non-expired) remaining quantity for an item.
 */
async function getAvailableStock(itemId, scope) {
  const pool = getPool();
  const id = Number(itemId);
  if (!id) return 0;
  const { clause, params } = sqlClinicColumn('clinic_id', scope);
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(${sqlAvailableRemainingExpr('s')}), 0) AS total
     FROM inventory_stock s
     WHERE s.item_id = ? AND ${clause}`,
    [id, ...params]
  );
  return Number(rows?.[0]?.total || 0);
}

/**
 * Insert purchase batch + IN movement (uses pool transaction).
 */
async function addPurchaseFromPayload(payload, scope) {
  const itemId = Number(payload.itemId);
  const quantity = Number(payload.quantity);
  if (!itemId || quantity <= 0 || !Number.isInteger(quantity)) {
    const err = new Error('Valid itemId and positive integer quantity are required');
    err.statusCode = 400;
    throw err;
  }
  return addStock(
    itemId,
    quantity,
    {
      batchNumber: payload.batchNumber,
      expiryDate: payload.expiryDate,
      purchaseDate: payload.purchaseDate,
      purchasePrice: payload.purchasePrice,
      supplierName: payload.supplierName
    },
    scope,
    {
      referenceType: payload.referenceType || 'purchase',
      referenceId: payload.referenceId != null ? Number(payload.referenceId) : null,
      notes: payload.notes
    }
  );
}

/**
 * @param {number} itemId
 * @param {number} quantity
 * @param {object} batchData
 * @param {ClinicScope} scope
 * @param {{ referenceType?: string, referenceId?: number|null, notes?: string|null }} [options]
 */
async function addStock(itemId, quantity, batchData = {}, scope, options = {}) {
  const q = Number(quantity);
  const id = Number(itemId);
  if (!id || q <= 0 || !Number.isInteger(q)) {
    const err = new Error('Valid itemId and positive integer quantity are required');
    err.statusCode = 400;
    throw err;
  }

  const { clause, params: qParams } = sqlClinicColumn('clinic_id', scope);
  const [itemRows] = await getPool().query(
    `SELECT id, is_active, clinic_id FROM inventory_item WHERE id = ? AND ${clause} LIMIT 1`,
    [id, ...qParams]
  );
  const ir = itemRows && itemRows[0];
  const cid = ir && ir.clinic_id != null ? Number(ir.clinic_id) : NaN;
  if (!ir || !ir.is_active || !Number.isFinite(cid)) {
    const err = new Error('Item not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [ins] = await connection.query(
      `INSERT INTO inventory_stock (
        item_id, quantity, remaining_quantity, batch_number, expiry_date, purchase_date, purchase_price, supplier_name, clinic_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        q,
        q,
        batchData.batchNumber || null,
        batchData.expiryDate || null,
        batchData.purchaseDate || null,
        batchData.purchasePrice != null && batchData.purchasePrice !== '' ? Number(batchData.purchasePrice) : null,
        batchData.supplierName || null,
        cid
      ]
    );
    const stockId = ins.insertId;

    await connection.query(
      `INSERT INTO stock_movement (item_id, stock_id, type, quantity, reference_type, reference_id, notes, clinic_id)
       VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
      [
        id,
        stockId,
        q,
        options.referenceType || 'purchase',
        options.referenceId != null ? Number(options.referenceId) : null,
        options.notes || null,
        cid
      ]
    );

    await connection.commit();
    return { stockId, itemId: id, quantity: q };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Same as addStock but uses an existing connection (caller owns transaction).
 * @param {import('mysql2/promise').PoolConnection} connection
 */
async function addStockPurchaseInTransaction(connection, params) {
  const {
    itemId,
    quantity,
    clinicId,
    batchNumber,
    expiryDate,
    purchaseDate,
    purchasePrice,
    supplierName,
    referenceType,
    referenceId,
    notes
  } = params;
  const q = Number(quantity);
  const id = Number(itemId);
  const cid = Number(clinicId);
  const [ins] = await connection.query(
    `INSERT INTO inventory_stock (
      item_id, quantity, remaining_quantity, batch_number, expiry_date, purchase_date, purchase_price, supplier_name, clinic_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      q,
      q,
      batchNumber || null,
      expiryDate || null,
      purchaseDate || null,
      purchasePrice != null && purchasePrice !== '' ? Number(purchasePrice) : null,
      supplierName || null,
      cid
    ]
  );
  const stockId = ins.insertId;
  await connection.query(
    `INSERT INTO stock_movement (item_id, stock_id, type, quantity, reference_type, reference_id, notes, clinic_id)
     VALUES (?, ?, 'IN', ?, ?, ?, ?, ?)`,
    [id, stockId, q, referenceType || 'purchase', referenceId != null ? Number(referenceId) : null, notes || null, cid]
  );
  return { stockId };
}

/**
 * FIFO deduction on caller's transaction (no begin/commit).
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {{ itemId: number, quantity: number, clinicId: number, referenceType?: string, referenceId?: number|null, notes?: string|null, expiryMode?: string }} params
 * @returns {Promise<{ movements: Array<{ stockId: number, quantity: number }> }>}
 */
async function deductFifoOnConnection(connection, params) {
  const id = Number(params.itemId);
  const need = Number(params.quantity);
  const cid = Number(params.clinicId);
  const referenceType = params.referenceType || 'manual';
  const referenceId = params.referenceId != null ? Number(params.referenceId) : null;
  const notes = params.notes != null ? params.notes : null;
  const expiryModeRaw = params.expiryMode || process.env.INVENTORY_EXPIRED_BATCH_MODE || 'skip';
  const expiryMode = String(expiryModeRaw).toLowerCase() === 'reject' ? 'reject' : 'skip';

  const [itemRows] = await connection.query(
    `SELECT id, is_active FROM inventory_item WHERE id = ? AND clinic_id = ? LIMIT 1 FOR UPDATE`,
    [id, cid]
  );
  const ir = itemRows && itemRows[0];
  if (!ir || !ir.is_active) {
    const err = new Error('Item not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const [avRows] = await connection.query(
    `SELECT COALESCE(SUM(${sqlAvailableRemainingExpr('s')}), 0) AS total
     FROM inventory_stock s WHERE s.item_id = ? AND s.clinic_id = ?`,
    [id, cid]
  );
  const available = Number(avRows?.[0]?.total || 0);
  if (available < need) {
    const err = new Error(`Insufficient stock: need ${need}, available ${available}`);
    err.code = 'INSUFFICIENT_STOCK';
    err.statusCode = 400;
    err.available = available;
    throw err;
  }

  if (expiryMode === 'reject') {
    const [expRows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM inventory_stock
       WHERE item_id = ? AND clinic_id = ?
         AND COALESCE(remaining_quantity, quantity) > 0
         AND expiry_date IS NOT NULL AND expiry_date < CURDATE()`,
      [id, cid]
    );
    if (Number(expRows?.[0]?.cnt || 0) > 0) {
      const err = new Error(
        'Expired batches with remaining quantity exist for this item; clear or dispose them before issuing stock, or use expiryMode skip.'
      );
      err.code = 'EXPIRED_STOCK_PRESENT';
      err.statusCode = 400;
      throw err;
    }
  }

  const [batches] = await connection.query(
    `SELECT id, quantity,
            COALESCE(remaining_quantity, quantity) AS remaining,
            expiry_date, created_at
     FROM inventory_stock
     WHERE item_id = ? AND clinic_id = ?
       AND COALESCE(remaining_quantity, quantity) > 0
       AND (expiry_date IS NULL OR expiry_date >= CURDATE())
     ORDER BY
       CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
       expiry_date ASC,
       created_at ASC,
       id ASC
     FOR UPDATE`,
    [id, cid]
  );

  const movements = [];
  let remaining = need;
  for (const batch of batches || []) {
    if (remaining <= 0) break;
    const rem = Number(batch.remaining);
    if (rem <= 0) continue;

    const take = Math.min(rem, remaining);
    const newRem = rem - take;
    await connection.query('UPDATE inventory_stock SET remaining_quantity = ? WHERE id = ?', [newRem, batch.id]);

    await connection.query(
      `INSERT INTO stock_movement (item_id, stock_id, type, quantity, reference_type, reference_id, notes, clinic_id)
       VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?)`,
      [id, batch.id, take, referenceType, referenceId, notes, cid]
    );
    movements.push({ stockId: batch.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    const err = new Error(`Insufficient stock: need ${need}, could not allocate ${remaining} (expired or missing batches)`);
    err.code = 'INSUFFICIENT_STOCK';
    err.statusCode = 400;
    err.available = need - remaining;
    throw err;
  }

  return { movements };
}

/**
 * FIFO deduction using remaining_quantity; one OUT row per batch line.
 * @param {number} itemId
 * @param {number} quantity
 * @param {string} referenceType
 * @param {number|null} referenceId
 * @param {ClinicScope} scope
 * @param {{ notes?: string|null, expiryMode?: 'skip'|'reject' }} [options]
 */
async function deductStock(itemId, quantity, referenceType, referenceId, scope, options = {}) {
  const id = Number(itemId);
  const need = Number(quantity);
  if (!id || need <= 0 || !Number.isInteger(need)) {
    const err = new Error('Valid itemId and positive integer quantity are required');
    err.statusCode = 400;
    throw err;
  }

  const expiryModeRaw = options.expiryMode || process.env.INVENTORY_EXPIRED_BATCH_MODE || 'skip';
  const expiryMode = String(expiryModeRaw).toLowerCase() === 'reject' ? 'reject' : 'skip';

  const { clause, params: qParams } = sqlClinicColumn('clinic_id', scope);
  const [itemRows] = await getPool().query(
    `SELECT id, is_active, clinic_id, min_stock FROM inventory_item WHERE id = ? AND ${clause} LIMIT 1`,
    [id, ...qParams]
  );
  const ir = itemRows && itemRows[0];
  const cid = ir && ir.clinic_id != null ? Number(ir.clinic_id) : NaN;
  const minStock = ir && ir.min_stock != null ? Number(ir.min_stock) : 0;
  if (!ir || !ir.is_active || !Number.isFinite(cid)) {
    const err = new Error('Item not found or inactive');
    err.statusCode = 404;
    throw err;
  }

  const availablePre = await getAvailableStock(id, scope);
  if (availablePre < need) {
    const err = new Error(`Insufficient stock: need ${need}, available ${availablePre}`);
    err.code = 'INSUFFICIENT_STOCK';
    err.statusCode = 400;
    err.available = availablePre;
    throw err;
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const { movements } = await deductFifoOnConnection(connection, {
      itemId: id,
      quantity: need,
      clinicId: cid,
      referenceType,
      referenceId,
      notes: options.notes,
      expiryMode
    });
    await connection.commit();

    const after = await getAvailableStock(id, scope);
    const lowStockWarning = after < minStock;

    return {
      itemId: id,
      quantity: need,
      movements,
      lowStockWarning,
      minStock,
      availableAfter: after
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function deductFromPayload(payload, scope) {
  const itemId = Number(payload.itemId);
  const quantity = Number(payload.quantity);
  const referenceType = payload.referenceType || 'manual';
  const referenceId = payload.referenceId != null ? Number(payload.referenceId) : null;
  const expiryMode =
    payload.expiryMode === 'reject' || payload.expiryMode === 'skip'
      ? payload.expiryMode
      : undefined;
  return deductStock(itemId, quantity, referenceType, referenceId, scope, {
    notes: payload.notes,
    expiryMode
  });
}

/**
 * Usable vs total remaining; nearest non-expired expiry for UI warnings.
 * @param {ClinicScope} scope
 */
async function getItemAvailability(itemId, scope) {
  const id = Number(itemId);
  if (!id) {
    return {
      itemId: id,
      available: 0,
      totalRemainingAllBatches: 0,
      nearestUsableExpiry: null,
      expiringWithinDays: false,
      hasOnlyExpiredRemaining: false
    };
  }
  const { clause: iClause, params: iParams } = sqlClinicColumn('i.clinic_id', scope);
  const pool = getPool();

  const [sumRows] = await pool.query(
    `SELECT
       COALESCE(SUM(${sqlAvailableRemainingExpr('s')}), 0) AS usable,
       COALESCE(SUM(${sqlRemainingExpr('s')}), 0) AS all_rem
     FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id AND i.is_active = 1
     WHERE s.item_id = ? AND ${iClause}`,
    [id, ...iParams]
  );
  const usable = Number(sumRows?.[0]?.usable || 0);
  const allRem = Number(sumRows?.[0]?.all_rem || 0);

  const [minRows] = await pool.query(
    `SELECT MIN(s.expiry_date) AS d
     FROM inventory_stock s
     INNER JOIN inventory_item i ON i.id = s.item_id AND i.is_active = 1
     WHERE s.item_id = ? AND ${iClause}
       AND ${sqlRemainingExpr('s')} > 0
       AND s.expiry_date IS NOT NULL
       AND s.expiry_date >= CURDATE()`,
    [id, ...iParams]
  );
  const nearest = minRows?.[0]?.d || null;
  const nearestStr = nearest ? String(nearest).slice(0, 10) : null;

  let expiringWithinDays = false;
  if (nearestStr) {
    const d = new Date(nearestStr + 'T12:00:00');
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = (d.getTime() - t0.getTime()) / (86400 * 1000);
    expiringWithinDays = diff >= 0 && diff <= 7;
  }

  return {
    itemId: id,
    available: usable,
    totalRemainingAllBatches: allRem,
    nearestUsableExpiry: nearestStr,
    expiringWithinDays,
    hasOnlyExpiredRemaining: allRem > 0 && usable === 0
  };
}

module.exports = {
  addStock,
  addPurchaseFromPayload,
  addStockPurchaseInTransaction,
  deductStock,
  deductFifoOnConnection,
  deductFromPayload,
  getAvailableStock,
  getItemAvailability,
  sqlAvailableRemainingExpr,
  sqlRemainingExpr
};
