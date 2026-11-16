const ALLOWED_STATUSES = Object.freeze([
  'Submitted',
  'Received',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
]);

const TERMINAL_STATUSES = Object.freeze(['Resolved', 'Closed', 'Rejected']);
const REOPENABLE_STATUSES = Object.freeze(['Resolved', 'Closed', 'Rejected']);
const OFFICER_IMMUTABLE_STATUSES = new Set(TERMINAL_STATUSES);

const REOPEN_WINDOW_DAYS = 7;
const REOPEN_WINDOW_MS = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const OFFICER_TRANSITIONS = Object.freeze({
  Submitted: ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
  Received: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
  'Under Review': ['Assigned', 'In Progress', 'Resolved', 'Rejected'],
  Assigned: ['Received', 'Under Review', 'In Progress', 'Resolved', 'Rejected'],
  'In Progress': ['Under Review', 'Assigned', 'Resolved', 'Rejected'],
  Reopened: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected'],
});

const ADMIN_TRANSITIONS = Object.freeze({
  Submitted: ['Received', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Received: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  'Under Review': ['Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Assigned: ['Received', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  'In Progress': ['Under Review', 'Assigned', 'Resolved', 'Closed', 'Rejected'],
  Reopened: ['Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected'],
  Resolved: ['Closed', 'Reopened', 'In Progress'],
  Closed: ['Reopened'],
  Rejected: ['Reopened', 'Under Review'],
});

const CITIZEN_TRANSITIONS = Object.freeze({
  Resolved: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Rejected: ['Reopened'],
});

/**
 * Determine the anchor resolution/terminal timestamp used to evaluate the 7-day citizen reopen rule.
 * Checks resolvedAt first, then closedAt (when Closed), latest Rejected timeline timestamp, or updatedAt.
 * @param {Object} complaint
 * @returns {Date|null}
 */
function getReopenReferenceDate(complaint) {
  if (!complaint) return null;

  if (complaint.resolvedAt) {
    const resolved = new Date(complaint.resolvedAt);
    if (!Number.isNaN(resolved.getTime())) return resolved;
  }

  if (complaint.status === 'Closed' && complaint.closedAt) {
    const closed = new Date(complaint.closedAt);
    if (!Number.isNaN(closed.getTime())) return closed;
  }

  if (Array.isArray(complaint.timeline) && complaint.timeline.length > 0) {
    for (let i = complaint.timeline.length - 1; i >= 0; i--) {
      const entry = complaint.timeline[i];
      if (entry && entry.status === complaint.status && entry.timestamp) {
        const entryDate = new Date(entry.timestamp);
        if (!Number.isNaN(entryDate.getTime())) return entryDate;
      }
    }
  }

  if (complaint.updatedAt) {
    const updated = new Date(complaint.updatedAt);
    if (!Number.isNaN(updated.getTime())) return updated;
  }

  return null;
}

/**
 * Check if a citizen is allowed to reopen a complaint under the 7-day post-resolution rule.
 * @param {Object} complaint
 * @param {Date} [now=new Date()]
 * @returns {{ eligible: boolean, reason: string|null, deadline: Date|null, daysElapsed: number|null }}
 */
function checkReopenEligibility(complaint, now = new Date()) {
  if (!complaint) {
    return { eligible: false, reason: 'Complaint not found.', deadline: null, daysElapsed: null };
  }

  if (complaint.status === 'Reopened') {
    return {
      eligible: false,
      reason: 'Complaint has already been reopened and is awaiting departmental action.',
      deadline: null,
      daysElapsed: null,
    };
  }

  if (!REOPENABLE_STATUSES.includes(complaint.status)) {
    return {
      eligible: false,
      reason: 'Only resolved, closed, or rejected complaints can be reopened.',
      deadline: null,
      daysElapsed: null,
    };
  }

  const refDate = getReopenReferenceDate(complaint);
  if (!refDate) {
    return { eligible: true, reason: null, deadline: null, daysElapsed: 0 };
  }

  const refMs = refDate.getTime();
  const deadline = new Date(refMs + REOPEN_WINDOW_MS);
  const elapsedMs = now.getTime() - refMs;
  const daysElapsed = Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));

  if (elapsedMs > REOPEN_WINDOW_MS) {
    return {
      eligible: false,
      reason: `Reopening window expired: Complaints can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution.`,
      deadline,
      daysElapsed,
    };
  }

  return {
    eligible: true,
    reason: null,
    deadline,
    daysElapsed,
  };
}

