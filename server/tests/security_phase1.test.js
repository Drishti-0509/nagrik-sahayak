const request = require('supertest');
const path = require('path');
const { execFileSync } = require('child_process');
const { app } = require('../src/server');
const Department = require('../src/models/Department');
const User = require('../src/models/User');
const Complaint = require('../src/models/Complaint');

// Minimal valid 1x1 JPEG, PNG, and WebP base64 payloads matching real file signatures
const VALID_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_JPEG_DATA_URI = `data:image/jpeg;base64,${Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9,
]).toString('base64')}`;
const VALID_WEBP_DATA_URI = `data:image/webp;base64,${Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP'),
  Buffer.from('VP8 '),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
]).toString('base64')}`;
const SVG_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
).toString('base64')}`;
const SPOOFED_PNG_DATA_URI = `data:image/png;base64,${Buffer.from(
  '<svg><script>alert(1)</script></svg>'
).toString('base64')}`;

describe('Phase 1 Security & Access Control Tests', () => {
  let adminToken;
  let waterDept, elecDept;
  let waterOfficer1, waterOfficer1Token;
  let waterOfficer2;
  let elecOfficer, elecOfficerToken;
  let citizenToken, citizenUser;

  beforeEach(async () => {
    await User.create({
      name: 'Security Admin',
      email: 'sec.admin@portal.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    const adminLogin = await request(app).post('/api/v1/auth/login/admin').send({
      email: 'sec.admin@portal.gov.in',
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.token;

    waterDept = await Department.create({
      name: 'Water Works',
      code: 'WATER',
      categories: ['Water Supply'],
    });
    elecDept = await Department.create({
      name: 'Electricity Board',
      code: 'ELEC',
      categories: ['Electricity'],
    });

    const o1 = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Water Officer One',
        email: 'water1@portal.gov.in',
        password: 'OfficerPassword123!',
        departmentId: waterDept._id,
      });
    waterOfficer1 = o1.body.user;
    waterOfficer1Token = (
      await request(app).post('/api/v1/auth/login/officer').send({
        email: 'water1@portal.gov.in',
        password: 'OfficerPassword123!',
      })
    ).body.token;

    const o2 = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Water Officer Two',
        email: 'water2@portal.gov.in',
        password: 'OfficerPassword123!',
        departmentId: waterDept._id,
      });
    waterOfficer2 = o2.body.user;

    const o3 = await request(app)
      .post('/api/v1/users/officers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Elec Officer',
        email: 'elec1@portal.gov.in',
        password: 'OfficerPassword123!',
        departmentId: elecDept._id,
      });
    elecOfficer = o3.body.user;
    elecOfficerToken = (
      await request(app).post('/api/v1/auth/login/officer').send({
        email: 'elec1@portal.gov.in',
        password: 'OfficerPassword123!',
      })
    ).body.token;

    const cit = await request(app).post('/api/v1/auth/register').send({
      name: 'Citizen Tester',
      email: 'citizen.sec@example.com',
      password: 'CitizenPassword123!',
    });
    citizenToken = cit.body.token;
    citizenUser = cit.body.user;
  });

  describe('Task 1: Complaint Assignment Security', () => {
    let waterComplaintId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Main pipe burst near ward 7',
          description: 'Water flowing on street continuously since morning.',
          category: 'Water Supply',
          departmentId: waterDept._id,
          location: { address: 'Ward 7 Market' },
        });
      waterComplaintId = res.body.complaint._id;
    });

    it('rejects cross-department assignment by an unauthorized officer', async () => {
      const res = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${elecOfficerToken}`)
        .send({ officerId: elecOfficer._id });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects department transfer attempted by an officer', async () => {
      const res = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ departmentId: elecDept._id, officerId: elecOfficer._id });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects officer assigning a complaint to an officer from a different department', async () => {
      const res = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ officerId: elecOfficer._id });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('rejects admin assigning an officer who does not belong to target department', async () => {
      const res = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: waterDept._id, officerId: elecOfficer._id });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('allows officer to assign within their own department and admin to transfer across departments', async () => {
      const intraDept = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ officerId: waterOfficer2._id, notes: 'Assigning to field officer 2' });

      expect(intraDept.statusCode).toBe(200);
      expect(intraDept.body.complaint.assignedOfficer).toBe(waterOfficer2._id);

      const adminTransfer = await request(app)
        .put(`/api/v1/complaints/${waterComplaintId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ departmentId: elecDept._id });

      expect(adminTransfer.statusCode).toBe(200);
      expect(adminTransfer.body.complaint.department).toBe(elecDept._id.toString());
      // Stale Water officer must be cleared when transferred without specifying an Elec officer
      expect(adminTransfer.body.complaint.assignedOfficer).toBeNull();
    });
  });

  describe('Task 2 & 3: CORS & Production JWT Security', () => {
    it('allows configured localhost origin and rejects unauthorized origins with 403', async () => {
      const allowedRes = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');
      expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');

      const blockedRes = await request(app)
        .get('/api/health')
        .set('Origin', 'https://evil-attacker.example.com');
      expect(blockedRes.statusCode).toBe(403);
      expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('fails safely in production mode when JWT_SECRET is missing or weak', () => {
      const envPath = path.resolve(__dirname, '../src/config/env.js');
      expect(() => {
        execFileSync(process.execPath, ['-e', `require(${JSON.stringify(envPath)})`], {
          env: {
            ...process.env,
            NODE_ENV: 'production',
            JWT_SECRET: '',
          },
          stdio: 'pipe',
        });
      }).toThrow();
    });
  });

  describe('Task 4: Regex Injection Prevention', () => {
    it('safely handles regex metacharacters in complaint and user search queries', async () => {
      const citizenSearch = await request(app)
        .get('/api/v1/complaints/my?search=' + encodeURIComponent('.*([unclosed('))
        .set('Authorization', `Bearer ${citizenToken}`);
      expect(citizenSearch.statusCode).toBe(200);
      expect(citizenSearch.body.complaints).toEqual([]);

      const officerSearch = await request(app)
        .get('/api/v1/complaints/assigned?search=' + encodeURIComponent('^(a+)+$'))
        .set('Authorization', `Bearer ${waterOfficer1Token}`);
      expect(officerSearch.statusCode).toBe(200);

      const adminComplaintSearch = await request(app)
        .get('/api/v1/complaints?search=' + encodeURIComponent('[a-z'))
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminComplaintSearch.statusCode).toBe(200);

      const adminUserSearch = await request(app)
        .get('/api/v1/users?search=' + encodeURIComponent('.*(test['))
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminUserSearch.statusCode).toBe(200);
    });
  });

  describe('Task 5: Image Upload Validation', () => {
    const basePayload = {
      title: 'Street drain overflow test',
      description: 'Testing image validation rules for uploaded evidence photos.',
      category: 'Water Supply',
      location: { address: 'Sector 2 Lane 4' },
    };

    it('accepts valid JPEG, PNG, and WebP evidence images', async () => {
      for (const img of [VALID_PNG_DATA_URI, VALID_JPEG_DATA_URI, VALID_WEBP_DATA_URI]) {
        const res = await request(app)
          .post('/api/v1/complaints')
          .set('Authorization', `Bearer ${citizenToken}`)
          .send({ ...basePayload, evidenceImage: img });
        expect(res.statusCode).toBe(201);
        expect(res.body.complaint.evidenceImage.startsWith('data:image/')).toBe(true);
      }
    });

    it('rejects SVG, unsupported MIME types, spoofed PNG headers, and oversized images', async () => {
      const svgRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ ...basePayload, evidenceImage: SVG_DATA_URI });
      expect(svgRes.statusCode).toBe(400);

      const spoofRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ ...basePayload, evidenceImage: SPOOFED_PNG_DATA_URI });
      expect(spoofRes.statusCode).toBe(400);

      const urlRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ ...basePayload, evidenceImage: 'javascript:alert(1)' });
      expect(urlRes.statusCode).toBe(400);

      const oversizedBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(5 * 1024 * 1024 + 100),
      ]);
      const oversizedRes = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          ...basePayload,
          evidenceImage: `data:image/png;base64,${oversizedBuffer.toString('base64')}`,
        });
      expect([400, 413]).toContain(oversizedRes.statusCode);
    });
  });

  describe('Task 6: Complaint Status Transition Security', () => {
    let complaintId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Broken valve flooding street',
          description: 'Clean water leaking from main valve near junction.',
          category: 'Water Supply',
          departmentId: waterDept._id,
          location: { address: 'Junction 3' },
        });
      complaintId = res.body.complaint._id;
    });

    it('rejects invalid backward transitions and prevents officers from modifying Resolved or Closed complaints', async () => {
      // No-op transition Submitted -> Submitted rejected
      const noopRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ status: 'Submitted' });
      expect(noopRes.statusCode).toBe(400);

      // Valid transition Submitted -> In Progress -> Resolved
      await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ status: 'In Progress', notes: 'Crew on site' });

      const resolvedRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ status: 'Resolved', resolutionNotes: 'Valve replaced and sealed.' });
      expect(resolvedRes.statusCode).toBe(200);

      // Officer cannot modify a Resolved complaint
      const officerModifyResolved = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ status: 'Rejected', notes: 'Trying to alter resolved ticket' });
      expect(officerModifyResolved.statusCode).toBe(403);

      // Citizen closes Resolved complaint
      const closeRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: 'Closed', rating: 5, comment: 'Good work' });
      expect(closeRes.statusCode).toBe(200);

      // Officer cannot modify a Closed complaint
      const officerModifyClosed = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${waterOfficer1Token}`)
        .send({ status: 'In Progress', notes: 'Trying to modify closed ticket' });
      expect(officerModifyClosed.statusCode).toBe(403);

      // Citizen cannot escalate a Closed complaint
      const escalateClosed = await request(app)
        .put(`/api/v1/complaints/${complaintId}/escalate`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ reason: 'Cannot escalate closed ticket' });
      expect(escalateClosed.statusCode).toBe(400);

      // Citizen can legitimately reopen Closed complaint
      const reopenRes = await request(app)
        .put(`/api/v1/complaints/${complaintId}/status`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ status: 'Reopened', notes: 'Leak returned after 1 day' });
      expect(reopenRes.statusCode).toBe(200);
      expect(reopenRes.body.complaint.status).toBe('Reopened');
      expect(reopenRes.body.complaint.closedAt).toBeNull();
    });
  });
});

