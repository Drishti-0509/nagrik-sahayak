const request = require('supertest');
const { app } = require('../src/server');

describe('Health & Status Endpoints', () => {
  it('should return 200 OK and valid health report when database is connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.statusCode).toBe(200);
    expect(res.body.service).toBe('Nagrik Sahayak API');
    expect(res.body.database).toBeDefined();
    expect(res.body.database.connected).toBe(true);
    expect(res.body.uptime).toBeDefined();
    expect(res.body.aiIntegration).toBeDefined();
    expect(res.body.aiIntegration.fallbackAvailable).toBe(true);
  });

  it('should return 404 for non-existent endpoint', async () => {
    const res = await request(app).get('/api/v1/nonexistent');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
