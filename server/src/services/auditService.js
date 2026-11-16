const AuditLog = require('../models/AuditLog');

/**
 * Log an administrative, status-change, or user-management action
 * @param {Object} options
 * @param {ObjectId} options.actor - User ObjectId who took the action
 * @param {string} options.actorName - Display name
 * @param {string} options.actorRole - 'citizen' | 'officer' | 'admin' | 'system'
 * @param {string} options.action - Action verb e.g. 'COMPLAINT_CREATED', 'STATUS_UPDATED', 'OFFICER_ASSIGNED'
 * @param {string} options.targetType - 'Complaint' | 'User' | 'Department' | 'System'
 * @param {ObjectId} [options.targetId] - Target document ObjectId
 * @param {Object} [options.details] - Non-sensitive metadata diff or parameters
 * @param {Object} [options.req] - Express request object for IP and User-Agent capture
 */
async function logAudit({
  actor,
  actorName,
  actorRole,
  action,
  targetType,
  targetId = null,
  details = {},
  req = null,
}) {
  try {
    const ipAddress =
      req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      '';
    const userAgent = req?.headers['user-agent'] || '';

    // Sanitize details: strip out passwords or secrets if present
    const safeDetails = { ...details };
    delete safeDetails.password;
    delete safeDetails.token;
    delete safeDetails.jwtSecret;

    const auditEntry = await AuditLog.create({
      actor,
      actorName,
      actorRole,
      action,
      targetType,
      targetId,
      details: safeDetails,
      ipAddress,
      userAgent: userAgent.substring(0, 200),
    });

    return auditEntry;
  } catch (err) {
    console.error('[AuditService] Failed to record audit log:', err.message);
    return null;
  }
}

module.exports = {
  logAudit,
};
