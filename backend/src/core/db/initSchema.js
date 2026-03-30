const { getPool } = require('./pool');

async function ensureColumnExists(tableName, columnName, definitionSql) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  const exists = Number(rows?.[0]?.cnt || 0) > 0;
  if (exists) return;

  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definitionSql}`);
}

/** At most one workflow row per entity_type (complaint, appointment, …). */
async function ensureUniqueWorkflowEntityTypeIndex() {
  const pool = getPool();
  const [idxRows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workflow'
       AND INDEX_NAME = 'uq_workflow_entity_type'`
  );
  if (Number(idxRows?.[0]?.cnt || 0) > 0) return;
  try {
    await pool.query('CREATE UNIQUE INDEX uq_workflow_entity_type ON workflow (entity_type)');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[db] could not create uq_workflow_entity_type (duplicate entity_type rows?). Keep one workflow per type, then restart:',
      err?.message || err
    );
  }
}

async function ensureAuthTables() {
  const pool = getPool();

  // Create minimal auth table if missing.
  // Password is stored as plain text (per your request).
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE,
        email VARCHAR(150) UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT fk_users_role
          FOREIGN KEY (role_id) REFERENCES user_role(id)
          ON DELETE SET NULL
      );
    `);
  } catch (err) {
    // If `user_role` doesn't exist yet, fall back to a version without FK.
    // This keeps the login functionality usable.
    // eslint-disable-next-line no-console
    console.warn('[db] could not create users FK to user_role, falling back:', err?.message || err);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) UNIQUE,
        email VARCHAR(150) UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INT DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_date TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      );
    `);
  }

  const seed = String(process.env.SEED_DEMO_USER || '').toLowerCase() === 'true';
  if (!seed) return;

  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  const count = rows && rows[0] ? Number(rows[0].cnt) : 0;
  if (count > 0) return;

  // Demo Super Admin user (plain-text password).
  const demoUsername = 'admin';
  const demoEmail = 'admin@dentalclinic.local';
  const demoPassword = 'admin123';
  const demoRoleId = 1; // from user_role seed in your dump (Super Admin)

  await pool.query(
    `INSERT INTO users (username, email, password, role_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [demoUsername, demoEmail, demoPassword, demoRoleId]
  );
}

async function ensureDoctorTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      specialization VARCHAR(100),
      experience INT,
      qualification VARCHAR(150),
      consultation_fee DECIMAL(10,2),
      available_days VARCHAR(100),
      available_time VARCHAR(100),
      profile_image_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_doctor_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_doctor_profile_image FOREIGN KEY (profile_image_id) REFERENCES attachment(id) ON DELETE SET NULL
    );
  `);

  await pool.query(
    `INSERT INTO user_role (role_name)
     SELECT 'Doctor'
     WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role_name = 'Doctor')`
  );
}

