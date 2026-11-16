const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../src/config/env');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const Evidence = require('../src/models/Evidence');

const VALID_PNG_1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const VALID_PNG_2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9Qz8DAwM8AAAbaAYB5s8JAAAAAAElFTkSuQmCC';

const SPOOFED_IMAGE = `data:image/png;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}`;

describe('Phase 4A: Resolution Evidence Management', () => {
  let admin, adminToken;
  let elecDept, waterDept;
  let jeenuOfficer, jeenuToken;
  let sureshOfficer, sureshToken;
  let citizen1, citizen1Token;
  let citizen2, citizen2Token;

  beforeEach(async () => {
    // 1. Admin
    admin = await User.create({
      name: 'System Admin',
      email: 'admin.phase4@portal.gov.in',
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
    });
    adminToken = jwt.sign({ id: admin._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    // 2. Departments
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

    // 3. Officers
    jeenuOfficer = await User.create({
      name: 'Jeenu Sharma',
      email: 'jeenu.phase4@portal.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      department: elecDept._id,
      isActive: true,
    });
    jeenuToken = jwt.sign({ id: jeenuOfficer._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    sureshOfficer = await User.create({
      name: 'Suresh Kumar',
      email: 'suresh.phase4@portal.gov.in',
      password: 'OfficerPassword123!',
      role: 'officer',
      department: waterDept._id,
      isActive: true,
    });
    sureshToken = jwt.sign({ id: sureshOfficer._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    // 4. Citizens
    citizen1 = await User.create({
      name: 'Priya Sharma',
      email: 'priya.phase4@example.com',
      password: 'CitizenPassword123!',
      role: 'citizen',
      phone: '9876543210',
      address: 'Jaipur, Rajasthan',
      isActive: true,
    });
    citizen1Token = jwt.sign({ id: citizen1._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    citizen2 = await User.create({
      name: 'Rohan Mehra',
      email: 'rohan.phase4@example.com',
      password: 'CitizenPassword123!',
      role: 'citizen',
      phone: '9876543211',
      address: 'Kota, Rajasthan',
      isActive: true,
    });
    citizen2Token = jwt.sign({ id: citizen2._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  });

  it('1, 2, 3: supports initial resolution with image, creates Evidence record and associates it with timeline event', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40001',
      title: 'Power line sparking in street',
      description: 'Major sparking near pole 4 requires replacement.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Sector 5, Jaipur' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Assigned',
    });

    const res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Line splice repaired and verified operational.',
        resolutionEvidence: VALID_PNG_1,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.complaint.status).toBe('Resolved');
    expect(res.body.complaint.resolutionCycleCount).toBe(1);
    expect(res.body.complaint.resolutionEvidence.startsWith('data:image/png')).toBe(true);

    // 2. Evidence record creation verified
    const evidenceDocs = await Evidence.find({ complaint: complaint._id });
    expect(evidenceDocs.length).toBe(1);
    const ev = evidenceDocs[0];
    expect(ev.cycleNumber).toBe(1);
    expect(ev.evidenceType).toBe('officer_resolution');
    expect(ev.mimeType).toBe('image/png');
    expect(ev.fileSizeBytes).toBeGreaterThan(0);
    expect(ev.uploadedBy.toString()).toBe(jeenuOfficer._id.toString());
    expect(ev.uploaderRole).toBe('officer');
    expect(ev.caption).toBe('Line splice repaired and verified operational.');

    // 3. Evidence association with timeline event verified
    const updatedComplaint = await Complaint.findById(complaint._id);
    const resolvedTimelineItem = updatedComplaint.timeline.find((t) => t.status === 'Resolved');
    expect(resolvedTimelineItem).toBeDefined();
    expect(resolvedTimelineItem.evidence).toBeDefined();
    expect(resolvedTimelineItem.evidence.toString()).toBe(ev._id.toString());
    expect(ev.timelineEventId.toString()).toBe(resolvedTimelineItem._id.toString());
  });

  it('4: preserves Evidence records without deletion when citizen reopens complaint', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40002',
      title: 'Transformer overload',
      description: 'Voltage dropping frequently.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Main Bazar' },
      priority: 'Medium',
      slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Assigned',
    });

    // 1st resolution
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'First attempt: replaced fuse wire.',
        resolutionEvidence: VALID_PNG_1,
      });

    expect(await Evidence.countDocuments({ complaint: complaint._id })).toBe(1);

    // Citizen reopens
    const reopenRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizen1Token}`)
      .send({
        status: 'Reopened',
        notes: 'Voltage is still fluctuating dangerously.',
      });

    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.complaint.status).toBe('Reopened');

    // Evidence must NOT be deleted
    const evidenceAfterReopen = await Evidence.find({ complaint: complaint._id });
    expect(evidenceAfterReopen.length).toBe(1);
    expect(evidenceAfterReopen[0].cycleNumber).toBe(1);
    expect(evidenceAfterReopen[0].caption).toBe('First attempt: replaced fuse wire.');
  });

  it('5, 6: preserves Cycle 1 evidence and records Cycle 2 evidence on second resolution with new image', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40003',
      title: 'Broken electrical meter',
      description: 'Meter glass cracked and display unreadable.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Lane 7' },
      priority: 'Low',
      slaDeadline: new Date(Date.now() + 120 * 3600 * 1000),
      status: 'Assigned',
    });

    // Cycle 1 Resolution
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 1: temporary meter face repair.',
        resolutionEvidence: VALID_PNG_1,
      });

    // Reopen
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizen1Token}`)
      .send({
        status: 'Reopened',
        notes: 'Display is still completely blank.',
      });

    // Cycle 2 Resolution with new image
    const resolve2Res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 2: complete unit replacement with digital smart meter.',
        resolutionEvidence: VALID_PNG_2,
      });

    expect(resolve2Res.status).toBe(200);
    expect(resolve2Res.body.complaint.resolutionCycleCount).toBe(2);

    // Verify both evidence records are preserved
    const allEvidence = await Evidence.find({ complaint: complaint._id }).sort({ cycleNumber: 1 });
    expect(allEvidence.length).toBe(2);

    // Cycle 1 evidence intact
    expect(allEvidence[0].cycleNumber).toBe(1);
    expect(allEvidence[0].caption).toBe('Cycle 1: temporary meter face repair.');
    expect(allEvidence[0].dataUrl).toBe(VALID_PNG_1);

    // Cycle 2 evidence recorded
    expect(allEvidence[1].cycleNumber).toBe(2);
    expect(allEvidence[1].caption).toBe('Cycle 2: complete unit replacement with digital smart meter.');
    expect(allEvidence[1].dataUrl).toBe(VALID_PNG_2);

    // Top-level pointer reflects latest resolution evidence
    const freshComplaint = await Complaint.findById(complaint._id);
    expect(freshComplaint.resolutionEvidence).toBe(VALID_PNG_2);
  });

  it('7, 8: clears top-level resolutionEvidence when re-resolved without an image to prevent stale proof display', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40004',
      title: 'Frequent tripping at junction box',
      description: 'Substation junction trips every hour.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Sector 3 Substation' },
      priority: 'Urgent',
      slaDeadline: new Date(Date.now() + 24 * 3600 * 1000),
      status: 'Assigned',
    });

    // Cycle 1: Resolved with image
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 1: fuse adjusted.',
        resolutionEvidence: VALID_PNG_1,
      });

    // Reopened by citizen
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizen1Token}`)
      .send({
        status: 'Reopened',
        notes: 'Tripped again 10 minutes later.',
      });

    // Cycle 2: Resolved WITHOUT image
    const resolve2Res = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 2: remote grid recalibration completed via central switchboard.',
      });

    expect(resolve2Res.status).toBe(200);
    expect(resolve2Res.body.complaint.resolutionCycleCount).toBe(2);

    // Top-level resolutionEvidence must be cleared (empty string) so stale Cycle 1 proof is NOT falsely displayed
    expect(resolve2Res.body.complaint.resolutionEvidence).toBe('');

    const freshComplaint = await Complaint.findById(complaint._id);
    expect(freshComplaint.resolutionEvidence).toBe('');

    // Historical Cycle 1 evidence remains safely preserved in Evidence collection
    const evidenceDocs = await Evidence.find({ complaint: complaint._id });
    expect(evidenceDocs.length).toBe(1);
    expect(evidenceDocs[0].cycleNumber).toBe(1);
    expect(evidenceDocs[0].dataUrl).toBe(VALID_PNG_1);
  });

  it('9: rejects unauthorized citizen attempting to access another citizen’s evidence', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40005',
      title: 'Citizen 1 Private Complaint',
      description: 'Private grievance description.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Private property' },
      priority: 'Low',
      slaDeadline: new Date(Date.now() + 120 * 3600 * 1000),
      status: 'Submitted',
    });

    // Citizen 2 requests Citizen 1's evidence
    const res = await request(app)
      .get(`/api/v1/complaints/${complaint._id}/evidence`)
      .set('Authorization', `Bearer ${citizen2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not authorized/i);
  });

  it('10: rejects officer attempting to access evidence of a complaint outside their department', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40006',
      title: 'Electricity Substation Issue',
      description: 'Electricity department internal work.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Substation 4' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Assigned',
    });

    // Suresh (Water Supply) attempts to access Electricity complaint evidence
    const res = await request(app)
      .get(`/api/v1/complaints/${complaint._id}/evidence`)
      .set('Authorization', `Bearer ${sureshToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/outside your department/i);
  });

  it('11, 12: allows authorized department officer and admin to access evidence records', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40007',
      title: 'Cable fault in Sector 9',
      description: 'Power cut due to snapped wire.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Sector 9' },
      priority: 'Medium',
      slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Assigned',
    });

    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Snapped wire replaced and power restored.',
        resolutionEvidence: VALID_PNG_1,
      });

    // 11. Authorized Officer access
    const officerRes = await request(app)
      .get(`/api/v1/complaints/${complaint._id}/evidence`)
      .set('Authorization', `Bearer ${jeenuToken}`);

    expect(officerRes.status).toBe(200);
    expect(officerRes.body.success).toBe(true);
    expect(officerRes.body.count).toBe(1);
    expect(officerRes.body.evidence[0].cycleNumber).toBe(1);

    // 12. Admin access
    const adminRes = await request(app)
      .get(`/api/v1/complaints/${complaint._id}/evidence`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.count).toBe(1);
  });

  it('13: rejects oversized and spoofed evidence images on status resolution', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40008',
      title: 'Street lamp repair',
      description: 'Defective sodium bulb.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Ward 2' },
      priority: 'Low',
      slaDeadline: new Date(Date.now() + 120 * 3600 * 1000),
      status: 'Assigned',
    });

    // Spoofed magic bytes
    const spoofRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Testing spoofed image.',
        resolutionEvidence: SPOOFED_IMAGE,
      });

    expect(spoofRes.status).toBe(400);
    expect(spoofRes.body.success).toBe(false);
    expect(spoofRes.body.message).toMatch(/file content does not match/i);

    // Oversized buffer (> 5MB)
    const oversizedBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(5 * 1024 * 1024 + 512),
    ]);
    const oversizedRes = await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Testing oversized image.',
        resolutionEvidence: `data:image/png;base64,${oversizedBuffer.toString('base64')}`,
      });

    expect([400, 413]).toContain(oversizedRes.status);
  });

  it('14: projects out heavy base64 evidence fields from complaint list endpoints', async () => {
    await Complaint.create({
      trackingId: 'NS-2026-40009',
      title: 'List query optimization test',
      description: 'Testing list projection exclusion.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Sector 1' },
      priority: 'Medium',
      slaDeadline: new Date(Date.now() + 72 * 3600 * 1000),
      status: 'Resolved',
      evidenceImage: VALID_PNG_1,
      resolutionEvidence: VALID_PNG_2,
    });

    // Citizen list (/my)
    const citizenListRes = await request(app)
      .get('/api/v1/complaints/my')
      .set('Authorization', `Bearer ${citizen1Token}`);

    expect(citizenListRes.status).toBe(200);
    expect(citizenListRes.body.complaints.length).toBeGreaterThan(0);
    const citizenItem = citizenListRes.body.complaints[0];
    expect(citizenItem.evidenceImage).toBeUndefined();
    expect(citizenItem.resolutionEvidence).toBeUndefined();

    // Officer list (/assigned)
    const officerListRes = await request(app)
      .get('/api/v1/complaints/assigned')
      .set('Authorization', `Bearer ${jeenuToken}`);

    expect(officerListRes.status).toBe(200);
    const officerItem = officerListRes.body.complaints[0];
    expect(officerItem.evidenceImage).toBeUndefined();
    expect(officerItem.resolutionEvidence).toBeUndefined();

    // Admin list (/)
    const adminListRes = await request(app)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminListRes.status).toBe(200);
    const adminItem = adminListRes.body.complaints[0];
    expect(adminItem.evidenceImage).toBeUndefined();
    expect(adminItem.resolutionEvidence).toBeUndefined();
  });

  it('15: provides seamless fallback for legacy complaints created without separate Evidence records', async () => {
    // Legacy complaint created prior to Phase 4A (only has top-level strings)
    const legacyComplaint = await Complaint.create({
      trackingId: 'NS-2026-LEGACY',
      title: 'Legacy street repair',
      description: 'Complaint created prior to Evidence collection introduction.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Old Town Square' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Resolved',
      resolutionNotes: 'Repaired by legacy technician.',
      evidenceImage: VALID_PNG_1,
      resolutionEvidence: VALID_PNG_2,
    });

    // Ensure zero records exist in Evidence collection
    expect(await Evidence.countDocuments({ complaint: legacyComplaint._id })).toBe(0);

    // Call evidence retrieval endpoint
    const res = await request(app)
      .get(`/api/v1/complaints/${legacyComplaint._id}/evidence`)
      .set('Authorization', `Bearer ${citizen1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(2);

    const citizenEv = res.body.evidence.find((e) => e.evidenceType === 'citizen_complaint');
    const officerEv = res.body.evidence.find((e) => e.evidenceType === 'officer_resolution');

    expect(citizenEv).toBeDefined();
    expect(citizenEv.dataUrl).toBe(VALID_PNG_1);
    expect(citizenEv.isLegacyFallback).toBe(true);

    expect(officerEv).toBeDefined();
    expect(officerEv.dataUrl).toBe(VALID_PNG_2);
    expect(officerEv.caption).toBe('Repaired by legacy technician.');
    expect(officerEv.isLegacyFallback).toBe(true);
  });

  it('16: accurately tracks sequential cycle numbering across multiple resolutions and reopens', async () => {
    const complaint = await Complaint.create({
      trackingId: 'NS-2026-40010',
      title: 'Intermittent underground short-circuit',
      description: 'Trips circuit breaker intermittently.',
      category: 'Electricity',
      department: elecDept._id,
      assignedOfficer: jeenuOfficer._id,
      citizen: citizen1._id,
      location: { address: 'Main Sewer line trench' },
      priority: 'High',
      slaDeadline: new Date(Date.now() + 48 * 3600 * 1000),
      status: 'Assigned',
    });

    // Cycle 1
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 1: insulation taping applied.',
        resolutionEvidence: VALID_PNG_1,
      });

    // Reopen 1
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizen1Token}`)
      .send({ status: 'Reopened', notes: 'Tripped again next morning.' });

    // Cycle 2
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 2: section re-routed and insulated.',
        resolutionEvidence: VALID_PNG_2,
      });

    // Reopen 2
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${citizen1Token}`)
      .send({ status: 'Reopened', notes: 'Still experiencing voltage drops.' });

    // Cycle 3 (notes only)
    await request(app)
      .put(`/api/v1/complaints/${complaint._id}/status`)
      .set('Authorization', `Bearer ${jeenuToken}`)
      .send({
        status: 'Resolved',
        resolutionNotes: 'Cycle 3: full feeder line replaced by heavy duty squad.',
      });

    const finalComplaint = await Complaint.findById(complaint._id);
    expect(finalComplaint.resolutionCycleCount).toBe(3);
    expect(finalComplaint.status).toBe('Resolved');
    // Top-level evidence cleared for Cycle 3 because no image provided
    expect(finalComplaint.resolutionEvidence).toBe('');

    // Verification of Evidence records count and cycle mapping
    const records = await Evidence.find({ complaint: complaint._id }).sort({ cycleNumber: 1 });
    expect(records.length).toBe(2); // Only cycles 1 and 2 had images
    expect(records[0].cycleNumber).toBe(1);
    expect(records[1].cycleNumber).toBe(2);
  });
});