/**
 * Validate whether an authenticated actor can perform a status transition on a complaint.
 * Enforces role permissions, department scoping, allowed state-machine edges, and the 7-day citizen reopen rule.
 * @param {Object} params
 * @param {Object} params.user
 * @param {Object} params.complaint
 * @param {string} params.targetStatus
 * @param {string} [params.notes]
 * @param {string} [params.resolutionNotes]
 * @param {Date} [params.now]
 * @returns {{ allowed: boolean, statusCode?: number, message?: string }}
 */
function validateStatusTransition({
  user,
  complaint,
  targetStatus,
  notes = '',
  resolutionNotes = '',
  now = new Date(),
}) {
  if (!targetStatus || !ALLOWED_STATUSES.includes(targetStatus)) {
    return {
      allowed: false,
      statusCode: 400,
      message: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`,
    };
  }

  if (user.role === 'citizen') {
    const citizenId = (complaint.citizen?._id || complaint.citizen)?.toString();
    if (citizenId !== user._id.toString()) {
      return {
        allowed: false,
        statusCode: 403,
        message: 'Access denied: You cannot alter another citizen’s grievance.',
      };
    }

    if (targetStatus === 'Closed') {
      if (complaint.status !== 'Resolved') {
        return {
          allowed: false,
          statusCode: 400,
          message: 'Only resolved complaints can be closed by the citizen.',
        };
      }
      return { allowed: true };
    }

    if (targetStatus === 'Reopened') {
      const eligibility = checkReopenEligibility(complaint, now);
      if (!eligibility.eligible) {
        return {
          allowed: false,
          statusCode: 400,
          message: eligibility.reason,
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      statusCode: 403,
      message:
        'Access denied: Citizens can only confirm closure (Closed) or request reopening of their grievances. Citizens cannot mark complaints resolved or in progress.',
    };
  }

  if (user.role === 'officer') {
    const assignedId = (complaint.assignedOfficer?._id || complaint.assignedOfficer)?.toString();
    const complaintDeptId = (complaint.department?._id || complaint.department)?.toString();
    const userDeptId = (user.department?._id || user.department)?.toString();

    const isAssigned = Boolean(assignedId && assignedId === user._id.toString());
    const isDept = Boolean(userDeptId && complaintDeptId && complaintDeptId === userDeptId);
    if (!isAssigned && !isDept) {
      return {
        allowed: false,
        statusCode: 403,
        message: 'Access denied: You are not authorized to update complaints outside your assigned department.',
      };
    }

    if (targetStatus === 'Closed') {
      return {
        allowed: false,
        statusCode: 403,
        message: 'Access denied: Grievance closure is reserved for citizen verification or administrative oversight.',
      };
    }

    if (OFFICER_IMMUTABLE_STATUSES.has(complaint.status)) {
      return {
        allowed: false,
        statusCode: 403,
        message: `Access denied: Officers cannot modify a complaint that is already ${complaint.status}.`,
      };
    }

    const allowedNext = OFFICER_TRANSITIONS[complaint.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      return {
        allowed: false,
        statusCode: 400,
        message: `Invalid status transition from "${complaint.status}" to "${targetStatus}".`,
      };
    }

    if (targetStatus === 'Resolved' && !String(resolutionNotes || '').trim() && !String(notes || '').trim()) {
      return {
        allowed: false,
        statusCode: 400,
        message: 'Resolution notes are required when marking a grievance as Resolved.',
      };
    }

    return { allowed: true };
  }

  if (user.role === 'admin') {
    const allowedNext = ADMIN_TRANSITIONS[complaint.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      return {
        allowed: false,
        statusCode: 400,
        message: `Invalid status transition from "${complaint.status}" to "${targetStatus}".`,
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    statusCode: 403,
    message: 'Access denied: Invalid user role.',
  };
}

/**
 * Create a structured, backward-compatible complaint timeline entry.
 */
function buildTimelineEntry({
  eventType = 'status_changed',
  status,
  actor,
  actorName,
  actorRole = 'system',
  description,
  timestamp = new Date(),
  isInternal = false,
  evidence = null,
}) {
  const safeDescription = String(description || '').trim();
  return {
    eventType,
    status,
    changedBy: actor,
    changedByName: actorName,
    changedByRole: actorRole,
    description: safeDescription,
    notes: safeDescription,
    isInternal: Boolean(isInternal),
    evidence,
    timestamp,
  };
}

module.exports = {
  ALLOWED_STATUSES,
  TERMINAL_STATUSES,
  REOPENABLE_STATUSES,
  OFFICER_IMMUTABLE_STATUSES,
  REOPEN_WINDOW_DAYS,
  REOPEN_WINDOW_MS,
  OFFICER_TRANSITIONS,
  ADMIN_TRANSITIONS,
  CITIZEN_TRANSITIONS,
  checkReopenEligibility,
  validateStatusTransition,
  buildTimelineEntry,
};

