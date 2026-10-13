/**
 * DentaCare - Amallar tarixi va Audit log tizimi
 */
class AuditLogger {
  constructor(db) {
    this.db = db;
  }

  async log({ action, entityType, entityId, performedById, performedByName, details }) {
    try {
      if (this.db && this.db.isReady()) {
        await this.db.query(
          `INSERT INTO audit_logs (action, entity_type, entity_id, performed_by_id, performed_by_name, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            action,
            entityType,
            entityId || null,
            performedById || null,
            performedByName || 'Tizim',
            details ? JSON.stringify(details) : null,
          ]
        );
      }
    } catch (err) {
      console.warn('[AuditLogger] Log yozishda xatolik:', err.message);
    }
  }
}

module.exports = AuditLogger;
