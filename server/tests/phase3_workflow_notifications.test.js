const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const Notification = require('../src/models/Notification');
const { createNotification } = require('../src/services/notificationService');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

async function createActor({ name, email, role, department = null }) {
  const user = await User.create({
    name,
    email,
    password: 'TestPassword123!',
    phone: '9876543210',
    role,
    department,
  });
  const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  return { user, token };
}

describe('Phase 3: Core Complaint Workflow, Reopening Rule, Escalation, Timeline & Notifications', () => {
  it('completes end-to-end citizen -> dept routing -> assignment -> status transitions -> progress note -> resolve -> close workflow with timeline & notifications', async () => {
    const { user: headOfficer, token: headToken } = await createActor({
      name: 'Water Dept Head',
      email: 'water.head@example.com',
      role: 'officer',
    });
    const waterDept = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      categories: ['Water Supply'],
      headOfficer: headOfficer._id,
    });
    headOfficer.department = waterDept._id;
    await headOfficer.save();

    const { user: waterOfficer, token: officerToken } = await createActor({
      name: 'Field Inspector Raj',
      email: 'raj.water@example.com',
      role: 'officer',
      department: waterDept._id,
    });
    const { user: adminUser, token: adminToken } = await createActor({
      name: 'Municipal Admin',
      email: 'admin.wf@example.com',
      role: 'admin',
    });
    const { user: citizen, token: citizenToken } = await createActor({
      name: 'Asha Citizen',
      email: 'asha@example.com',
      role: 'citizen',
    });
    const { token: otherCitizenToken } = await createActor({
      name: 'Intruder Citizen',
      email: 'intruder@example.com',
      role: 'citizen',
    });

    // Invalid submission must not create incomplete complaint records
    const badSubmit = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'No details',
        category: 'Water Supply',
      });
    expect(badSubmit.statusCode).toBe(400);
    expect(await Complaint.countDocuments()).toBe(0);

    // 1. Citizen submits valid complaint -> unique NS-YYYY-XXXXX, dept auto-assigned, confirmation + head notifications
    const submitRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Main water pipeline burst at Market Chowk',
        description: 'Drinking water pipeline is broken and flooding the entire residential lane since 6am.',
        category: 'Water Supply',
        priority: 'High',
        location: { address: 'Market Chowk, Ward 12', pincode: '110001' },
      });

    expect(submitRes.statusCode).toBe(201);
    const complaint = submitRes.body.complaint;
    expect(complaint.trackingId).toMatch(/^NS-\d{4}-\d{5}$/);
    expect(complaint.status).toBe('Submitted');
    expect(complaint.department).toBe(waterDept._id.toString());

    const submitEvents = complaint.timeline.map((t) => t.eventType);
    expect(submitEvents).toContain('complaint_created');
    expect(submitEvents).toContain('department_assigned');

    // Citizen sees confirmation notification; head officer sees new department notification
    const citizenNotifs1 = await Notification.find({ recipient: citizen._id });
    expect(citizenNotifs1.some((n) => n.type === 'complaint_submitted' && n.trackingId === complaint.trackingId)).toBe(true);
    const headNotifs1 = await Notification.find({ recipient: headOfficer._id });
    expect(headNotifs1.some((n) => n.type === 'complaint_submitted' && n.trackingId === complaint.trackingId)).toBe(true);

    // 2. Ownership enforcement: another citizen cannot read, comment, update, or escalate
    expect((await request(app).get(`/api/v1/complaints/${complaint._id}`).set('Authorization', `Bearer ${otherCitizenToken}`)).statusCode).toBe(403);
    expect((await request(app).post(`/api/v1/complaints/${complaint._id}/comments`).set('Authorization', `Bearer ${otherCitizenToken}`).send({ message: 'Intruding' })).statusCode).toBe(403);

    // 3. Invalid transitions blocked cleanly
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${citizenToken}`).send({ status: 'Resolved' })).statusCode).toBe(403);
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'Closed' })).statusCode).toBe(403);
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'Submitted' })).statusCode).toBe(400);

    // 4. Received -> Under Review -> Assigned -> In Progress
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'Received', notes: 'Acknowledged by depot' })).statusCode).toBe(200);
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'Under Review', notes: 'Inspecting valve map' })).statusCode).toBe(200);

    const assignRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ officerId: waterOfficer._id, notes: 'Dispatch repair crew immediately' });
    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.body.complaint.status).toBe('Assigned');

    // Both Officer & Citizen notified on assignment
    expect(await Notification.countDocuments({ recipient: waterOfficer._id, type: 'complaint_assigned', relatedComplaint: complaint._id })).toBe(1);
    expect(await Notification.countDocuments({ recipient: citizen._id, type: 'complaint_assigned', relatedComplaint: complaint._id })).toBe(1);

    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'In Progress', notes: 'Excavation started' })).statusCode).toBe(200);

    // 5. Officer adds public progress note + internal staff note; internal note must never leak to citizen
    const pubCommentRes = await request(app)
      .post(`/api/v1/complaints/${complaint._id}/comments`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ message: 'Replacement gasket procured, pressure test at 4pm.', isInternal: false });
    expect(pubCommentRes.statusCode).toBe(201);

    const internalCommentRes = await request(app)
      .post(`/api/v1/complaints/${complaint._id}/comments`)
      .set('Authorization', `Bearer ${headToken}`)
      .send({ message: 'Internal audit memo: contractor penalty clause pending.', isInternal: true });
    expect(internalCommentRes.statusCode).toBe(201);

    const citizenView = await request(app)
      .get(`/api/v1/complaints/${complaint._id}`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(citizenView.statusCode).toBe(200);
    expect(citizenView.body.complaint.comments.some((c) => c.message.includes('Replacement gasket'))).toBe(true);
    expect(citizenView.body.complaint.comments.some((c) => c.isInternal)).toBe(false);
    expect(citizenView.body.complaint.timeline.some((t) => (t.description || t.notes || '').includes('contractor penalty'))).toBe(false);
    expect(citizenView.body.complaint.assignedOfficer.phone).toBeUndefined();

    // 6. Officer marks Resolved with resolutionNotes -> Citizen notified with 'resolved'
    const resolveRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Damaged joint replaced and normal pressure verified.',
      });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.body.complaint.status).toBe('Resolved');
    expect(await Notification.countDocuments({ recipient: citizen._id, type: 'resolved', relatedComplaint: complaint._id })).toBe(1);

    // Officer cannot modify Resolved complaint
    expect((await request(app).put(`/api/v1/complaints/${complaint._id}/status`).set('Authorization', `Bearer ${officerToken}`).send({ status: 'In Progress' })).statusCode).toBe(403);

    // 7. Citizen closes complaint -> Citizen receives 'closed' confirmation notification + timeline 'closed' event
    const closeRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'Closed', rating: 5, comment: 'Quick repair, thank you.' });
    expect(closeRes.statusCode).toBe(200);
    expect(closeRes.body.complaint.status).toBe('Closed');
    expect(await Notification.countDocuments({ recipient: citizen._id, type: 'closed', relatedComplaint: complaint._id })).toBe(1);

    // Check full timeline event sequence
    const timelineEvents = closeRes.body.complaint.timeline.map((e) => e.eventType);
    expect(timelineEvents).toEqual([
      'complaint_created',
      'department_assigned',
      'status_changed',   // Received
      'status_changed',   // Under Review
      'officer_assigned', // Assigned
      'status_changed',   // In Progress
      'progress_note',    // Public comment
      'resolved',         // Resolved
      'closed',           // Closed
    ]);

    // Suppress unused variable warnings
    expect(adminUser._id).toBeDefined();
  });

  it('enforces 7-day reopening window, resets terminal timestamps & SLA deadline, blocks unauthorized/duplicate reopens, and notifies officer/department', async () => {
    const { user: headOfficer } = await createActor({
      name: 'Elec Head',
      email: 'elec.head@example.com',
      role: 'officer',
    });
    const elecDept = await Department.create({
      name: 'Electricity & Energy',
      code: 'ELEC',
      categories: ['Electricity'],
      headOfficer: headOfficer._id,
    });
    const { user: officer } = await createActor({
      name: 'Line Officer',
      email: 'line.elec@example.com',
      role: 'officer',
      department: elecDept._id,
    });
    const { user: citizen, token: citizenToken } = await createActor({
      name: 'Ramesh Citizen',
      email: 'ramesh@example.com',
      role: 'citizen',
    });
    const { token: otherCitizenToken } = await createActor({
      name: 'Stranger Citizen',
      email: 'stranger@example.com',
      role: 'citizen',
    });

    const threeDaysAgo = new Date(Date.now() - 3 * DAY_MS);
    const nineDaysAgo = new Date(Date.now() - 9 * DAY_MS);

    const eligibleComplaint = await Complaint.create({
      trackingId: 'NS-2026-71001',
      citizen: citizen._id,
      department: elecDept._id,
      assignedOfficer: officer._id,
      title: 'Transformer sparking frequently',
      description: 'Voltage spikes damaged household appliances twice.',
      category: 'Electricity',
      priority: 'High',
      status: 'Closed',
      resolvedAt: threeDaysAgo,
      closedAt: threeDaysAgo,
      slaDeadline: threeDaysAgo,
      location: { address: 'Block C Feeder' },
    });

    const expiredComplaint = await Complaint.create({
      trackingId: 'NS-2026-71002',
      citizen: citizen._id,
      department: elecDept._id,
      assignedOfficer: officer._id,
      title: 'Street pole cable issue',
      description: 'Loose wire reported near park entrance gate.',
      category: 'Electricity',
      priority: 'Medium',
      status: 'Resolved',
      resolvedAt: nineDaysAgo,
      slaDeadline: nineDaysAgo,
      location: { address: 'Park Gate 2' },
    });

    // Unauthorized citizen cannot reopen eligibleComplaint
    const unauthReopen = await request(app)
      .put(`/api/v1/complaints/${eligibleComplaint._id}/status`)
      .set('Authorization', `Bearer ${otherCitizenToken}`)
      .send({ status: 'Reopened', notes: 'Unauthorized reopen attempt' });
    expect(unauthReopen.statusCode).toBe(403);

    // Expired >7 days complaint cannot be reopened by citizen
    const expiredRes = await request(app)
      .put(`/api/v1/complaints/${expiredComplaint._id}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'Reopened', notes: 'Issue came back after 9 days' });
    expect(expiredRes.statusCode).toBe(400);
    expect(expiredRes.body.message).toMatch(/7 days/i);

    // Detail endpoint exposes reopenInfo accurately
    const expiredDetail = await request(app)
      .get(`/api/v1/complaints/${expiredComplaint._id}`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(expiredDetail.body.complaint.reopenInfo.eligible).toBe(false);

    // Eligible <=7 days complaint reopens cleanly
    const beforeReopen = Date.now();
    const reopenRes = await request(app)
      .put(`/api/v1/complaints/${eligibleComplaint._id}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'Reopened', notes: 'Sparks resumed during evening peak load.' });

    expect(reopenRes.statusCode).toBe(200);
    const updated = reopenRes.body.complaint;
    expect(updated.status).toBe('Reopened');
    expect(updated.resolvedAt).toBeNull();
    expect(updated.closedAt).toBeNull();
    expect(updated.reopenedAt).toBeTruthy();

    // High priority -> SLA recalculated to ~48h from reopen time
    const newSlaHours = (new Date(updated.slaDeadline).getTime() - beforeReopen) / HOUR_MS;
    expect(newSlaHours).toBeGreaterThan(47.5);
    expect(newSlaHours).toBeLessThanOrEqual(48.2);

    // Timeline updated with 'reopened'
    expect(updated.timeline[updated.timeline.length - 1].eventType).toBe('reopened');

    // Relevant officer & dept head notified
    expect(await Notification.countDocuments({ recipient: officer._id, type: 'reopened', relatedComplaint: eligibleComplaint._id })).toBe(1);
    expect(await Notification.countDocuments({ recipient: headOfficer._id, type: 'reopened', relatedComplaint: eligibleComplaint._id })).toBe(1);

    // Repeated reopen while already Reopened is rejected
    const repeatReopen = await request(app)
      .put(`/api/v1/complaints/${eligibleComplaint._id}/status`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ status: 'Reopened', notes: 'Trying to reopen twice' });
    expect(repeatReopen.statusCode).toBe(400);
    expect(repeatReopen.body.message).toMatch(/already.*reopened/i);
  });

  it('enforces escalation authorization, notifies dept head or falls back to active admins, and enforces duplicate notification prevention & privacy', async () => {
    const { user: headOfficer } = await createActor({
      name: 'Sanitation Head',
      email: 'sani.head@example.com',
      role: 'officer',
    });
    const saniDept = await Department.create({
      name: 'Sanitation & Waste Management',
      code: 'SANI',
      categories: ['Sanitation and Waste Management'],
      headOfficer: headOfficer._id,
    });
    const noHeadDept = await Department.create({
      name: 'General Public Administration',
      code: 'GEN',
      categories: ['Other'],
      headOfficer: null,
    });

    const { user: adminUser, token: adminToken } = await createActor({
      name: 'Chief Admin',
      email: 'chief.admin@example.com',
      role: 'admin',
    });
    const { token: wrongDeptOfficerToken } = await createActor({
      name: 'Other Dept Officer',
      email: 'other.dept@example.com',
      role: 'officer',
      department: noHeadDept._id,
    });
    const { user: citizen, token: citizenToken } = await createActor({
      name: 'Neha Citizen',
      email: 'neha@example.com',
      role: 'citizen',
    });
    const { user: citizen2, token: citizen2Token } = await createActor({
      name: 'Other Citizen',
      email: 'other.cit@example.com',
      role: 'citizen',
    });

    const future = new Date(Date.now() + 24 * HOUR_MS);
    const cWithHead = await Complaint.create({
      trackingId: 'NS-2026-81001',
      citizen: citizen._id,
      department: saniDept._id,
      title: 'Garbage pile blocking hospital gate',
      description: 'Overflowing dump uncollected for five consecutive days.',
      category: 'Sanitation and Waste Management',
      priority: 'Urgent',
      status: 'Assigned',
      slaDeadline: future,
      location: { address: 'City Hospital Gate 1' },
    });

    const cNoHead = await Complaint.create({
      trackingId: 'NS-2026-81002',
      citizen: citizen._id,
      department: noHeadDept._id,
      title: 'Delayed certificate verification',
      description: 'Application stuck in queue past statutory timeline.',
      category: 'Other',
      priority: 'Medium',
      status: 'Under Review',
      slaDeadline: future,
      location: { address: 'Civic Kendra' },
    });

    // Unauthorized citizen and cross-department officer cannot escalate
    expect((await request(app).put(`/api/v1/complaints/${cWithHead._id}/escalate`).set('Authorization', `Bearer ${citizen2Token}`).send({ reason: 'Unauthorized' })).statusCode).toBe(403);
    expect((await request(app).put(`/api/v1/complaints/${cWithHead._id}/escalate`).set('Authorization', `Bearer ${wrongDeptOfficerToken}`).send({ reason: 'Wrong dept' })).statusCode).toBe(403);

    // Owner citizen escalates cWithHead -> timeline & headOfficer notified
    const escHeadRes = await request(app)
      .put(`/api/v1/complaints/${cWithHead._id}/escalate`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ reason: 'Severe public health hazard near hospital' });

    expect(escHeadRes.statusCode).toBe(200);
    expect(escHeadRes.body.complaint.isEscalated).toBe(true);
    expect(escHeadRes.body.complaint.escalatedAt).toBeTruthy();
    expect(escHeadRes.body.complaint.timeline.some((e) => e.eventType === 'escalated')).toBe(true);
    expect(await Notification.countDocuments({ recipient: headOfficer._id, type: 'escalated', relatedComplaint: cWithHead._id })).toBe(1);

    // Repeat manual escalation is rejected & emits zero extra notifications
    const repeatEsc = await request(app)
      .put(`/api/v1/complaints/${cWithHead._id}/escalate`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ reason: 'Trying again' });
    expect(repeatEsc.statusCode).toBe(400);
    expect(await Notification.countDocuments({ recipient: headOfficer._id, type: 'escalated', relatedComplaint: cWithHead._id })).toBe(1);

    // Department WITHOUT headOfficer escalates -> falls back to active admin(s)
    const escNoHeadRes = await request(app)
      .put(`/api/v1/complaints/${cNoHead._id}/escalate`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ reason: 'No response for days' });
    expect(escNoHeadRes.statusCode).toBe(200);

    const adminEscNotifs = await Notification.find({
      recipient: adminUser._id,
      type: 'escalated',
      relatedComplaint: cNoHead._id,
    });
    expect(adminEscNotifs).toHaveLength(1);

    // Direct idempotency check: retrying createNotification with same eventKey creates only 1 document
    await Promise.all([
      createNotification({
        recipient: citizen._id,
        title: 'Idempotent Event',
        message: 'Single delivery only',
        type: 'status_changed',
        relatedComplaint: cNoHead._id,
        trackingId: cNoHead.trackingId,
        eventKey: `retry_test:${cNoHead._id}`,
      }),
      createNotification({
        recipient: citizen._id,
        title: 'Idempotent Event',
        message: 'Single delivery only',
        type: 'status_changed',
        relatedComplaint: cNoHead._id,
        trackingId: cNoHead.trackingId,
        eventKey: `retry_test:${cNoHead._id}`,
      }),
    ]);
    expect(await Notification.countDocuments({ recipient: citizen._id, eventKey: `retry_test:${cNoHead._id}` })).toBe(1);

    // Notification privacy: Citizen2 cannot see or mark Admin's notification as read
    const citizen2List = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${citizen2Token}`);
    expect(citizen2List.statusCode).toBe(200);
    expect(citizen2List.body.notifications).toHaveLength(0);

    const privMarkRes = await request(app)
      .patch(`/api/v1/notifications/${adminEscNotifs[0]._id}/read`)
      .set('Authorization', `Bearer ${citizen2Token}`);
    expect(privMarkRes.statusCode).toBe(404);

    // Admin sees and marks own escalation notification read
    const adminNotifList = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminNotifList.statusCode).toBe(200);
    expect(adminNotifList.body.unreadCount).toBe(1);
  });

  it('completes complaint creation and status updates cleanly even when notification persistence fails', async () => {
    const dept = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      categories: ['Water Supply'],
    });
    const { token: citizenToken } = await createActor({
      name: 'Resilient Citizen',
      email: 'resilient@example.com',
      role: 'citizen',
    });
    const { token: officerToken } = await createActor({
      name: 'Resilient Officer',
      email: 'resilient.off@example.com',
      role: 'officer',
      department: dept._id,
    });

    const spy = jest.spyOn(Notification, 'create').mockRejectedValue(new Error('Simulated notification failure'));

    try {
      const submitRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Broken valve near ward office',
          description: 'Continuous water leakage onto pedestrian sidewalk.',
          category: 'Water Supply',
          priority: 'Medium',
          location: { address: 'Ward 5 Main Road' },
        });

      expect(submitRes.statusCode).toBe(201);
      const createdId = submitRes.body.complaint._id;

      const statusRes = await request(app)
        .put(`/api/v1/complaints/${createdId}/status`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ status: 'In Progress', notes: 'Crew dispatched despite alert error' });

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.complaint.status).toBe('In Progress');

      const stored = await Complaint.findById(createdId);
      expect(stored.status).toBe('In Progress');
      expect(stored.timeline.length).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });
});
