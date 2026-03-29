const app = require('./web/app');
const { loadEnv } = require('./core/config/env');
const {
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
} = require('./core/db/initSchema');

async function bootstrap() {
  loadEnv();
  await ensureAuthTables();
  await ensureDoctorTables();
  await ensurePatientTables();
  await ensureAppointmentTables();
  await ensureStaffTables();
  await ensureInventoryTables();
  await ensureFinancialTables();
  await ensureAttachmentMetadataColumns();
  await ensureAttachmentEntityTypeIncludesComplaint();
  await ensureComplaintTables();
  await ensureWorkflowTables();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap error]', err);
  process.exit(1);
});

