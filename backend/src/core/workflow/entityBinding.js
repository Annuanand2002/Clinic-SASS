'use strict';

/**
 * Maps polymorphic workflow entity_type strings to physical tables and scope columns.
 */
const ENTITY_BINDINGS = Object.freeze({
  complaint: {
    table: 'complaint',
    idColumn: 'id',
    currentNodeColumn: 'current_node_id',
    scopeColumn: 'clinic_id'
  },
  appointment: {
    table: 'appointment',
    idColumn: 'id',
    currentNodeColumn: 'current_node_id',
    scopeColumn: 'clinic_id'
  }
});

function getEntityBinding(entityType) {
  if (!entityType || typeof entityType !== 'string') return null;
  return ENTITY_BINDINGS[entityType.trim()] || null;
}

function listSupportedEntityTypes() {
  return Object.keys(ENTITY_BINDINGS);
}

module.exports = {
  ENTITY_BINDINGS,
  getEntityBinding,
  listSupportedEntityTypes
};