async function ensurePatientTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      blood_group VARCHAR(10),
      allergies TEXT,
      emergency_contact VARCHAR(20),
      gender VARCHAR(10),
      date_of_birth DATE,
      mobile VARCHAR(20),
      alternate_mobile VARCHAR(20),
      email VARCHAR(150),
      address_line1 VARCHAR(255),
      address_line2 VARCHAR(255),
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(20),
      emergency_contact_name VARCHAR(150),
      emergency_contact_number VARCHAR(20),
      medical_history TEXT,
      profile_image_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_patient_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_patient_profile_image FOREIGN KEY (profile_image_id) REFERENCES attachment(id) ON DELETE SET NULL
    );
  `);

  await pool.query(
    `INSERT INTO user_role (role_name)
     SELECT 'Patient'
     WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role_name = 'Patient')`
  );

  await ensureColumnExists('patient', 'gender', 'gender VARCHAR(10)');
  await ensureColumnExists('patient', 'date_of_birth', 'date_of_birth DATE');
  await ensureColumnExists('patient', 'mobile', 'mobile VARCHAR(20)');
  await ensureColumnExists('patient', 'alternate_mobile', 'alternate_mobile VARCHAR(20)');
  await ensureColumnExists('patient', 'email', 'email VARCHAR(150)');
  await ensureColumnExists('patient', 'address_line1', 'address_line1 VARCHAR(255)');
  await ensureColumnExists('patient', 'address_line2', 'address_line2 VARCHAR(255)');
  await ensureColumnExists('patient', 'city', 'city VARCHAR(100)');
  await ensureColumnExists('patient', 'state', 'state VARCHAR(100)');
  await ensureColumnExists('patient', 'pincode', 'pincode VARCHAR(20)');
  await ensureColumnExists('patient', 'emergency_contact_name', 'emergency_contact_name VARCHAR(150)');
  await ensureColumnExists('patient', 'emergency_contact_number', 'emergency_contact_number VARCHAR(20)');
  await ensureColumnExists('patient', 'medical_history', 'medical_history TEXT');
  await ensureColumnExists('patient', 'clinic_id', 'clinic_id BIGINT NULL');
  await ensureColumnExists('attachment', 'patient_id', 'patient_id BIGINT NULL');

  await backfillPatientUsersClinicIdFromPatientRow();
}

/** Align users.clinic_id with patient.clinic_id so per-clinic email rules apply to existing rows. */
async function backfillPatientUsersClinicIdFromPatientRow() {
  const pool = getPool();
  try {
    await pool.query(`
      UPDATE users u
      INNER JOIN patient p ON p.user_id = u.id
      INNER JOIN user_role r ON r.id = u.role_id
      SET u.clinic_id = p.clinic_id
      WHERE r.role_name = 'Patient'
        AND u.clinic_id IS NULL
        AND p.clinic_id IS NOT NULL
    `);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[db] backfillPatientUsersClinicIdFromPatientRow:', err?.message || err);
  }
}

async function ensureAppointmentTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointment (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      doctor_id BIGINT NOT NULL,
      appointment_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status ENUM('scheduled','completed','cancelled','no_show') DEFAULT 'scheduled',
      title VARCHAR(200),
      description TEXT,
      color VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE CASCADE,
      CONSTRAINT fk_appointment_doctor FOREIGN KEY (doctor_id) REFERENCES doctor(id) ON DELETE CASCADE,
      CONSTRAINT unique_doctor_slot UNIQUE (doctor_id, appointment_date, start_time)
    );
  `);

  await ensureColumnExists('appointment', 'clinic_id', 'clinic_id BIGINT NULL');
}

async function ensureStaffTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      staff_type ENUM(
        'office_staff',
        'counter_staff',
        'billing_staff',
        'security',
        'assistant',
        'other'
      ) DEFAULT 'other',
      department VARCHAR(100),
      can_login BOOLEAN DEFAULT TRUE,
      is_active BOOLEAN DEFAULT TRUE,
      joining_date DATE,
      salary DECIMAL(10,2),
      notes TEXT,
      profile_image_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_staff_profile_image FOREIGN KEY (profile_image_id) REFERENCES attachment(id) ON DELETE SET NULL
    );
  `);

  await pool.query(
    `INSERT INTO user_role (role_name)
     SELECT 'Staff'
     WHERE NOT EXISTS (SELECT 1 FROM user_role WHERE role_name = 'Staff')`
  );
}

async function ensureInventoryTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_item (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      category ENUM('consumable','medicine','equipment') NOT NULL,
      description TEXT,
      unit VARCHAR(50),
      min_stock INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_stock (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      item_id BIGINT NOT NULL,
      quantity INT NOT NULL,
      batch_number VARCHAR(100),
      expiry_date DATE,
      purchase_date DATE,
      purchase_price DECIMAL(10,2),
      supplier_name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_inventory_stock_item FOREIGN KEY (item_id) REFERENCES inventory_item(id)
        ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock_movement (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      item_id BIGINT NOT NULL,
      type ENUM('IN','OUT') NOT NULL,
      quantity INT NOT NULL,
      reference_type VARCHAR(50),
      reference_id BIGINT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_stock_movement_item FOREIGN KEY (item_id) REFERENCES inventory_item(id)
        ON DELETE CASCADE
    );
  `);
}

/**
 * Extends `attachment` with polymorphic entity metadata (no new tables).
 * Safe to run on DBs that already applied the same ALTER manually.
 */
/**
 * Existing databases may have entity_type without `complaint`; extend ENUM safely.
 */
