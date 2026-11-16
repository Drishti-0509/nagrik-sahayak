const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config/env');
const { app } = require('../src/server');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Complaint = require('../src/models/Complaint');
const Notification = require('../src/models/Notification');
const { ruleBasedClassifier } = require('../src/services/geminiService');

async function createCitizen(name = 'Test Citizen', email = 'testcitizen@example.com') {
  const user = await User.create({
    name,
    email,
    password: 'Password123!',
    phone: '9811223344',
    role: 'citizen',
    address: 'Connaught Place, New Delhi',
  });
  const token = jwt.sign({ id: user._id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  return { user, token };
}

describe('Phase 3 Corrective Patch: Department Routing, AI Classification & Timeline Attribution', () => {
  describe('Part 1: AI Keyword Classification Heuristic', () => {
    it('1. correctly classifies "Street light is not working" as Electricity and maps to Electricity & Energy', () => {
      const res = ruleBasedClassifier('Street light is not working', 'The pole light near house 42 has been dead for two days.');
      expect(res.categorySuggestion).toBe('Electricity');
      expect(res.departmentSuggestion).toBe('Electricity & Energy');
      expect(res.nextAction).toContain('Electricity & Energy');
    });

    it('2. correctly classifies "Street lights are flickering" as Electricity', () => {
      const res = ruleBasedClassifier('Street lights are flickering', 'Continuous flickering causing visibility issues at night.');
      expect(res.categorySuggestion).toBe('Electricity');
      expect(res.departmentSuggestion).toBe('Electricity & Energy');
    });

    it('3. correctly classifies "Street lamp is damaged" as Electricity', () => {
      const res = ruleBasedClassifier('Street lamp is damaged', 'The glass cover and bulb are hanging loosely.');
      expect(res.categorySuggestion).toBe('Electricity');
      expect(res.departmentSuggestion).toBe('Electricity & Energy');
    });

    it('4. correctly classifies "Road has potholes" as Roads and Infrastructure', () => {
      const res = ruleBasedClassifier('Road has potholes', 'Large craters in the asphalt damaging cars and scooters.');
      expect(res.categorySuggestion).toBe('Roads and Infrastructure');
      expect(res.departmentSuggestion).toBe('Roads & Public Infrastructure');
      expect(res.nextAction).toContain('Roads & Public Infrastructure');
    });

    it('5. correctly classifies "Footpath is broken" as Roads and Infrastructure', () => {
      const res = ruleBasedClassifier('Footpath is broken', 'Pedestrian walkway pavement has caved in near market.');
      expect(res.categorySuggestion).toBe('Roads and Infrastructure');
      expect(res.departmentSuggestion).toBe('Roads & Public Infrastructure');
    });

    it('6. correctly classifies "Dark street creates a safety concern" as Public Safety without generic keyword interception', () => {
      const res = ruleBasedClassifier('Dark street creates a safety concern', 'Dark spot in the alley with threats, theft risk and harassment.');
      expect(res.categorySuggestion).toBe('Public Safety');
      expect(res.departmentSuggestion).toBe('Public Safety & Law Enforcement');
      expect(res.nextAction).toContain('Public Safety & Law Enforcement');
    });
  });

  describe('Part 2: Department-Category Validation & Timeline Attribution API Tests', () => {
    let citizenToken;
    let citizenUser;
    let elecDept;
    let roadDept;
    let waterDept;
    let genDept;
    let inactiveDept;

    beforeEach(async () => {
      const actor = await createCitizen();
      citizenToken = actor.token;
      citizenUser = actor.user;

      elecDept = await Department.create({
        name: 'Electricity & Energy',
        code: 'ELEC',
        categories: ['Electricity'],
        isActive: true,
      });

      roadDept = await Department.create({
        name: 'Roads & Public Infrastructure',
        code: 'ROAD',
        categories: ['Roads and Infrastructure'],
        isActive: true,
      });

      waterDept = await Department.create({
        name: 'Water Supply & Sewerage',
        code: 'WATER',
        categories: ['Water Supply'],
        isActive: true,
      });

      genDept = await Department.create({
        name: 'General Public Administration',
        code: 'GEN',
        categories: ['Other'],
        isActive: true,
      });

      inactiveDept = await Department.create({
        name: 'Decommissioned Utility Department',
        code: 'INACT',
        categories: ['Electricity'],
        isActive: false,
      });
    });

    it('7. accepts valid compatible department: Electricity + Electricity & Energy', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Street light repair required',
          description: 'Street light on pole 5 is completely blacked out.',
          category: 'Electricity',
          departmentId: elecDept._id.toString(),
          location: { address: 'Sector 4, Main Road', pincode: '110001' },
          priority: 'Medium',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.complaint.department).toBe(elecDept._id.toString());
      expect(res.body.complaint.category).toBe('Electricity');
    });

    it('8. accepts valid compatible department: Roads and Infrastructure + Roads & Public Infrastructure', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Deep pothole on main intersection',
          description: 'Crater in road causing serious traffic hazards and accidents.',
          category: 'Roads and Infrastructure',
          departmentId: roadDept._id.toString(),
          location: { address: 'Outer Ring Road, Block C', pincode: '110002' },
          priority: 'High',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.complaint.department).toBe(roadDept._id.toString());
    });

    it('9. rejects incompatible department: Roads and Infrastructure + Water Supply & Sewerage with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Broken road surface',
          description: 'Asphalt worn away completely down to gravel.',
          category: 'Roads and Infrastructure',
          departmentId: waterDept._id.toString(),
          location: { address: 'Lane 3, Civil Lines', pincode: '110054' },
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incompatible with category');
      expect(res.body.message).toContain('Roads & Public Infrastructure');

      // Ensure no dangling complaint was created
      const count = await Complaint.countDocuments({ title: 'Broken road surface' });
      expect(count).toBe(0);
    });

    it('10. rejects incompatible department: Electricity + General Public Administration with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Sparking street light pole',
          description: 'Electrical fixture sparking and flickering on pole.',
          category: 'Electricity',
          departmentId: genDept._id.toString(),
          location: { address: 'Market square', pincode: '110001' },
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incompatible with category "Electricity"');
      expect(res.body.message).toContain('Electricity & Energy');
    });

    it('11. missing departmentId safely auto-routes by category to the canonical department', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Pothole near community gate',
          description: 'Large road crater right in front of entry gate.',
          category: 'Roads and Infrastructure',
          location: { address: 'Gate 2, Pocket A', pincode: '110092' },
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.complaint.department).toBe(roadDept._id.toString());
    });

    it('12. invalid or inactive departmentId is rejected safely with HTTP 400', async () => {
      // Non-existent ObjectId
      const resNonExistent = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Power line down',
          description: 'Electric wire fallen on ground.',
          category: 'Electricity',
          departmentId: '507f1f77bcf86cd799439011',
          location: { address: 'Main street', pincode: '110001' },
        });

      expect(resNonExistent.statusCode).toBe(400);
      expect(resNonExistent.body.success).toBe(false);

      // Malformed ObjectId string
      const resMalformed = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Power line down',
          description: 'Electric wire fallen on ground.',
          category: 'Electricity',
          departmentId: 'invalid-id-xyz',
          location: { address: 'Main street', pincode: '110001' },
        });

      expect(resMalformed.statusCode).toBe(400);
      expect(resMalformed.body.message).toBe('Invalid department ID.');

      // Inactive department
      const resInactive = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Power line down',
          description: 'Electric wire fallen on ground.',
          category: 'Electricity',
          departmentId: inactiveDept._id.toString(),
          location: { address: 'Main street', pincode: '110001' },
        });

      expect(resInactive.statusCode).toBe(400);
      expect(resInactive.body.success).toBe(false);
    });

    it('13. explicit valid department selection records "Department selected by citizen: [Department Name]" in timeline', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Street lamp broken on pole',
          description: 'Glass cover broken on pole lamp.',
          category: 'Electricity',
          departmentId: elecDept._id.toString(),
          location: { address: 'Block 4, Model Town', pincode: '110009' },
        });

      expect(res.statusCode).toBe(201);
      const timeline = res.body.complaint.timeline;
      expect(timeline.length).toBeGreaterThanOrEqual(2);

      const deptAssignedEvent = timeline.find((t) => t.eventType === 'department_assigned');
      expect(deptAssignedEvent).toBeDefined();
      expect(deptAssignedEvent.description).toBe('Department selected by citizen: Electricity & Energy');
      expect(deptAssignedEvent.changedByName).toBe(citizenUser.name);
      expect(deptAssignedEvent.changedByRole).toBe('citizen');
    });

    it('14. automatic category routing records "Automatically routed by category to: [Department Name]" in timeline', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Footpath paving slabs broken',
          description: 'Pedestrian pavement cracked and hazardous.',
          category: 'Roads and Infrastructure',
          location: { address: 'Avenue 2, Saket', pincode: '110017' },
        });

      expect(res.statusCode).toBe(201);
      const timeline = res.body.complaint.timeline;
      const deptAssignedEvent = timeline.find((t) => t.eventType === 'department_assigned');
      expect(deptAssignedEvent).toBeDefined();
      expect(deptAssignedEvent.description).toBe('Automatically routed by category to: Roads & Public Infrastructure');
      expect(deptAssignedEvent.changedByName).toBe('System Router');
      expect(deptAssignedEvent.changedByRole).toBe('system');
    });

    it('preserves Phase 3 notification creation on submission', async () => {
      const res = await request(app)
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          title: 'Street light out for 3 days',
          description: 'Street light fixture is dark and needs replacement.',
          category: 'Electricity',
          departmentId: elecDept._id.toString(),
          location: { address: 'Lane 1, Defence Colony', pincode: '110024' },
        });

      expect(res.statusCode).toBe(201);
      const notifications = await Notification.find({ recipient: citizenUser._id });
      expect(notifications.some((n) => n.trackingId === res.body.complaint.trackingId)).toBe(true);
    });
  });
});

