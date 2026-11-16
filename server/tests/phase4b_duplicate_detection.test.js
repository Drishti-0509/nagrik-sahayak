const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const {
  checkDuplicateComplaints,
  calculateTokenSimilarity,
} = require('../src/services/duplicateDetectionService');

describe('Phase 4B: AI Duplicate Complaint Detection', () => {
  let citizenToken;
  let citizenUser;
  let otherCitizen;
  let department;

  beforeEach(async () => {
    // Clean collections
    await User.deleteMany({});
    await Department.deleteMany({});
    await Complaint.deleteMany({});

    department = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WTR',
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
      phone: '9876543210',
    });

    otherCitizen = await User.create({
      name: 'Suresh Citizen',
      email: 'suresh.citizen@example.com',
      password: 'Password123!',
      role: 'citizen',
      phone: '9876543211',
    });

    // Obtain JWT token for citizenUser
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.citizen@example.com', password: 'Password123!' });
    citizenToken = loginRes.body.token;
  });

  describe('1. Token & Vector Similarity Logic', () => {
    it('calculates deterministic token similarity accurately', () => {
      const text1 = 'Water pipeline leaking near city hospital';
      const text2 = 'Water pipeline burst leaking near city hospital';
      const score = calculateTokenSimilarity(text1, text2);
      expect(score).toBeGreaterThan(0.6);

      const unrelated = 'Street light broken and dark in residential park';
      const scoreUnrelated = calculateTokenSimilarity(text1, unrelated);
      expect(scoreUnrelated).toBeLessThan(0.2);
    });
  });

  describe('2. Duplicate Detection Service', () => {
    it('returns empty duplicates when no complaints exist in database', async () => {
      const result = await checkDuplicateComplaints({
        title: 'Burst pipe on main road',
        description: 'Drinking water is leaking heavily on the main road',
        category: 'Water Supply',
        threshold: 0.7,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicates).toEqual([]);
      expect(result.highestSimilarity).toBe(0);
    });

    it('detects duplicate grievance and excludes citizen PII from candidate data', async () => {
      // Existing grievance in database
      const existing = await Complaint.create({
        trackingId: 'NS-2026-90001',
        citizen: otherCitizen._id,
        title: 'Severe water pipeline leakage on MG Road',
        description: 'Main drinking water line burst and flooding the market street near MG Road',
        category: 'Water Supply',
        department: department._id,
        location: { address: 'MG Road, Market area', pincode: '302001' },
        priority: 'High',
        status: 'In Progress',
        slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      });

      const result = await checkDuplicateComplaints({
        title: 'Water pipeline burst on MG Road',
        description: 'Main water line is leaking heavily and flooding the market near MG Road',
        category: 'Water Supply',
        threshold: 0.65,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicates.length).toBeGreaterThan(0);
      expect(result.duplicates[0].trackingId).toBe('NS-2026-90001');
      expect(result.highestSimilarity).toBeGreaterThanOrEqual(0.65);

      // Verify strict Citizen PII protection: no citizen name, email, or phone
      const returnedCandidate = result.duplicates[0];
      expect(returnedCandidate.citizen).toBeUndefined();
      expect(returnedCandidate.citizenName).toBeUndefined();
      expect(returnedCandidate.email).toBeUndefined();
      expect(returnedCandidate.phone).toBeUndefined();
    });

    it('avoids self-comparison when excludeComplaintId is provided', async () => {
      const existing = await Complaint.create({
        trackingId: 'NS-2026-90002',
        citizen: citizenUser._id,
        title: 'Severe water pipeline leakage on MG Road',
        description: 'Main drinking water line burst and flooding the market street near MG Road',
        category: 'Water Supply',
        department: department._id,
        location: { address: 'MG Road, Market area', pincode: '302001' },
        priority: 'High',
        status: 'In Progress',
        slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      });

      // Query with the same text, but excluding this complaint's own ID
      const result = await checkDuplicateComplaints({
        title: 'Severe water pipeline leakage on MG Road',
        description: 'Main drinking water line burst and flooding the market street near MG Road',
        category: 'Water Supply',
        excludeComplaintId: existing._id,
        threshold: 0.65,
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicates).toEqual([]);
    });
  });

  describe('3. API Endpoint: POST /api/v1/complaints/check-duplicates', () => {
    it('rejects request with 400 when title or description is missing', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/check-duplicates')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ title: 'Only title' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 with duplicate check results', async () => {
      await Complaint.create({
        trackingId: 'NS-2026-90003',
        citizen: otherCitizen._id,
        title: 'Dirty contaminated drinking water from tap',
        description: 'Tap water smells foul and is yellow in Sector 14',
        category: 'Water Supply',
        department: department._id,
        location: { address: 'Sector 14', pincode: '302014' },
        priority: 'Medium',
        status: 'Under Review',
        slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/complaints/check-duplicates')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Contaminated tap water supply',
          description: 'Tap water smells bad and yellow color coming in Sector 14',
          category: 'Water Supply',
          threshold: 0.55,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.isDuplicate).toBe(true);
      expect(res.body.data.duplicates.length).toBeGreaterThan(0);
    });
  });

  describe('4. Complaint Submission Flow with Duplicate Detection', () => {
    it('creates complaint successfully without auto-rejecting or blocking when duplicate is detected', async () => {
      // Pre-existing complaint
      await Complaint.create({
        trackingId: 'NS-2026-90004',
        citizen: otherCitizen._id,
        title: 'Broken pipeline causing street flooding',
        description: 'Drinking water pipeline ruptured in central market street flooding area',
        category: 'Water Supply',
        department: department._id,
        location: { address: 'Central Market', pincode: '302001' },
        priority: 'High',
        status: 'In Progress',
        slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      });

      // Citizen submits similar complaint
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Pipeline broken and flooding central market',
          description: 'Drinking water pipeline is broken and water flooding in central market',
          category: 'Water Supply',
          departmentId: department._id.toString(),
          location: { address: 'Central Market, Shop 4', pincode: '302001' },
          priority: 'High',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.complaint).toBeDefined();
      expect(res.body.complaint.trackingId).toMatch(/^NS-\d{4}-\d{5}$/);
      // Status must remain normal 'Submitted', NEVER 'Rejected' or auto-closed
      expect(res.body.complaint.status).toBe('Submitted');

      // Duplicate metadata recorded
      expect(res.body.complaint.duplicateDetection).toBeDefined();
      expect(res.body.complaint.duplicateDetection.checkedAt).toBeDefined();
    });
  });
});