async function ensureAttachmentEntityTypeIncludesComplaint() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE AS colType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'attachment'
       AND COLUMN_NAME = 'entity_type'`
  );
  const colType = rows && rows[0] && rows[0].colType ? String(rows[0].colType) : '';
  if (!colType || colType.includes("'complaint'")) return;

  await pool.query(`
    ALTER TABLE attachment MODIFY COLUMN entity_type
    ENUM('patient','doctor','appointment','billing','inventory','medical_record','complaint') NULL
  `);
}

async function ensureComplaintTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaint (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      clinic_id BIGINT NOT NULL,
      title VARCHAR(150) NOT NULL,
      description TEXT,
      category ENUM('equipment','electric','software','other') DEFAULT 'other',
      priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
      status ENUM('open','acknowledged','in_progress','resolved','rejected') DEFAULT 'open',
      created_by BIGINT NOT NULL,
      assigned_to BIGINT NULL,
      rejection_reason TEXT NULL,
      resolved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_clinic (clinic_id),
      INDEX idx_status (status),
      INDEX idx_priority (priority),
      CONSTRAINT fk_complaint_clinic FOREIGN KEY (clinic_id) REFERENCES clinic(id),
      CONSTRAINT fk_complaint_created_by FOREIGN KEY (created_by) REFERENCES users(id),
      CONSTRAINT fk_complaint_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaint_updates (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      complaint_id BIGINT NOT NULL,
      status ENUM('open','acknowledged','in_progress','resolved','rejected') NOT NULL,
      message TEXT,
      updated_by BIGINT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_complaint (complaint_id),
      CONSTRAINT fk_complaint_updates_complaint FOREIGN KEY (complaint_id) REFERENCES complaint(id) ON DELETE CASCADE,
      CONSTRAINT fk_complaint_updates_user FOREIGN KEY (updated_by) REFERENCES users(id)
    );
  `);
}

async function ensureWorkflowTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      entity_type VARCHAR(50),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_workflow_entity_active (entity_type, is_active)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_node (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      workflow_id BIGINT NOT NULL,
      node_type ENUM('start','state','action','decision','end') NOT NULL,
      name VARCHAR(100),
      label VARCHAR(100),
      config JSON,
      position_x INT,
      position_y INT,
      CONSTRAINT fk_workflow_node_workflow FOREIGN KEY (workflow_id) REFERENCES workflow(id) ON DELETE CASCADE,
      INDEX idx_workflow_node_workflow (workflow_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_edge (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      workflow_id BIGINT NOT NULL,
      from_node_id BIGINT,
      to_node_id BIGINT,
      condition_json JSON,
      CONSTRAINT fk_workflow_edge_workflow FOREIGN KEY (workflow_id) REFERENCES workflow(id) ON DELETE CASCADE,
      CONSTRAINT fk_workflow_edge_from FOREIGN KEY (from_node_id) REFERENCES workflow_node(id) ON DELETE CASCADE,
      CONSTRAINT fk_workflow_edge_to FOREIGN KEY (to_node_id) REFERENCES workflow_node(id) ON DELETE CASCADE
    );
  `);

  // Older DBs may have workflow_edge from before condition_json existed; CREATE IF NOT EXISTS does not add columns.
  await ensureColumnExists('workflow_edge', 'condition_json', 'condition_json JSON NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_execution (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id BIGINT NOT NULL,
      node_id BIGINT,
      action_taken VARCHAR(100),
      message TEXT,
      executed_by BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_workflow_exec_entity (entity_type, entity_id)
    );
  `);

  await ensureColumnExists('complaint', 'current_node_id', 'current_node_id BIGINT NULL');
  await ensureColumnExists('appointment', 'current_node_id', 'current_node_id BIGINT NULL');

  await ensureUniqueWorkflowEntityTypeIndex();

  await seedDefaultWorkflowGraphs(pool);
}

