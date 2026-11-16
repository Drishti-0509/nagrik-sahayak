const STANDARD_SLA_HOURS = Object.freeze({
  Low: 120,
  Medium: 72,
  High: 48,
  Urgent: 24,
});

const PENDING_STATUSES = Object.freeze([
  'Submitted',
  'Received',
  'Under Review',
  'Assigned',
  'In Progress',
  'Reopened',
]);

const TERMINAL_STATUSES = Object.freeze([
  'Resolved',
  'Closed',
  'Rejected',
]);

const PRIORITY_RANK = Object.freeze({
  Urgent: 1,
  High: 2,
  Medium: 3,
  Low: 4,
});

/**
 * Calculate SLA deadline using standardized system SLA hours (Low: 120h, Medium: 72h, High: 48h, Urgent: 24h)
 * @param {string} priority - 'Low' | 'Medium' | 'High' | 'Urgent'
 * @param {Object} [_departmentSlaHours] - Deprecated override parameter kept for backward signature compatibility
 * @param {Date} [fromTime=new Date()]
 * @returns {Date} SLA deadline date
 */
function calculateDeadline(priority = 'Medium', _departmentSlaHours = null, fromTime = new Date()) {
  const hours = STANDARD_SLA_HOURS[priority] || STANDARD_SLA_HOURS.Medium;
  const baseDate = fromTime instanceof Date ? fromTime : new Date(fromTime);
  const baseMs = Number.isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();

  return new Date(baseMs + hours * 60 * 60 * 1000);
}

/**
 * Check if a complaint has breached SLA
 * Closed, Resolved, and Rejected complaints are never counted as overdue.
 * @param {Object} complaint
 * @returns {{ isOverdue: boolean, hoursRemaining: number, isBreached: boolean, overdueByHours: number }}
 */
function checkOverdue(complaint) {
  if (!complaint || !complaint.slaDeadline) {
    return { isOverdue: false, hoursRemaining: 0, isBreached: false, overdueByHours: 0 };
  }

  // Closed, Resolved, and Rejected complaints are never counted as overdue
  if (TERMINAL_STATUSES.includes(complaint.status)) {
    return { isOverdue: false, hoursRemaining: 0, isBreached: false, overdueByHours: 0 };
  }

  const now = Date.now();
  const deadlineTime = new Date(complaint.slaDeadline).getTime();
  if (Number.isNaN(deadlineTime)) {
    return { isOverdue: false, hoursRemaining: 0, isBreached: false, overdueByHours: 0 };
  }

  const diffMs = deadlineTime - now;
  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

  const isOverdue = diffMs < 0;
  const overdueByHours = isOverdue ? Math.abs(hoursRemaining) : 0;

  return {
    isOverdue,
    isBreached: isOverdue,
    hoursRemaining: isOverdue ? 0 : hoursRemaining,
    overdueByHours,
  };
}

module.exports = {
  STANDARD_SLA_HOURS,
  PENDING_STATUSES,
  TERMINAL_STATUSES,
  PRIORITY_RANK,
  calculateDeadline,
  checkOverdue,
};
