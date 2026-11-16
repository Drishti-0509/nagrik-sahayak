const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const {
  predictResolutionTime,
  getSlaMetrics,
  runFallbackPrediction,
} = require('../src/services/slaPredictionService');

describe('Phase 4C: Intelligent SLA Prediction', () => {
  let citizenToken;
  let citizenUser;
  let department;

  beforeEach(async () => {
    await User.deleteMany({});
    await Department.deleteMany({});
    await Complaint.deleteMany({});

    department = await Department.create({
      name: 'Water Supply & Sewerage',
      code: 'WATER',
      description: 'Water pipelines and sewage',
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

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ramesh.citizen@example.com', password: 'Password123!' });
    citizenToken = loginRes.body.token;
  });

  describe('1. ML Evaluation Metrics & Baseline Comparison', () => {
    it('verifies that trained ML model outperforms the dummy mean baseline', () => {
      const metrics = getSlaMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.baseline).toBeDefined();
      expect(metrics.model).toBeDefined();

      // Check authentic metrics
      expect(metrics.baseline.mae).toBeGreaterThan(0);
      expect(metrics.baseline.rmse).toBeGreaterThan(0);
      expect(metrics.model.mae).toBeGreaterThan(0);
      expect(metrics.model.rmse).toBeGreaterThan(0);

      // Model must achieve lower error than baseline
      expect(metrics.model.mae).toBeLessThan(metrics.baseline.mae);
      expect(metrics.model.rmse).toBeLessThan(metrics.baseline.rmse);
      expect(metrics.evaluation.status).toBe('SUPERIOR_TO_BASELINE');
    });

    it('returns valid heuristic fallback prediction when needed', () => {
      const fallback = runFallbackPrediction({ category: 'Water Supply', priority: 'High' });
      expect(fallback.predictedHours).toBeGreaterThan(0);
      expect(fallback.predictedDays).toBeGreaterThan(0);
      expect(fallback.isAdvisoryOnly).toBe(true);
      expect(fallback.modelType).toBe('civic_heuristic_fallback');
    });
  });

  describe('2. Prediction Service & APIs', () => {
    it('predicts grievance resolution duration via service', async () => {
      const result = await predictResolutionTime({
        category: 'Water Supply',
        department: 'WATER',
        priority: 'High',
        description: 'Main line burst leaking on road',
        forcePython: true,
      });

      expect(result).toBeDefined();
      expect(result.predictedHours).toBeGreaterThan(0);
      expect(result.predictedDays).toBeGreaterThan(0);
      expect(result.isAdvisoryOnly).toBe(true);
    });

    it('returns 200 from POST /api/v1/complaints/predict-sla', async () => {
      const res = await request(app)
        .post('/api/v1/complaints/predict-sla')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          category: 'Electricity',
          department: 'ELEC',
          priority: 'Urgent',
          description: 'Snapped overhead power cable near entrance gate',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.predictedHours).toBeGreaterThan(0);
      expect(res.body.data.isAdvisoryOnly).toBe(true);
    });

    it('returns 200 from GET /api/v1/complaints/sla-metrics', async () => {
      const res = await request(app)
        .get('/api/v1/complaints/sla-metrics')
        .set('Authorization', `Bearer ${citizenToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toBeDefined();
    });
  });

  describe('3. Statutory SLA Non-Replacement Invariant', () => {
    it('strictly preserves statutory SLA deadline while storing advisory ML prediction', async () => {
      const submissionTime = Date.now();

      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Damaged water line spilling onto footpath',
          description: 'Municipal drinking water pipeline broken and spilling continuously',
          category: 'Water Supply',
          departmentId: department._id.toString(),
          location: { address: 'Shop 12, Main Bazar', pincode: '302001' },
          priority: 'Urgent', // Statutory SLA for Urgent is 24 hours
        });

      expect(res.status).toBe(201);
      const complaint = res.body.complaint;

      // Statutory SLA deadline MUST be ~24 hours from submission (tolerance ±2 hours)
      const statutoryDeadline = new Date(complaint.slaDeadline).getTime();
      const expectedDeadline = submissionTime + 24 * 3600 * 1000;
      const diffHours = Math.abs(statutoryDeadline - expectedDeadline) / (3600 * 1000);
      expect(diffHours).toBeLessThan(2);

      // Advisory ML prediction must be stored separately without altering slaDeadline
      expect(complaint.predictedSla).toBeDefined();
      expect(complaint.predictedSla.predictedHours).toBeGreaterThan(0);
      expect(complaint.predictedSla.predictedDays).toBeGreaterThan(0);
    });
  });
});
