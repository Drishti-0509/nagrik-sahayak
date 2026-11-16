const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const Notification = require('../src/models/Notification');
const {
  createNotification,
  sendEmailNotification,
  sendSmsNotification,
  buildEmailTemplate,
  setMockEmailTransporter,
  getLastDispatchedEmail,
  getLastDispatchedSms,
  clearNotificationMocks,
} = require('../src/services/notificationService');

describe('Phase 4D: External Email & SMS Notifications', () => {
  let citizenToken;
  let citizenUser;
  let department;

  beforeEach(async () => {
    clearNotificationMocks();
    await User.deleteMany({});
    await Department.deleteMany({});
    await Complaint.deleteMany({});
    await Notification.deleteMany({});

    department = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      description: 'Water pipelines and sanitation',
      categories: ['Water Supply'],
      slaHours: { Low: 120, Medium: 72, High: 48, Urgent: 24 },
      isActive: true,
    });

    citizenUser = await User.create({
      name: 'Ramesh Citizen',
      email: 'ramesh.citizen@example.com',
      password: 'Password123!',
      role: 'citizen',
      phone: '+919876543210',
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.citizen@example.com', password: 'Password123!' });
    citizenToken = loginRes.body.token;
  });

  describe('1. Email Notification Formatting & Dispatch', () => {
    it('builds civic email HTML template containing reference ID and link', () => {
      const html = buildEmailTemplate({
        title: 'Grievance Registered',
        message: 'Your grievance has been submitted successfully.',
        trackingId: 'NS-2026-88001',
      });

      expect(html).toContain('नागरिक सहायक | Nagrik Sahayak');
      expect(html).toContain('Grievance Registered');
      expect(html).toContain('NS-2026-88001');
      expect(html).toContain('/complaints/NS-2026-88001');
    });

    it('dispatches email through transporter without throwing errors', async () => {
      const result = await sendEmailNotification({
        to: 'ramesh.citizen@example.com',
        subject: '[Nagrik Sahayak] Grievance Registered - NS-2026-88002',
        html: '<p>Your complaint has been logged.</p>',
      });

      expect(result.success).toBe(true);
      const dispatched = getLastDispatchedEmail();
      expect(dispatched).toBeDefined();
      expect(dispatched.to).toBe('ramesh.citizen@example.com');
      expect(dispatched.subject).toContain('NS-2026-88002');
    });
  });

  describe('2. SMS Notification Formatting & Dispatch', () => {
    it('dispatches SMS through provider interface safely', async () => {
      const result = await sendSmsNotification({
        to: '+919876543210',
        message: 'Grievance NS-2026-88003 registered. SLA deadline is 24 hours.',
      });

      expect(result.success).toBe(true);
      const dispatchedSms = getLastDispatchedSms();
      expect(dispatchedSms).toBeDefined();
      expect(dispatchedSms.to).toBe('+919876543210');
      expect(dispatchedSms.message).toContain('NS-2026-88003');
    });
  });

  describe('3. Fault Tolerance & Provider Failure Resilience', () => {
    it('does NOT fail when email transporter throws connection error', async () => {
      // Simulate failing email transporter (e.g. SMTP server unreachable or auth failure)
      setMockEmailTransporter({
        sendMail: async () => {
          throw new Error('ECONNREFUSED: SMTP server offline');
        },
      });

      const emailResult = await sendEmailNotification({
        to: 'test@example.com',
        subject: 'Failing email test',
        html: '<p>Test</p>',
      });

      // Must capture error gracefully, return false, and NEVER crash or throw
      expect(emailResult.success).toBe(false);
      expect(emailResult.error).toContain('ECONNREFUSED');
    });

    it('persists in-app notification and complaint even if external email fails', async () => {
      // Configure failing transporter
      setMockEmailTransporter({
        sendMail: async () => {
          throw new Error('SMTP Timeout');
        },
      });

      // Submit complaint
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Burst water pipe leaking heavily',
          description: 'Water pipeline burst on central road flooding stores',
          category: 'Water Supply',
          departmentId: department._id.toString(),
          location: { address: 'Central Road', pincode: '302001' },
          priority: 'High',
        });

      // Complaint creation must succeed 201 regardless of external delivery failure
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.complaint.trackingId).toBeDefined();

      // In-app notification must still be created in database
      const notif = await Notification.findOne({
        recipient: citizenUser._id,
        trackingId: res.body.complaint.trackingId,
      });
      expect(notif).toBeDefined();
      expect(notif.title).toContain('Complaint Registered');
    });
  });
});
