const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const {
  STANDARD_SLA_HOURS,
  PENDING_STATUSES,
  TERMINAL_STATUSES,
  calculateDeadline,
  checkOverdue,
} = require('../src/services/slaService');
const { migrateDepartmentSla } = require('../src/scripts/migrateDepartmentSla');

const HOURS = 60 * 60 * 1000;

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

describe('Phase 2: Database, SLA Standardization & Statistics Consistency', () => {
  it('enforces standardized SLA hours (120/72/48/24) and excludes Resolved, Closed, and Rejected from overdue checks', () => {
    const base = new Date('2026-06-01T00:00:00.000Z');
    const customLegacyDeptSla = { Low: 96, Medium: 48, High: 24, Urgent: 4 };

    expect((calculateDeadline('Low', customLegacyDeptSla, base) - base) / HOURS).toBe(120);
    expect((calculateDeadline('Medium', customLegacyDeptSla, base) - base) / HOURS).toBe(72);
    expect((calculateDeadline('High', customLegacyDeptSla, base) - base) / HOURS).toBe(48);
    expect((calculateDeadline('Urgent', customLegacyDeptSla, base) - base) / HOURS).toBe(24);
    expect(STANDARD_SLA_HOURS).toEqual({ Low: 120, Medium: 72, High: 48, Urgent: 24 });

    const pastDeadline = new Date(Date.now() - 10 * HOURS);
    for (const status of TERMINAL_STATUSES) {
      const result = checkOverdue({ status, slaDeadline: pastDeadline });
      expect(result.isOverdue).toBe(false);
      expect(result.isBreached).toBe(false);
      expect(result.overdueByHours).toBe(0);
    }

    for (const status of PENDING_STATUSES) {
      const result = checkOverdue({ status, slaDeadline: pastDeadline });
      expect(result.isOverdue).toBe(true);
      expect(result.isBreached).toBe(true);
      expect(result.overdueByHours).toBeGreaterThanOrEqual(9);
    }
  });

  it('returns zeroed public analytics safely on an empty database and real metrics when populated', async () => {
    const emptyRes = await request(app).get('/api/v1/analytics/public');
    expect(emptyRes.statusCode).toBe(200);
    expect(emptyRes.body.success).toBe(true);
    expect(emptyRes.body.stats).toEqual({
      totalComplaints: 0,
      resolvedComplaints: 0,
      pendingComplaints: 0,
      rejectedComplaints: 0,
      overdueComplaints: 0,
      resolutionRate: 0,
      activeDepartments: 0,
    });

    const dept1 = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      categories: ['Water Supply'],
    });
    await Department.create({
      name: 'Archived Dept',
      code: 'ARCH',
      categories: ['Other'],
      isActive: false,
    });

    const { user: citizen } = await createActor({
      name: 'Public Test Citizen',
      email: 'citizen.public@example.com',
      role: 'citizen',
    });

    const past = new Date(Date.now() - 6 * HOURS);
    const future = new Date(Date.now() + 24 * HOURS);

    await Complaint.create([
      {
        trackingId: 'NS-2026-10001',
        citizen: citizen._id,
        title: 'Resolved pipe leak',
        description: 'Fixed valve',
        category: 'Water Supply',
        department: dept1._id,
        location: { address: 'Sector 1' },
        status: 'Resolved',
        priority: 'High',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-10002',
        citizen: citizen._id,
        title: 'Closed meter complaint',
        description: 'Citizen confirmed closure',
        category: 'Water Supply',
        department: dept1._id,
        location: { address: 'Sector 2' },
        status: 'Closed',
        priority: 'Low',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-10003',
        citizen: citizen._id,
        title: 'Pending under review',
        description: 'Awaiting inspection',
        category: 'Water Supply',
        department: dept1._id,
        location: { address: 'Sector 3' },
        status: 'Under Review',
        priority: 'Medium',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-10004',
        citizen: citizen._id,
        title: 'Rejected duplicate',
        description: 'Rejected old claim',
        category: 'Water Supply',
        department: dept1._id,
        location: { address: 'Sector 4' },
        status: 'Rejected',
        priority: 'Low',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-10005',
        citizen: citizen._id,
        title: 'Active reopened item',
        description: 'Issue reoccurred',
        category: 'Water Supply',
        department: dept1._id,
        location: { address: 'Sector 5' },
        status: 'Reopened',
        priority: 'Urgent',
        slaDeadline: future,
      },
    ]);

    const res = await request(app).get('/api/v1/analytics/public');
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toEqual({
      totalComplaints: 5,
      resolvedComplaints: 2, // Resolved + Closed
      pendingComplaints: 2,  // Under Review + Reopened
      rejectedComplaints: 1,
      overdueComplaints: 1,  // Only Under Review (past); Resolved/Closed/Rejected excluded
      resolutionRate: 40,
      activeDepartments: 1,
    });
  });

  it('calculates citizen statistics strictly per citizen including all 6 pending statuses and excluding terminal overdue cases', async () => {
    const { user: citizenA, token: tokenA } = await createActor({
      name: 'Citizen A',
      email: 'citizena@example.com',
      role: 'citizen',
    });
    const { user: citizenB } = await createActor({
      name: 'Citizen B',
      email: 'citizenb@example.com',
      role: 'citizen',
    });

    const past = new Date(Date.now() - 8 * HOURS);
    const future = new Date(Date.now() + 30 * HOURS);

    const aStatuses = [
      { status: 'Submitted', deadline: future },
      { status: 'Received', deadline: future },
      { status: 'Under Review', deadline: past },
      { status: 'Assigned', deadline: future },
      { status: 'In Progress', deadline: past },
      { status: 'Reopened', deadline: future },
      { status: 'Resolved', deadline: past },
      { status: 'Closed', deadline: past },
      { status: 'Rejected', deadline: past },
    ];

    await Promise.all(
      aStatuses.map((item, idx) =>
        Complaint.create({
          trackingId: `NS-2026-2000${idx}`,
          citizen: citizenA._id,
          title: `Citizen A Complaint ${idx}`,
          description: 'Valid complaint details',
          category: 'Other',
          location: { address: `Street ${idx}` },
          status: item.status,
          priority: 'Medium',
          slaDeadline: item.deadline,
        })
      )
    );

    // Other citizen's overdue complaint must NOT affect Citizen A
    await Complaint.create({
      trackingId: 'NS-2026-29999',
      citizen: citizenB._id,
      title: 'Citizen B Overdue Complaint',
      description: 'Other user complaint',
      category: 'Other',
      location: { address: 'Other Street' },
      status: 'Submitted',
      priority: 'Urgent',
      slaDeadline: past,
    });

    const res = await request(app)
      .get('/api/v1/analytics/citizen')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.stats.total).toBe(9);
    expect(res.body.stats.pending).toBe(6);   // Submitted + Received + Under Review + Assigned + In Progress + Reopened
    expect(res.body.stats.resolved).toBe(2);  // Resolved + Closed
    expect(res.body.stats.rejected).toBe(1);
    expect(res.body.stats.overdue).toBe(2);   // Only Under Review (past) & In Progress (past)
    expect(res.body.stats.resolutionRate).toBe(22);
  });

  it('separates officer personal workload, unassigned department pool, and other officers work, and sorts priorities explicitly (Urgent > High > Medium > Low)', async () => {
    const waterDept = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      categories: ['Water Supply'],
    });
    const elecDept = await Department.create({
      name: 'Electricity & Energy',
      code: 'ELEC',
      categories: ['Electricity'],
    });

    const { user: citizen } = await createActor({
      name: 'Civic Reporter',
      email: 'reporter@example.com',
      role: 'citizen',
    });
    const { user: officer1, token: officer1Token } = await createActor({
      name: 'Water Officer 1',
      email: 'water1@example.com',
      role: 'officer',
      department: waterDept._id,
    });
    const { user: officer2 } = await createActor({
      name: 'Water Officer 2',
      email: 'water2@example.com',
      role: 'officer',
      department: waterDept._id,
    });
    const { user: elecOfficer } = await createActor({
      name: 'Elec Officer',
      email: 'elec@example.com',
      role: 'officer',
      department: elecDept._id,
    });

    const past = new Date(Date.now() - 5 * HOURS);
    const soon = new Date(Date.now() + 10 * HOURS);
    const far = new Date(Date.now() + 70 * HOURS);

    // Assigned to officer1 (personal):
    // 1. Low priority (future), 2. Urgent overdue (past), 3. High (soon), 4. Medium Under Review (far), 5. Resolved (past - NOT overdue)
    await Complaint.create([
      {
        trackingId: 'NS-2026-30001',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer1._id,
        title: 'Low priority mine',
        description: 'Minor drip in external water line',
        category: 'Water Supply',
        location: { address: 'Block A' },
        status: 'Assigned',
        priority: 'Low',
        slaDeadline: far,
      },
      {
        trackingId: 'NS-2026-30002',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer1._id,
        title: 'Urgent burst main mine',
        description: 'Water main flooding road outside',
        category: 'Water Supply',
        location: { address: 'Block B' },
        status: 'In Progress',
        priority: 'Urgent',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-30003',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer1._id,
        title: 'High pressure outage mine',
        description: 'No potable supply since morning',
        category: 'Water Supply',
        location: { address: 'Block C' },
        status: 'Reopened',
        priority: 'High',
        slaDeadline: soon,
      },
      {
        trackingId: 'NS-2026-30004',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer1._id,
        title: 'Medium inspection mine',
        description: 'Inspect valve pressure chamber',
        category: 'Water Supply',
        location: { address: 'Block D' },
        status: 'Under Review',
        priority: 'Medium',
        slaDeadline: far,
      },
      {
        trackingId: 'NS-2026-30005',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer1._id,
        title: 'Closed mine past deadline',
        description: 'Repair completed and confirmed',
        category: 'Water Supply',
        location: { address: 'Block E' },
        status: 'Closed',
        priority: 'Urgent',
        slaDeadline: past,
      },
      // Unassigned pool in Water Dept:
      {
        trackingId: 'NS-2026-30006',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: null,
        title: 'Unassigned pool Received case',
        description: 'Waiting assignment',
        category: 'Water Supply',
        location: { address: 'Block F' },
        status: 'Received',
        priority: 'High',
        slaDeadline: past,
      },
      // Assigned to OTHER officer in Water Dept (officer2) - must NOT inflate officer1 personal workload
      {
        trackingId: 'NS-2026-30007',
        citizen: citizen._id,
        department: waterDept._id,
        assignedOfficer: officer2._id,
        title: 'Officer 2 urgent overdue case',
        description: 'Owned by colleague',
        category: 'Water Supply',
        location: { address: 'Block G' },
        status: 'In Progress',
        priority: 'Urgent',
        slaDeadline: past,
      },
      // Different department altogether (Elec) - must NOT appear in Water Officer metrics
      {
        trackingId: 'NS-2026-30008',
        citizen: citizen._id,
        department: elecDept._id,
        assignedOfficer: elecOfficer._id,
        title: 'Electricity case',
        description: 'Transformer spark',
        category: 'Electricity',
        location: { address: 'Block H' },
        status: 'Submitted',
        priority: 'Urgent',
        slaDeadline: past,
      },
    ]);

    const officerStatsRes = await request(app)
      .get('/api/v1/analytics/officer')
      .set('Authorization', `Bearer ${officer1Token}`);

    expect(officerStatsRes.statusCode).toBe(200);
    const { stats, urgentComplaints } = officerStatsRes.body;

    // Personal workload only (5 assigned to officer1)
    expect(stats.total).toBe(5);
    expect(stats.pending).toBe(4); // Assigned + In Progress + Reopened + Under Review
    expect(stats.resolved).toBe(1); // Closed
    expect(stats.urgent).toBe(1); // Only active Urgent (Closed excluded)
    expect(stats.overdue).toBe(1); // Only In Progress past deadline (Closed excluded)
    expect(stats.approachingDeadline).toBe(1); // High due in 10h

    // Separated buckets
    expect(stats.assignedToMe.total).toBe(5);
    expect(stats.assignedToMe.pending).toBe(4);
    expect(stats.unassignedDepartment.total).toBe(1);
    expect(stats.unassignedDepartment.pending).toBe(1);
    expect(stats.unassignedDepartment.overdue).toBe(1);
    expect(stats.assignedToOthers.total).toBe(1);
    expect(stats.assignedToOthers.pending).toBe(1);

    // Explicit priority sort on dashboard queue (must NOT be alphabetical High -> Low -> Medium -> Urgent)
    // officer1 queue includes active assignedToMe + unassignedDepartment: Urgent, High (soon), High (past), Medium, Low
    const prioritiesInQueue = urgentComplaints.map((c) => c.priority);
    expect(prioritiesInQueue).toEqual(['Urgent', 'High', 'High', 'Medium', 'Low']);
    // Officer2's complaint & Closed complaint must NOT be in officer1 action queue
    expect(urgentComplaints.some((c) => c.trackingId === 'NS-2026-30007')).toBe(false);
    expect(urgentComplaints.some((c) => c.trackingId === 'NS-2026-30005')).toBe(false);

    // Explicit priority sort on GET /api/v1/complaints/assigned (status=pending excludes Closed)
    const assignedListRes = await request(app)
      .get('/api/v1/complaints/assigned?status=pending&limit=10')
      .set('Authorization', `Bearer ${officer1Token}`);

    expect(assignedListRes.statusCode).toBe(200);
    expect(assignedListRes.body.totalCount).toBe(6); // 4 active personal + 1 unassigned + 1 officer2 in dept
    expect(assignedListRes.body.complaints.map((c) => c.priority)).toEqual([
      'Urgent',
      'Urgent',
      'High',
      'High',
      'Medium',
      'Low',
    ]);
    // Unrelated department complaint must never leak into Water officer queue
    expect(assignedListRes.body.complaints.some((c) => c.trackingId === 'NS-2026-30008')).toBe(false);

    // Overdue filter excludes Closed/Resolved/Rejected even if status is queried
    const closedOverdueRes = await request(app)
      .get('/api/v1/complaints/assigned?status=Closed&overdueOnly=true')
      .set('Authorization', `Bearer ${officer1Token}`);
    expect(closedOverdueRes.statusCode).toBe(200);
    expect(closedOverdueRes.body.totalCount).toBe(0);
  });

  it('keeps Admin analytics pending counts and Department directory pending counts completely consistent', async () => {
    const { token: adminToken } = await createActor({
      name: 'System Admin',
      email: 'admin.phase2@example.com',
      role: 'admin',
    });
    const { user: citizen } = await createActor({
      name: 'Audit Citizen',
      email: 'audit.cit@example.com',
      role: 'citizen',
    });

    const dept = await Department.create({
      name: 'Roads & Public Infrastructure',
      code: 'ROAD',
      categories: ['Roads and Infrastructure'],
    });

    const past = new Date(Date.now() - 4 * HOURS);
    const future = new Date(Date.now() + 20 * HOURS);

    await Complaint.create([
      {
        trackingId: 'NS-2026-40001',
        citizen: citizen._id,
        department: dept._id,
        title: 'Pothole Received',
        description: 'Needs municipal road inspection',
        category: 'Roads and Infrastructure',
        location: { address: 'MG Road' },
        status: 'Received',
        priority: 'Medium',
        slaDeadline: past,
      },
      {
        trackingId: 'NS-2026-40002',
        citizen: citizen._id,
        department: dept._id,
        title: 'Culvert Under Review',
        description: 'Stormwater drainage check',
        category: 'Roads and Infrastructure',
        location: { address: 'Ring Road' },
        status: 'Under Review',
        priority: 'High',
        slaDeadline: future,
      },
      {
        trackingId: 'NS-2026-40003',
        citizen: citizen._id,
        department: dept._id,
        title: 'Bridge Rejected Case',
        description: 'Duplicate entry submitted earlier',
        category: 'Roads and Infrastructure',
        location: { address: 'Station Road' },
        status: 'Rejected',
        priority: 'Low',
        slaDeadline: past,
      },
    ]);

    const [adminRes, deptsRes] = await Promise.all([
      request(app).get('/api/v1/analytics/admin').set('Authorization', `Bearer ${adminToken}`),
      request(app).get('/api/v1/departments'),
    ]);

    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.body.stats.totalComplaints).toBe(3);
    expect(adminRes.body.stats.pendingComplaints).toBe(2); // Received + Under Review
    expect(adminRes.body.stats.overdueComplaints).toBe(1); // Rejected excluded
    expect(adminRes.body.stats.underReviewComplaints).toBe(1);

    expect(deptsRes.statusCode).toBe(200);
    const roadDept = deptsRes.body.departments.find((d) => d.code === 'ROAD');
    expect(roadDept.totalComplaints).toBe(3);
    expect(roadDept.pendingComplaints).toBe(2);

    const chartDept = adminRes.body.charts.byDepartment.find((d) => d.code === 'ROAD');
    expect(chartDept.count).toBe(3);
    expect(chartDept.pendingCount).toBe(2);
  });

  it('migrates all department SLAs idempotently without altering historical complaint deadlines, statuses, or timelines', async () => {
    const water = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      categories: ['Water Supply'],
      slaHours: { Low: 96, Medium: 48, High: 24, Urgent: 12 },
    });
    const safety = await Department.create({
      name: 'Public Safety & Law Enforcement',
      code: 'SAFETY',
      categories: ['Public Safety'],
      slaHours: { Low: 48, Medium: 24, High: 12, Urgent: 4 },
    });

    const { user: citizen } = await createActor({
      name: 'Legacy Citizen',
      email: 'legacy@example.com',
      role: 'citizen',
    });

    const historicalDeadline = new Date('2026-10-28T11:37:33.953Z');
    const historicalComplaint = await Complaint.create({
      trackingId: 'NS-2026-48329',
      citizen: citizen._id,
      department: water._id,
      title: 'Historical leak report',
      description: 'Original citizen grievance',
      category: 'Water Supply',
      location: { address: 'Old Ward 4' },
      status: 'Submitted',
      priority: 'Medium',
      slaDeadline: historicalDeadline,
      timeline: [
        {
          status: 'Submitted',
          changedBy: citizen._id,
          changedByName: 'Legacy Citizen',
          changedByRole: 'citizen',
          notes: 'Original entry',
          timestamp: new Date('2026-10-26T11:37:33.953Z'),
        },
      ],
    });

    const firstRun = await migrateDepartmentSla();
    expect(firstRun.totalDepartments).toBe(2);
    expect(firstRun.updatedCount).toBe(2);
    expect(firstRun.unchangedCount).toBe(0);

    // Second run must be completely idempotent
    const secondRun = await migrateDepartmentSla();
    expect(secondRun.totalDepartments).toBe(2);
    expect(secondRun.updatedCount).toBe(0);
    expect(secondRun.unchangedCount).toBe(2);

    const [updatedWater, updatedSafety, preservedComplaint] = await Promise.all([
      Department.findById(water._id),
      Department.findById(safety._id),
      Complaint.findById(historicalComplaint._id),
    ]);

    expect(updatedWater.slaHours.toObject()).toEqual(STANDARD_SLA_HOURS);
    expect(updatedSafety.slaHours.toObject()).toEqual(STANDARD_SLA_HOURS);

    // Historical complaint deadline, trackingId, status, and timeline remain untouched
    expect(preservedComplaint.trackingId).toBe('NS-2026-48329');
    expect(preservedComplaint.status).toBe('Submitted');
    expect(preservedComplaint.assignedOfficer).toBeNull();
    expect(preservedComplaint.slaDeadline.toISOString()).toBe(historicalDeadline.toISOString());
    expect(preservedComplaint.timeline).toHaveLength(1);
    expect(preservedComplaint.timeline[0].notes).toBe('Original entry');
  });

  it('uses standardized 24/48/72/120 SLA hours on complaint creation & priority override while preserving SLA deadline when priority is unchanged during assignment', async () => {
    const dept = await Department.create({
      name: 'Safety Dept',
      code: 'SAFETY',
      categories: ['Public Safety'],
      slaHours: { Low: 48, Medium: 24, High: 12, Urgent: 4 },
    });

    const { token: citizenToken } = await createActor({
      name: 'SLA Citizen',
      email: 'sla.cit@example.com',
      role: 'citizen',
    });
    const { user: officer } = await createActor({
      name: 'SLA Officer',
      email: 'sla.off@example.com',
      role: 'officer',
      department: dept._id,
    });
    const { token: adminToken } = await createActor({
      name: 'SLA Admin',
      email: 'sla.adm@example.com',
      role: 'admin',
    });

    const createRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        title: 'Street light outage near school gate',
        description: 'Entire lane is completely dark at night causing severe safety risk.',
        category: 'Public Safety',
        priority: 'Urgent',
        departmentId: dept._id.toString(),
        location: { address: 'School Road Ward 2' },
      });

    expect(createRes.statusCode).toBe(201);
    const created = createRes.body.complaint;
    const expectedUrgentHours =
      (new Date(created.slaDeadline) - new Date(created.createdAt)) / HOURS;
    expect(expectedUrgentHours).toBeCloseTo(24, 1);

    // Assigning officer without changing priority preserves original deadline
    const assignSameRes = await request(app)
      .put(`/api/v1/complaints/${created._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        officerId: officer._id.toString(),
        priority: 'Urgent',
        notes: 'Routed without changing priority',
      });

    expect(assignSameRes.statusCode).toBe(200);
    expect(new Date(assignSameRes.body.complaint.slaDeadline).toISOString()).toBe(
      new Date(created.slaDeadline).toISOString()
    );

    // Overriding priority to Low updates deadline using standardized 120 hours
    const assignLowRes = await request(app)
      .put(`/api/v1/complaints/${created._id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        officerId: officer._id.toString(),
        priority: 'Low',
        notes: 'Downgraded after preliminary verification',
      });

    expect(assignLowRes.statusCode).toBe(200);
    const updatedHours =
      (new Date(assignLowRes.body.complaint.slaDeadline) - Date.now()) / HOURS;
    expect(updatedHours).toBeGreaterThan(119.5);
    expect(updatedHours).toBeLessThanOrEqual(120.1);
  });
});

