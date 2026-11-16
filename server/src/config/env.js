const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const normalizeEnvUri = (rawValue) => {
  if (typeof rawValue !== 'string') return '';
  return rawValue.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
};

const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return '';
  return origin.trim().replace(/\/+$/, '');
};

const parseCorsOrigins = (rawOrigins, clientUrl) => {
  const origins = new Set();
  const normalizedClient = normalizeOrigin(clientUrl);
  if (normalizedClient) origins.add(normalizedClient);

  if (typeof rawOrigins === 'string' && rawOrigins.trim()) {
    rawOrigins
      .split(',')
      .map(normalizeOrigin)
      .filter(Boolean)
      .forEach((origin) => origins.add(origin));
  }

  return Array.from(origins);
};

const WEAK_PLACEHOLDER_SECRETS = new Set([
  'replace_with_a_secure_random_jwt_secret_key_minimum_32_chars',
  'nagrik_sahayak_dev_jwt_secret_replace_in_production_key_32bytes',
  'secret',
  'changeme',
]);

const nodeEnv = process.env.NODE_ENV || 'development';

const resolveJwtSecret = () => {
  const rawSecret = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';
  const isWeak = !rawSecret || rawSecret.length < 32 || WEAK_PLACEHOLDER_SECRETS.has(rawSecret);

  if (nodeEnv === 'production') {
    if (isWeak) {
      throw new Error(
        'CRITICAL SECURITY ERROR: JWT_SECRET must be set to a strong non-default secret (at least 32 characters) in production.'
      );
    }
    return rawSecret;
  }

  if (rawSecret) {
    if (WEAK_PLACEHOLDER_SECRETS.has(rawSecret) && nodeEnv !== 'test') {
      console.warn('[Security] JWT_SECRET is using a placeholder value. Please replace it in server/.env.');
    }
    return rawSecret;
  }

  if (nodeEnv !== 'test') {
    console.warn('[Security] JWT_SECRET not set. Using an ephemeral runtime secret for this development session.');
  }
  return crypto.randomBytes(32).toString('hex');
};

const clientUrl = normalizeOrigin(process.env.CLIENT_URL) || 'http://localhost:5173';

const config = {
  port: process.env.PORT || 5000,
  nodeEnv,
  clientUrl,
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS, clientUrl),
  mongoUri: normalizeEnvUri(process.env.MONGODB_URI),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  slaHours: {
    Low: parseInt(process.env.SLA_LOW_HOURS, 10) || 120,       // 5 days
    Medium: parseInt(process.env.SLA_MEDIUM_HOURS, 10) || 72,   // 3 days
    High: parseInt(process.env.SLA_HIGH_HOURS, 10) || 48,       // 2 days
    Urgent: parseInt(process.env.SLA_URGENT_HOURS, 10) || 24,   // 1 day
  },
  duplicateThreshold: parseFloat(process.env.DUPLICATE_SIMILARITY_THRESHOLD) || 0.78,
  email: {
    enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: process.env.SMTP_SECURE === 'true',
    from: process.env.FROM_EMAIL || '"Nagrik Sahayak" <no-reply@nagriksahayak.gov.in>',
  },
  sms: {
    enabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true',
    provider: process.env.SMS_PROVIDER || 'mock',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },
};

module.exports = config;
