const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const Notification = require('../src/models/Notification');

describe('Phase 3 Corrective Patch: Officer Complaint Claim / Assignment', () => {
  let adminToken;
  let elecDept, waterDept;
  let jeenuOfficer, jeenuToken;
  let rahulOfficer, rahulToken;
  let sureshOfficer, sureshToken;
  let citizenUser, citizenToken;

  beforeEach(async () => {
    // 1. Create Admin
    const admin = await User.create({
      name: 'System Admin',
      email: 'admin.claim@portal.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    adminToken = jwt.sign({ id: admin._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    // 2. Create Departments
    elecDept = await Department.create({
      name: 'Electricity & Energy',
      code: 'ELEC',
      categories: ['Electricity'],
      isActive: true,
    });
    waterDept = await Department.create({
      name: 'Water Supply',
      code: 'WATER',
      categories: ['Water Supply'],
      isActive: true,
    });

    // 3. Create Officers
    jeenuOfficer = await User.create({
      name: 'Jeenu Sharma',
      email: 'jeenu.claim@portal.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      department: elecDept._id,
      isActive: true,
    });
    jeenuToken = jwt.sign({ id: jeenuOfficer._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    rahulOfficer = await User.create({
      name: 'Rahul Verma',
      email: 'rahul.claim@portal.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      department: elecDept._id,
      isActive: true,
    });
    rahulToken = jwt.sign({ id: rahulOfficer._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    sureshOfficer = await User.create({
      name: 'Suresh Kumar',
      email: 'suresh.claim@portal.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      department: waterDept._id,
      isActive: true,
    });
    sureshToken = jwt.sign({ id: sureshOfficer._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    // 4. Create Citizen
    citizenUser = await User.create({
      name: 'Priya Sharma',
      email: 'priya.claim@example.com',
      password: 'CitizenPassword123!',
      role: 'citizen',
      phone: '9876543210',
      address: 'Jaipur, Rajasthan',
      isActive: true,
    });
    citizenToken = jwt.sign({ id: citizenUser._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  });

  it('1. allows an officer to successfully self-claim an unassigned complaint in their department', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11101',
      title: 'Street light broken near circle',
      description: 'The light pole has been completely dark causing safety risk.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Circle 4, Malviya Nagar' },
      priority: 'Medium',
      slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Submitted',
      assignedOfficer: null,
    });

    const res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: elecDept._id,
        notes: 'Officer self-claimed grievance from department pool',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.complaint.assignedOfficer).toBe(jeenuOfficer._id.toString());
    expect(res.body.complaint.status).toBe('Assigned');

    const updated = await Complaint.findById(complaint._id);
    expect(updated.assignedOfficer.toString()).toBe(jeenuOfficer._id.toString());
    expect(updated.status).toBe('Assigned');
  });

  it('2. updates dashboard counts and removes complaint from unassigned pool upon claiming', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11102',
      title: 'High voltage fluctuation',
      description: 'Voltage surges frequently damaging appliances.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Block B, Sector 5' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Submitted',
      assignedOfficer: null,
    });

    // Before claim
    const statsBefore = await request(app)
      .get('/api/v1/analytics/officer')
      .set('Authorization', `Bearer ${jeenuToken}`);

    expect(statsBefore.status).toBe(200);
    expect(statsBefore.body.stats.assignedToMe.total).toBe(0);
    expect(statsBefore.body.stats.unassignedDepartment.total).toBe(1);

    // Jeenu claims the complaint
    const claimRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: elecDept._id,
      });

    expect(claimRes.status).toBe(200);

    // After claim
    const statsAfter = await request(app)
      .get('/api/v1/analytics/officer')
      .set('Authorization', `Bearer ${jeenuToken}`);

    expect(statsAfter.status).toBe(200);
    expect(statsAfter.body.stats.assignedToMe.total).toBe(1);
    expect(statsAfter.body.stats.assignedToMe.pending).toBe(1);
    expect(statsAfter.body.stats.unassignedDepartment.total).toBe(0);
  });

  it('3. rejects cross-department claim attempted by an officer from a different department', async () => {
    const waterComplaint = await Complaint.create({
      trackingId: 'NS-2026-11103',
      title: 'Water pipe leakage',
      description: 'Major leak on main pipeline.',
      category: 'Water Supply',
      department: waterDept._id,
      citizen: citizenUser._id,
      location: { address: 'Sector 2 water pump' },
      priority: 'Urgent',
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'Submitted',
      assignedOfficer: null,
    });

    // Jeenu (Electricity) attempts to claim a Water Supply complaint
    const res = await request(app)
      .put(`/api/v1/complaints/${waterComplaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: waterDept._id,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/outside your department/i);

    const doc = await Complaint.findById(waterComplaint._id);
    expect(doc.assignedOfficer).toBeNull();
  });

  it('4. rejects an already-assigned complaint from being claimed by another officer', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11104',
      title: 'Transformer sparking',
      description: 'Sparking noticed near transformer.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Substation 9' },
      priority: 'Urgent',
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'Assigned',
      assignedOfficer: jeenuOfficer._id, // Already assigned to Jeenu
    });

    // Rahul attempts to claim or reassign Jeenu's complaint
    const res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${rahulToken}`)
      .send({
        officerId: rahulOfficer._id,
        departmentId: elecDept._id,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already been assigned to another officer/i);

    const doc = await Complaint.findById(complaint._id);
    expect(doc.assignedOfficer.toString()).toBe(jeenuOfficer._id.toString());
  });

  it('5. handles duplicate self-claim attempts safely with clear message', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11105',
      title: 'Meter replacement pending',
      description: 'Defective meter needs replacement.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'House 88' },
      priority: 'Low',
      slaDeadline: new Date(Date.now() + 120 * 3600 * 1000),
      status: 'Assigned',
      assignedOfficer: jeenuOfficer._id,
    });

    // Jeenu clicks claim again on an already owned complaint
    const res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: elecDept._id,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already assigned to you/i);
  });

  it('6. records timeline attribution with officer identity and details', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11106',
      title: 'Underground cable damaged',
      description: 'Excavation broke underground wiring.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Main Road Ward 3' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Submitted',
      assignedOfficer: null,
      timeline: [
        {
          eventType: 'submitted',
          status: 'Submitted',
          changedBy: citizenUser._id,
          changedByName: citizenUser.name,
          changedByRole: 'citizen',
          description: 'Grievance submitted by citizen',
          timestamp: new Date(),
        },
      ],
    });

    const res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: elecDept._id,
        notes: 'Claimed by field inspection officer',
      });

    expect(res.status).toBe(200);

    const doc = await Complaint.findById(complaint._id);
    expect(doc.timeline.length).toBe(2);

    const assignEvent = doc.timeline[1];
    expect(assignEvent.eventType).toBe('officer_assigned');
    expect(assignEvent.changedBy.toString()).toBe(jeenuOfficer._id.toString());
    expect(assignEvent.changedByName).toBe('Jeenu Sharma');
    expect(assignEvent.changedByRole).toBe('officer');
    expect(assignEvent.description).toContain('Jeenu Sharma');
    expect(assignEvent.description).toContain('Electricity & Energy');
    expect(assignEvent.description).toContain('Claimed by field inspection officer');
  });

  it('7. generates appropriate notifications for both officer and citizen upon self-claim', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11107',
      title: 'Power outage in residential colony',
      description: 'Entire block has no power since 2 hours.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Colony Sector 4' },
      priority: 'Urgent',
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'Submitted',
      assignedOfficer: null,
    });

    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        officerId: jeenuOfficer._id,
        departmentId: elecDept._id,
      });

    const notifications = await Notification.find({ relatedComplaint: complaint._id });
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // Officer notification
    const officerNotification = notifications.find(
      (n) => n.recipient.toString() === jeenuOfficer._id.toString()
    );
    expect(officerNotification).toBeDefined();
    expect(officerNotification.title).toBe('New Complaint Assigned');
    expect(officerNotification.type).toBe('complaint_assigned');

    // Citizen notification
    const citizenNotification = notifications.find(
      (n) => n.recipient.toString() === citizenUser._id.toString()
    );
    expect(citizenNotification).toBeDefined();
    expect(citizenNotification.title).toBe('Complaint Assigned');
    expect(citizenNotification.message).toContain('Jeenu Sharma');
    expect(citizenNotification.type).toBe('complaint_assigned');
  });

  it('8. preserves full admin assignment and transfer capabilities', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-11108',
      title: 'Administrative transfer test',
      description: 'Ticket to verify admin reassignment and department transfer.',
      category: 'Electricity',
      department: elecDept._id,
      citizen: citizenUser._id,
      location: { address: 'Secretariat Road' },
      priority: 'Medium',
      slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Assigned',
      assignedOfficer: jeenuOfficer._id, // Already assigned to Jeenu
    });

    // Admin can reassign from Jeenu to Rahul
    const reassignRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        officerId: rahulOfficer._id,
        departmentId: elecDept._id,
        notes: 'Admin workload balancing reassignment',
      });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.complaint.assignedOfficer).toBe(rahulOfficer._id.toString());

    // Admin can transfer complaint across departments to Water Supply
    const transferRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        departmentId: waterDept._id,
        officerId: sureshOfficer._id,
        notes: 'Wrong department filed, transferred to Water Supply',
      });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.complaint.department).toBe(waterDept._id.toString());
    expect(transferRes.body.complaint.assignedOfficer).toBe(sureshOfficer._id.toString());
  });
});

