const request = require('supertest');
const { app } = require('../src/server');
const Department = require('../src/models/Department');
const User = require('../src/models/User');
const Complaint = require('../src/models/Complaint');

describe('Role-Based Grievance Redressal System & Portal Security Tests', () => {
  let adminToken, adminUser;
  let waterDept, elecDept;
  let waterOfficerToken, waterOfficer;
  let elecOfficerToken, elecOfficer;
  let citizenToken, citizenUser;
  let otherCitizenToken, otherCitizenUser;

  beforeEach(async () => {
    // 1. Setup Admin
    adminUser = await User.create({
      name: 'Chief Admin Officer',
      email: 'chief.admin@portal.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    const adminLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'chief.admin@portal.gov.in',
      password: 'AdminPassword123!',
    });
    adminToken = adminLoginRes.body.token;

    // 2. Setup Departments
    waterDept = await Department.create({
      name: 'Water Supply & Sewerage Board',
      code: 'WSSB',
      description: 'Potable water supply and drainage networks',
      categories: ['Water Supply'],
      slaHours: { Low: 72, Medium: 48, High: 24, Urgent: 12 },
      isActive: true,
    });

    elecDept = await Department.create({
      name: 'Electricity & Power Distribution',
      code: 'EPD',
      description: 'Power grid and street illumination',
      categories: ['Electricity'],
      slaHours: { Low: 72, Medium: 48, High: 24, Urgent: 8 },
      isActive: true,
    });

    // 3. Admin creates Officers (no public registration allowed)
    const officer1Res = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Officer Rajesh Water',
        email: 'rajesh.water@portal.gov.in',
        password: 'OfficerPassword123!',
        departmentId: waterDept._id,
        phone: '9811001100',
      });
    waterOfficer = officer1Res.body.user;

    const officer1Login = await request(app).post('/api/v1/auth/login').send({
      email: 'rajesh.water@portal.gov.in',
      password: 'OfficerPassword123!',
    });
    waterOfficerToken = officer1Login.body.token;

    const officer2Res = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Officer Priya Electricity',
        email: 'priya.elec@portal.gov.in',
        password: 'OfficerPassword123!',
        departmentId: elecDept._id,
        phone: '9822002200',
      });
    elecOfficer = officer2Res.body.user;

    const officer2Login = await request(app).post('/api/v1/auth/login').send({
      email: 'priya.elec@portal.gov.in',
      password: 'OfficerPassword123!',
    });
    elecOfficerToken = officer2Login.body.token;

    // 4. Citizens register
    const cit1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Aarav Mehta',
      email: 'aarav@citizen.in',
      password: 'CitizenPassword123!',
      phone: '9833003300',
      address: 'House 14, Ring Road',
    });
    citizenToken = cit1.body.token;
    citizenUser = cit1.body.user;

    const cit2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Sunil Verma',
      email: 'sunil@citizen.in',
      password: 'CitizenPassword123!',
      phone: '9844004400',
      address: 'Flat 5B, Mayur Vihar',
    });
    otherCitizenToken = cit2.body.token;
    otherCitizenUser = cit2.body.user;
  });

  describe('Portal Sign-in Role Enforcement', () => {
    it('allows citizen login through /login/citizen endpoint', async () => {
      const res = await request(app).post('/api/v1/auth/login/citizen').send({
        email: citizenUser.email,
        password: 'CitizenPassword123!',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('citizen');
    });

    it('DENIES citizen login through /login/officer and /login/admin with 403 Forbidden', async () => {
      const officerPortalAttempt = await request(app)
        .post('/api/v1/auth/login/officer')
        .send({
          email: citizenUser.email,
          password: 'CitizenPassword123!',
        });
      expect(officerPortalAttempt.statusCode).toBe(403);
      expect(officerPortalAttempt.body.success).toBe(false);
      expect(officerPortalAttempt.body.message).toMatch(/officer portal.*citizen/i);

      const adminPortalAttempt = await request(app)
        .post('/api/v1/auth/login/admin')
        .send({
          email: citizenUser.email,
          password: 'CitizenPassword123!',
        });
      expect(adminPortalAttempt.statusCode).toBe(403);
      expect(adminPortalAttempt.body.success).toBe(false);
      expect(adminPortalAttempt.body.message).toMatch(/admin portal.*citizen/i);
    });

    it('DENIES officer login through /login/admin with 403 Forbidden', async () => {
      const res = await request(app).post('/api/v1/auth/login/admin').send({
        email: waterOfficer.email,
        password: 'OfficerPassword123!',
      });
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/admin portal.*officer/i);
    });

    it('allows officer login through /login/officer and admin through /login/admin', async () => {
      const officerRes = await request(app).post('/api/v1/auth/login/officer').send({
        email: waterOfficer.email,
        password: 'OfficerPassword123!',
      });
      expect(officerRes.statusCode).toBe(200);
      expect(officerRes.body.user.role).toBe('officer');

      const adminRes = await request(app).post('/api/v1/auth/login/admin').send({
        email: adminUser.email,
        password: 'AdminPassword123!',
      });
      expect(adminRes.statusCode).toBe(200);
      expect(adminRes.body.user.role).toBe('admin');
    });
  });

  describe('Full Complaint Lifecycle: Submitted -> Received -> Assigned -> In Progress -> Resolved -> Closed', () => {
    let complaintId;

    it('executes end-to-end lifecycle with strict role validation and evidence persistence', async () => {
      // Step 1: Citizen submits complaint with departmentId and evidence image
      const submitRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Damaged main water pipeline causing street flooding',
          description: 'Underground drinking water main cracked, creating a 3-foot waterlogged hazard.',
          category: 'Water Supply',
          departmentId: waterDept._id,
          priority: 'High',
          location: { address: 'Plot 10, Ring Road', pincode: '110001' },
          evidenceImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });

      expect(submitRes.statusCode).toBe(201);
      const complaint = submitRes.body.complaint;
      complaintId = complaint._id;
      expect(complaint.trackingId).toMatch(/^NS-\d{4}-\d{5}$/);
      expect(complaint.status).toBe('Submitted');
      expect(complaint.department).toBe(waterDept._id.toString());
      expect(complaint.evidenceImage).toContain('data:image/png;base64');

      // Step 2: Officer from assigned department accepts complaint as 'Received'
      const receivedRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'Received',
          notes: 'Grievance received and verified by Water Supply division.',
        });

      expect(receivedRes.statusCode).toBe(200);
      expect(receivedRes.body.complaint.status).toBe('Received');

      // Step 3: Admin assigns complaint to Officer
      const assignRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: waterDept._id,
          officerId: waterOfficer._id,
          priority: 'Urgent',
          notes: 'Assigned to field inspector Rajesh.',
        });

      expect(assignRes.statusCode).toBe(200);
      expect(assignRes.body.complaint.status).toBe('Assigned');
      expect(assignRes.body.complaint.assignedOfficer).toBe(waterOfficer._id.toString());

      // Step 4: Officer updates status to 'In Progress'
      const inProgressRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'In Progress',
          notes: 'Excavation team on site; replacing fractured pipeline segment.',
        });

      expect(inProgressRes.statusCode).toBe(200);
      expect(inProgressRes.body.complaint.status).toBe('In Progress');

      // Step 5: Citizen attempts to mark 'Resolved' -> MUST BE REJECTED with 403 Forbidden
      const citizenResolveAttempt = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          status: 'Resolved',
          notes: 'Trying to mark resolved as citizen',
        });

      expect(citizenResolveAttempt.statusCode).toBe(403);
      expect(citizenResolveAttempt.body.message).toMatch(/citizens cannot mark complaints resolved/i);

      // Step 6: Officer marks complaint 'Resolved' with resolution notes and resolution proof
      const resolveRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'Resolved',
          notes: 'Pipeline repair completed and tested under pressure.',
          resolutionNotes: 'Segment replaced with 10-inch ductile iron pipe. Flow restored.',
          resolutionEvidence: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        });

      expect(resolveRes.statusCode).toBe(200);
      expect(resolveRes.body.complaint.status).toBe('Resolved');
      expect(resolveRes.body.complaint.resolvedAt).toBeDefined();
      expect(resolveRes.body.complaint.resolutionNotes).toContain('ductile iron pipe');
      expect(resolveRes.body.complaint.resolutionEvidence).toBeDefined();

      // Step 7: Officer attempts to close complaint -> MUST BE REJECTED with 403 Forbidden
      const officerCloseAttempt = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          status: 'Closed',
          notes: 'Officer trying to close complaint',
        });

      expect(officerCloseAttempt.statusCode).toBe(403);
      expect(officerCloseAttempt.body.message).toMatch(/closure is reserved for citizen/i);

      // Step 8: Citizen accepts resolution & closes grievance with 5-star rating and feedback
      const closeRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          status: 'Closed',
          rating: 5,
          comment: 'Outstanding response and clean repair work by the water board team.',
        });

      expect(closeRes.statusCode).toBe(200);
      expect(closeRes.body.complaint.status).toBe('Closed');
      expect(closeRes.body.complaint.closedAt).toBeDefined();
      expect(closeRes.body.complaint.citizenFeedback.rating).toBe(5);
      expect(closeRes.body.complaint.citizenFeedback.comment).toContain('Outstanding response');

      // Step 9: Reopening allowed from Closed status if unsatisfied
      const reopenRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          status: 'Reopened',
          notes: 'Pavement subsidence occurred 2 days after repair.',
        });

      expect(reopenRes.statusCode).toBe(200);
      expect(reopenRes.body.complaint.status).toBe('Reopened');
      expect(reopenRes.body.complaint.isEscalated).toBe(true);
    });
  });

  describe('Department & Cross-User Privacy Guardrails', () => {
    let complaintId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Contaminated tap water with sulfur odor',
          description: 'Water coming out of municipal tap is murky and smelling bad.',
          category: 'Water Supply',
          departmentId: waterDept._id,
          location: { address: 'Street 4, Ward 2' },
        });
      complaintId = res.body.complaint._id;

      // Assign to Water Officer
      await request(app)
        .put(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: waterDept._id,
          officerId: waterOfficer._id,
          priority: 'High',
        });
    });

    it('DENIES another citizen from reading or altering the complaint', async () => {
      const readAttempt = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${otherCitizenToken}`);

      expect(readAttempt.statusCode).toBe(403);
      expect(readAttempt.body.success).toBe(false);

      const statusAttempt = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${otherCitizenToken}`)
        .send({ status: 'Closed' });

      expect(statusAttempt.statusCode).toBe(403);
    });

    it('DENIES officer from another department from updating the complaint status', async () => {
      const crossDeptAttempt = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${elecOfficerToken}`)
        .send({
          status: 'In Progress',
          notes: 'Electricity officer attempting to modify water complaint',
        });

      expect(crossDeptAttempt.statusCode).toBe(403);
      expect(crossDeptAttempt.body.message).toMatch(/outside your.*department/i);
    });

    it('DENIES an officer or admin from submitting a citizen grievance (returns 403)', async () => {
      const officerSubmitRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${waterOfficerToken}`)
        .send({
          title: 'Officer trying to file complaint',
          description: 'Officers should not be able to file citizen complaints',
          category: 'Water Supply',
          location: { address: 'Office room 1' },
        });

      expect(officerSubmitRes.statusCode).toBe(403);
      expect(officerSubmitRes.body.success).toBe(false);

      const adminSubmitRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin trying to file complaint',
          description: 'Admins should not be able to file citizen complaints',
          category: 'Water Supply',
          location: { address: 'Admin room 1' },
        });

      expect(adminSubmitRes.statusCode).toBe(403);
      expect(adminSubmitRes.body.success).toBe(false);
    });

    it('DENIES an officer from accessing citizen My Complaints route /api/v1/complaints/my (returns 403)', async () => {
      const myComplaintsAttempt = await request(app)
        .get('/api/v1/complaints/my')
        .set('Authorization', `Bearer ${waterOfficerToken}`);

      expect(myComplaintsAttempt.statusCode).toBe(403);
      expect(myComplaintsAttempt.body.success).toBe(false);
    });

    it('DENIES an officer from viewing, commenting on, or escalating a complaint outside their department', async () => {
      // 1. Cross-department view attempt -> 403
      const viewAttempt = await request(app)
        .get(`/api/v1/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${elecOfficerToken}`);

      expect(viewAttempt.statusCode).toBe(403);
      expect(viewAttempt.body.success).toBe(false);

      // 2. Cross-department comment attempt -> 403
      const commentAttempt = await request(app)
        .post(`/api/v1/complaints/${complaintId}/comments`)
        .set('Authorization', `Bearer ${elecOfficerToken}`)
        .send({ message: 'Unauthorized comment from electricity officer' });

      expect(commentAttempt.statusCode).toBe(403);
      expect(commentAttempt.body.success).toBe(false);

      // 3. Cross-department escalate attempt -> 403
      const escalateAttempt = await request(app)
        .put(`/api/v1/complaints/${complaintId}/escalate`)
        .set('Authorization', `Bearer ${elecOfficerToken}`)
        .send({ reason: 'Unauthorized escalation' });

      expect(escalateAttempt.statusCode).toBe(403);
      expect(escalateAttempt.body.success).toBe(false);
    });

    it('allows Admin to reassign complaint across departments', async () => {
      const reassignRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          departmentId: elecDept._id,
          officerId: elecOfficer._id,
          priority: 'Medium',
          notes: 'Reassigned due to electrical pump motor malfunction.',
        });

      expect(reassignRes.statusCode).toBe(200);
      expect(reassignRes.body.complaint.department).toBe(elecDept._id.toString());
      expect(reassignRes.body.complaint.assignedOfficer).toBe(elecOfficer._id.toString());
    });
  });
});
