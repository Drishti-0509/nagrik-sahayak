const request = require('supertest');
const { app } = require('../src/server');

describe('Complaint Redressal Workflow & Permissions Tests', () => {
  let citizenToken1, citizenUser1;
  let citizenToken2, citizenUser2;
  let complaintId, trackingId;

  beforeEach(async () => {
    // Register Citizen 1
    const res1 = await request(app).post('/api/v1/auth/register').send({
      name: 'Sunita Devi',
      email: 'sunita@example.com',
      password: 'Password123!',
      phone: '9811122233',
      address: 'Ward 12, Janakpuri',
    });
    citizenToken1 = res1.body.token;
    citizenUser1 = res1.body.user;

    // Register Citizen 2
    const res2 = await request(app).post('/api/v1/auth/register').send({
      name: 'Amit Patel',
      email: 'amit@example.com',
      password: 'Password123!',
      phone: '9844455566',
      address: 'Sector 5, Rohini',
    });
    citizenToken2 = res2.body.token;
    citizenUser2 = res2.body.user;
  });

  it('should submit a complaint, generate unique NS- tracking ID and calculate SLA', async () => {
    const complaintData = {
      title: 'Severe pipeline leakage on main road',
      description: 'Drinking water pipeline has burst and is overflowing into the street, wasting clean water.',
      category: 'Water Supply',
      location: {
        address: 'Opposite Community Hall, Ward 12',
        pincode: '110058',
      },
      priority: 'High',
    };

    const res = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken1}`)
      .send(complaintData);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.complaint.trackingId).toMatch(/^NS-\d{4}-\d{5}$/);
    expect(res.body.complaint.status).toBe('Submitted');
    expect(res.body.complaint.priority).toBe('High');
    expect(res.body.complaint.slaDeadline).toBeDefined();
    expect(res.body.complaint.aiAnalysis).toBeDefined();
    expect(res.body.complaint.timeline.length).toBeGreaterThanOrEqual(1);

    complaintId = res.body.complaint._id;
    trackingId = res.body.complaint.trackingId;
  });

  it('should allow the owner citizen to fetch their own complaint details', async () => {
    // First submit complaint
    const createRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken1}`)
      .send({
        title: 'Street light not working in block B',
        description: 'Complete darkness for 3 nights, causing safety concerns for women and elderly.',
        category: 'Electricity',
        location: { address: 'Block B, Janakpuri' },
      });

    const cId = createRes.body.complaint._id;

    const res = await request(app)
      .get(`/api/v1/complaints/${cId}`)
      .set('Authorization', `Bearer ${citizenToken1}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.complaint._id).toBe(cId);
    expect(res.body.complaint.slaInfo).toBeDefined();
  });

  it('should STRICTLY DENY access when another citizen tries to access the complaint (Ownership Check)', async () => {
    // Citizen 1 creates complaint
    const createRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken1}`)
      .send({
        title: 'Pothole on service road',
        description: 'Large pothole causing vehicle damage and traffic jams.',
        category: 'Roads and Infrastructure',
        location: { address: 'Service Road, NH 8' },
      });

    const cId = createRes.body.complaint._id;

    // Citizen 2 attempts to access Citizen 1's complaint
    const res = await request(app)
      .get(`/api/v1/complaints/${cId}`)
      .set('Authorization', `Bearer ${citizenToken2}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized to view other citizens/i);
  });

  it('should allow citizen to add follow-up comment to their complaint', async () => {
    const createRes = await request(app)
      .post('/api/v1/complaints')
      .set('Authorization', `Bearer ${citizenToken1}`)
      .send({
        title: 'Garbage dump accumulating near public park',
        description: 'Trash has not been cleared for 4 days and is attracting stray dogs.',
        category: 'Sanitation and Waste Management',
        location: { address: 'Near Park Gate 2' },
      });

    const cId = createRes.body.complaint._id;

    const commentRes = await request(app)
      .post(`/api/v1/complaints/${cId}/comments`)
      .set('Authorization', `Bearer ${citizenToken1}`)
      .send({
        message: 'The smell is getting worse today. Please expedite.',
      });

    expect(commentRes.statusCode).toBe(201);
    expect(commentRes.body.success).toBe(true);
    expect(commentRes.body.comment.userName).toBe(citizenUser1.name);
    expect(commentRes.body.comment.isInternal).toBe(false);
  });
});
