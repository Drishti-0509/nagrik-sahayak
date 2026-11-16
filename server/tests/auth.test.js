const request = require('supertest');
const { app } = require('../src/server');

describe('Authentication & Authorization Tests', () => {
  const citizenData = {
    name: 'Ramesh Sharma',
    email: 'ramesh@example.com',
    password: 'Password123!',
    phone: '9876543210',
    address: 'Flat 402, Gandhi Nagar, New Delhi',
  };

  it('should register a new citizen successfully with citizen role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(citizenData);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(citizenData.email.toLowerCase());
    expect(res.body.user.role).toBe('citizen');
    expect(res.body.user.password).toBeUndefined(); // Password must never be exposed
  });

  it('should prevent mass assignment or privilege escalation to admin via public registration', async () => {
    const maliciousData = {
      name: 'Hacker User',
      email: 'hacker@example.com',
      password: 'Password123!',
      role: 'admin', // Malicious attempt to inject admin role
    };

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(maliciousData);

    expect(res.statusCode).toBe(201);
    // Role MUST remain citizen
    expect(res.body.user.role).toBe('citizen');
  });

  it('should reject registration with duplicate email address', async () => {
    await request(app).post('/api/v1/auth/register').send(citizenData);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(citizenData);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should reject registration with weak password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...citizenData, email: 'short@example.com', password: '123' });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should log in an existing user with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(citizenData);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: citizenData.email,
      password: citizenData.password,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe(citizenData.name);
  });

  it('should reject login with wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(citizenData);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: citizenData.email,
      password: 'WrongPassword!',
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should fetch user profile when authenticated with Bearer token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(citizenData);
    const token = regRes.body.token;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(citizenData.email.toLowerCase());
  });

  it('should reject unauthenticated request to /api/v1/auth/me', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
