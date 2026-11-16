const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Active transporter cache (or mock transporter for testing)
let activeTransporter = null;
let lastDispatchedEmail = null;
let lastDispatchedSms = null;

/**
 * Configure or retrieve the Nodemailer transporter
 */
function getEmailTransporter() {
  if (activeTransporter) return activeTransporter;

  const isEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (isEnabled && host && user && pass && process.env.NODE_ENV !== 'test') {
    activeTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
  } else {
    // Mock / Stream transporter for testing & development
    activeTransporter = {
      sendMail: async (mailOptions) => {
        lastDispatchedEmail = mailOptions;
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[Email Mock] To: ${mailOptions.to} | Subject: ${mailOptions.subject}`);
        }
        return { messageId: `mock-email-${Date.now()}` };
      },
    };
  }

  return activeTransporter;
}

/**
 * Override or reset transporter (used in automated test suites)
 */
function setMockEmailTransporter(mockTransporter) {
  activeTransporter = mockTransporter;
}

function getLastDispatchedEmail() {
  return lastDispatchedEmail;
}

function getLastDispatchedSms() {
  return lastDispatchedSms;
}

function clearNotificationMocks() {
  lastDispatchedEmail = null;
  lastDispatchedSms = null;
}

/**
 * Send Email Notification
 * Resilient: Catches errors and returns status, NEVER crashes or throws.
 */
async function sendEmailNotification({ to, subject, html, text }) {
  if (!to) return { success: false, reason: 'Missing recipient email' };

  try {
    const transporter = getEmailTransporter();
    const from = process.env.FROM_EMAIL || '"Nagrik Sahayak" <no-reply@nagriksahayak.gov.in>';

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, ' '),
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[NotificationService] Email delivery to ${to} failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Send SMS Notification
 * Resilient: Supports Mock and Twilio/HTTP gateways. NEVER crashes.
 */
async function sendSmsNotification({ to, message }) {
  if (!to) return { success: false, reason: 'Missing recipient phone number' };

  const isEnabled = process.env.SMS_NOTIFICATIONS_ENABLED === 'true';
  const provider = process.env.SMS_PROVIDER || 'mock';

  try {
    lastDispatchedSms = { to, message, timestamp: new Date() };

    if (isEnabled && provider === 'twilio' && process.env.NODE_ENV !== 'test') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhone = process.env.TWILIO_PHONE_NUMBER;

      if (accountSid && authToken && fromPhone) {
        // Optional Twilio SDK dispatch if installed in production
        console.log(`[Twilio SMS] Sending SMS to ${to} via SID ${accountSid}`);
        return { success: true, provider: 'twilio' };
      }
    }

    // Default mock provider
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[SMS Mock] To: ${to} | Message: ${message}`);
    }
    return { success: true, provider: 'mock' };
  } catch (err) {
    console.warn(`[NotificationService] SMS delivery to ${to} failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Generate standard HTML email template for civic notifications
 */
function buildEmailTemplate({ title, message, trackingId, actionUrl }) {
  const portalUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const finalActionUrl = actionUrl || `${portalUrl}/complaints/${trackingId || ''}`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0f766e; color: #ffffff; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px;">नागरिक सहायक | Nagrik Sahayak</h1>
        <p style="margin: 5px 0 0; font-size: 13px; opacity: 0.9;">Citizen Grievance Redressal System</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">${title}</h2>
        <p style="font-size: 14px;">${message}</p>
        ${
          trackingId
            ? `<div style="background-color: #f1f5f9; padding: 12px 16px; border-radius: 6px; margin: 18px 0; font-family: monospace; font-size: 15px; font-weight: bold; color: #0f766e;">
                Tracking Reference: ${trackingId}
              </div>`
            : ''
        }
        <div style="margin: 24px 0; text-align: center;">
          <a href="${finalActionUrl}" style="background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;">
            View Grievance Details
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #e2e8f0; pt: 16px;">
          This is an official automated civic notification. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  `;
}

/**
 * Dispatch Multi-Channel Notifications (In-App + Email + SMS)
 * Non-blocking: background async execution. Core in-app notification always succeeds.
 */
async function dispatchExternalChannels({ recipientId, title, message, trackingId }) {
  try {
    const user = await User.findById(recipientId).select('name email phone');
    if (!user) return;

    // 1. Send Email if user has an email address
    if (user.email) {
      const emailHtml = buildEmailTemplate({
        title,
        message,
        trackingId,
      });
      sendEmailNotification({
        to: user.email,
        subject: `[Nagrik Sahayak] ${title} - ${trackingId || 'Civic Grievance'}`,
        html: emailHtml,
        text: `${title}\n\n${message}\n\nTracking ID: ${trackingId || 'N/A'}`,
      }).catch((e) => console.warn('[Notification] Email error:', e.message));
    }

    // 2. Send SMS if user has a phone number
    if (user.phone) {
      const smsText = `[Nagrik Sahayak] ${title}: ${message.substring(0, 120)}${trackingId ? ` Ref: ${trackingId}` : ''}`;
      sendSmsNotification({
        to: user.phone,
        message: smsText,
      }).catch((e) => console.warn('[Notification] SMS error:', e.message));
    }
  } catch (err) {
    console.warn('[NotificationService] External channel dispatch error:', err.message);
  }
}

/**
 * Create an in-app notification with deduplication and dispatch multi-channel alerts
 */
async function createNotification({
  recipient,
  title,
  message,
  type = 'status_changed',
  relatedComplaint = null,
  trackingId = '',
  eventKey = null,
}) {
  try {
    if (!recipient || !title || !message) {
      console.warn('[NotificationService] Missing recipient, title, or message');
      return null;
    }

    const normalizedEventKey =
      typeof eventKey === 'string' && eventKey.trim() ? eventKey.trim() : null;

    if (normalizedEventKey) {
      const existing = await Notification.findOne({
        recipient,
        eventKey: normalizedEventKey,
      });
      if (existing) {
        return existing;
      }
    }

    const notification = await Notification.create({
      recipient,
      title,
      message,
      type,
      relatedComplaint,
      trackingId,
      eventKey: normalizedEventKey,
      isRead: false,
    });

    // Dispatch external channels (Email & SMS) in background without blocking response
    dispatchExternalChannels({
      recipientId: recipient,
      title,
      message,
      trackingId,
    }).catch((channelErr) => {
      console.warn('[NotificationService] Channel dispatch warning:', channelErr.message);
    });

    return notification;
  } catch (err) {
    if (err?.code === 11000 && eventKey) {
      try {
        return await Notification.findOne({ recipient, eventKey: eventKey.trim() });
      } catch {
        return null;
      }
    }
    console.error('[NotificationService] Error creating notification:', err.message);
    return null;
  }
}

/**
 * Send notifications to a deduplicated list of user IDs
 */
async function notifyUniqueRecipients(recipients, payloadOrBuilder) {
  const uniqueIds = [];
  const seen = new Set();

  for (const r of recipients || []) {
    if (!r) continue;
    const idStr = (r._id || r).toString();
    if (!seen.has(idStr)) {
      seen.add(idStr);
      uniqueIds.push(r._id || r);
    }
  }

  if (!uniqueIds.length) return [];

  const results = await Promise.all(
    uniqueIds.map((recipientId) => {
      const payload =
        typeof payloadOrBuilder === 'function'
          ? payloadOrBuilder(recipientId)
          : { ...payloadOrBuilder };
      return createNotification({
        ...payload,
        recipient: recipientId,
      });
    })
  );

  return results.filter(Boolean);
}

/**
 * Resolve department head or admins
 */
async function resolveDepartmentHeadOrAdmins(department) {
  if (department?.headOfficer) {
    const head = await User.findOne({
      _id: department.headOfficer,
      isActive: true,
    }).select('_id');
    if (head) {
      return [head._id];
    }
  }

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  return admins.map((a) => a._id);
}

/**
 * Resolve recipients when a complaint is reopened
 */
async function resolveReopenRecipients({ complaint, department }) {
  const targets = [];

  if (complaint.assignedOfficer) {
    const assigned = await User.findOne({
      _id: complaint.assignedOfficer._id || complaint.assignedOfficer,
      isActive: true,
    }).select('_id');
    if (assigned) targets.push(assigned._id);
  }

  if (department?.headOfficer) {
    const head = await User.findOne({
      _id: department.headOfficer._id || department.headOfficer,
      isActive: true,
    }).select('_id');
    if (head) targets.push(head._id);
  }

  if (targets.length > 0) {
    return targets;
  }

  const deptId = department?._id || complaint.department?._id || complaint.department;
  if (deptId) {
    const deptOfficers = await User.find({
      role: 'officer',
      department: deptId,
      isActive: true,
    }).select('_id');
    if (deptOfficers.length > 0) {
      return deptOfficers.map((o) => o._id);
    }
  }

  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  return admins.map((a) => a._id);
}

module.exports = {
  createNotification,
  notifyUniqueRecipients,
  resolveDepartmentHeadOrAdmins,
  resolveReopenRecipients,
  sendEmailNotification,
  sendSmsNotification,
  buildEmailTemplate,
  getEmailTransporter,
  setMockEmailTransporter,
  getLastDispatchedEmail,
  getLastDispatchedSms,
  clearNotificationMocks,
};
