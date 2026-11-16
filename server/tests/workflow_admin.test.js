const request = require('supertest');
const { app } = require('../src/server');
const Department = require('../src/models/Department');
const User = require('../src/models/User');
const Complaint = require('../src/models/Complaint');

describe('Full Redressal Workflow: Administration, Assignment, SLA & Notifications', () => {
  let adminToken, adminUser;
  let officerToken, officerUser;
  let citizenToken, citizenUser;
  let departmentId;
  let complaintId, trackingId;

  beforeEach(async () => {
    // 1. Create Admin
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@test.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@test.gov.in',
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.token;

    // 2. Admin creates Department
    const deptRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Sanitation & Solid Waste',
        code: 'SSW',
        description: 'Municipal sanitation and waste management division',
        categories: ['Sanitation and Waste Management'],
        slaHours: { Low: 72, Medium: 48, High: 24, Urgent: 12 },
      });
    departmentId = deptRes.body.department._id;

    // 3. Admin creates Officer
    const officerRes = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Inspector Vijay Kumar',
        email: 'vijay@sanitation.gov.in',
        password: 'OfficerPassword123!',
        departmentId: departmentId,
        phone: '9811223344',
      });
    officerUser = officerRes.body.user;

    const officerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'vijay@sanitation.gov.in',
      password: 'OfficerPassword123!',
    });
    officerToken = officerLogin.body.token;

    // 4. Register Citizen
    const citizenRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Pooja Verma',
      email: 'pooja@citizen.in',
      password: 'CitizenPassword123!',
      phone: '9899001122',
      address: 'Pocket 3, Sector 9, Dwarka',
    });
    citizenToken = citizenRes.body.token;
    citizenUser = citizenRes.body.user;
  });

  it('should complete full complaint lifecycle: submit -> assign -> progress -> resolve -> notify', async () => {
    // A. Citizen submits complaint
    const submitRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Overflowing community garbage dump near park',
        description: 'Garbage dumpster has been overflowing for 3 days and emitting terrible stench.',
        category: 'Sanitation and Waste Management',
        location: { address: 'Park Gate 3, Sector 9' },
        priority: 'Medium',
      });

    expect(submitRes.statusCode).toBe(201);
    complaintId = submitRes.body.complaint._id;
    trackingId = submitRes.body.complaint.trackingId;
    expect(trackingId).toMatch(/^NS-\d{4}-\d{5}$/);

    // B. Admin assigns complaint to Officer
    const assignRes = await request(app)
      .put(`/api/v1/complaints/${complaintId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId,
        officerId: officerUser._id,
        priority: 'High',
        notes: 'Dispatched sanitation truck 14 for prompt clearance.',
      });

    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.body.complaint.status).toBe('Assigned');
    expect(assignRes.body.complaint.assignedOfficer).toBe(officerUser._id);
    expect(assignRes.body.complaint.priority).toBe('High');

    // C. Officer updates status to In Progress
    const progressRes = await request(app)
      .put(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        status: 'In Progress',
        notes: 'Sanitation team arrived on site with compactor vehicle.',
      });

    expect(progressRes.statusCode).toBe(200);
    expect(progressRes.body.complaint.status).toBe('In Progress');

    // D. Officer resolves complaint with resolution notes
    const resolveRes = await request(app)
      .put(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        status: 'Resolved',
        notes: 'Dump cleared and bleaching powder sprinkled.',
        resolutionNotes: 'Compactor vehicle cleared 2.5 tons of backlog. Site sanitized.',
      });

    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.body.complaint.status).toBe('Resolved');
    expect(resolveRes.body.complaint.resolvedAt).toBeDefined();
    expect(resolveRes.body.complaint.resolutionNotes).toMatch(/Compactor vehicle cleared/i);

    // E. Citizen checks notifications
    const notifRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(notifRes.statusCode).toBe(200);
    expect(notifRes.body.notifications.length).toBeGreaterThanOrEqual(1);

    // Mark notification as read
    const notifId = notifRes.body.notifications[0]._id;
    const markReadRes = await request(app)
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(markReadRes.statusCode).toBe(200);
    expect(markReadRes.body.notification.isRead).toBe(true);

    // F. Citizen requests to reopen
    const reopenRes = await request(app)
      .put(`/api/v1/complaints/${complaintId}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        status: 'Reopened',
        notes: 'Bins are clean but nearby pavement is still littered with debris.',
      });

    expect(reopenRes.statusCode).toBe(200);
    expect(reopenRes.body.complaint.status).toBe('Reopened');
    expect(reopenRes.body.complaint.isEscalated).toBe(true); // Reopened automatically flags escalation
  });

  it('should compute real database metrics on Citizen, Officer, and Admin dashboards', async () => {
    // Submit 2 complaints
    await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Streetlight pole broken and dark',
        description: 'Complete blackout on residential lane causing safety concerns.',
        category: 'Public Safety',
        location: { address: 'Lane 4' },
      });

    // Check Citizen Stats
    const citizenStatsRes = await request(app)
      .get('/api/v1/analytics/citizen')
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(citizenStatsRes.statusCode).toBe(200);
    expect(citizenStatsRes.body.stats.total).toBe(1);
    expect(citizenStatsRes.body.stats.submitted).toBe(1);

    // Check Admin Stats
    const adminStatsRes = await request(app)
      .get('/api/v1/analytics/admin')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminStatsRes.statusCode).toBe(200);
    expect(adminStatsRes.body.stats.totalComplaints).toBeGreaterThanOrEqual(1);
    expect(adminStatsRes.body.stats.totalCitizens).toBe(1);
    expect(adminStatsRes.body.stats.totalOfficers).toBe(1);
    expect(adminStatsRes.body.charts.byCategory).toBeDefined();
    expect(adminStatsRes.body.charts.byStatus).toBeDefined();
  });

  it('should enforce role-based access: Citizen cannot access Admin or Officer analytics', async () => {
    const adminAnalyticsRes = await request(app)
      .get('/api/v1/analytics/admin')
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(adminAnalyticsRes.statusCode).toBe(403);
    expect(adminAnalyticsRes.body.success).toBe(false);

    const officerAnalyticsRes = await request(app)
      .get('/api/v1/analytics/officer')
      .set('Authorization', `Bearer ${citizenToken}`);

    expect(officerAnalyticsRes.statusCode).toBe(403);
    expect(officerAnalyticsRes.body.success).toBe(false);
  });
});