async function seedDefaultWorkflowGraphs(pool) {
  try {
    const [cWf] = await pool.query(
      `SELECT id FROM workflow WHERE entity_type = 'complaint' AND is_active = 1 ORDER BY id ASC LIMIT 1`
    );
    if (!cWf?.length) {
      const [insW] = await pool.query(
        `INSERT INTO workflow (name, entity_type, is_active) VALUES ('Default complaint flow', 'complaint', 1)`
      );
      const wid = Number(insW.insertId);
      const [insStart] = await pool.query(
        `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
         VALUES (?, 'start', 'start', 'Start', NULL, 0, 0)`,
        [wid]
      );
      const startId = Number(insStart.insertId);
      const stateCfg = JSON.stringify({
        syncComplaintStatus: 'open',
        allowedRoles: ['Staff', 'Admin', 'Super Admin', 'Doctor']
      });
      const [insState] = await pool.query(
        `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
         VALUES (?, 'state', 'submitted', 'Submitted', ?, 160, 0)`,
        [wid, stateCfg]
      );
      const stateId = Number(insState.insertId);
      await pool.query(
        `INSERT INTO workflow_edge (workflow_id, from_node_id, to_node_id, condition_json) VALUES (?, ?, ?, NULL)`,
        [wid, startId, stateId]
      );
    }

    const [aWf] = await pool.query(
      `SELECT id FROM workflow WHERE entity_type = 'appointment' AND is_active = 1 ORDER BY id ASC LIMIT 1`
    );
    if (!aWf?.length) {
      const [insW] = await pool.query(
        `INSERT INTO workflow (name, entity_type, is_active) VALUES ('Default appointment flow', 'appointment', 1)`
      );
      const wid = Number(insW.insertId);
      const [insStart] = await pool.query(
        `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
         VALUES (?, 'start', 'start', 'Start', NULL, 0, 0)`,
        [wid]
      );
      const startId = Number(insStart.insertId);
      const stateCfg = JSON.stringify({
        syncAppointmentStatus: 'scheduled',
        allowedRoles: ['Staff', 'Admin', 'Super Admin', 'Doctor']
      });
      const [insState] = await pool.query(
        `INSERT INTO workflow_node (workflow_id, node_type, name, label, config, position_x, position_y)
         VALUES (?, 'state', 'scheduled', 'Scheduled', ?, 160, 0)`,
        [wid, stateCfg]
      );
      const stateId = Number(insState.insertId);
      await pool.query(
        `INSERT INTO workflow_edge (workflow_id, from_node_id, to_node_id, condition_json) VALUES (?, ?, ?, NULL)`,
        [wid, startId, stateId]
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[db] seedDefaultWorkflowGraphs:', err?.message || err);
  }
}

async function ensureAttachmentMetadataColumns() {
  await ensureColumnExists(
    'attachment',
    'entity_type',
    "entity_type ENUM('patient','doctor','appointment','billing','inventory','medical_record','complaint') NULL"
  );
  await ensureColumnExists('attachment', 'entity_id', 'entity_id BIGINT NULL');
  await ensureColumnExists('attachment', 'document_type', 'document_type VARCHAR(100) NULL');
  await ensureColumnExists('attachment', 'title', 'title VARCHAR(150) NULL');
  await ensureColumnExists('attachment', 'description', 'description TEXT NULL');
  await ensureColumnExists('attachment', 'appointment_id', 'appointment_id BIGINT NULL');

  const pool = getPool();
  const [idxRows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'attachment'
       AND INDEX_NAME = 'idx_attachment_entity'`
  );
  if (Number(idxRows?.[0]?.cnt || 0) === 0) {
    try {
      await pool.query('CREATE INDEX idx_attachment_entity ON attachment (entity_type, entity_id)');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[db] could not create idx_attachment_entity:', err?.message || err);
    }
  }
}

async function ensureFinancialTables() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      patient_id BIGINT NOT NULL,
      appointment_id BIGINT,
      total_amount DECIMAL(10,2) NOT NULL,
      discount DECIMAL(10,2) DEFAULT 0,
      final_amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','partial','paid') DEFAULT 'pending',
      bill_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_billing_patient FOREIGN KEY (patient_id) REFERENCES patient(id) ON DELETE RESTRICT,
      CONSTRAINT fk_billing_appointment FOREIGN KEY (appointment_id) REFERENCES appointment(id) ON DELETE SET NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS billing_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      billing_id BIGINT NOT NULL,
      item_name VARCHAR(150),
      quantity INT DEFAULT 1,
      price DECIMAL(10,2),
      CONSTRAINT fk_billing_items_billing FOREIGN KEY (billing_id) REFERENCES billing(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      billing_id BIGINT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method ENUM('cash','card','upi','bank'),
      payment_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_payments_billing FOREIGN KEY (billing_id) REFERENCES billing(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(150),
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      payment_method ENUM('cash','card','upi','bank'),
      expense_date DATE NOT NULL,
      reference_type VARCHAR(50),
      reference_id BIGINT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('income','expense') NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      category VARCHAR(100),
      reference_type VARCHAR(50),
      reference_id BIGINT,
      payment_method ENUM('cash','card','upi','bank'),
      transaction_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = {
  ensureAuthTables,
  ensureDoctorTables,
  ensurePatientTables,
  ensureAppointmentTables,
  ensureStaffTables,
  ensureInventoryTables,
  ensureFinancialTables,
  ensureAttachmentMetadataColumns,
  ensureComplaintTables,
  ensureAttachmentEntityTypeIncludesComplaint,
  ensureWorkflowTables
};

