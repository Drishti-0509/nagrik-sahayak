/**
 * Nagrik Sahayak — Safe Administrator Initialization Script
 *
 * Usage:
 *   node server/src/scripts/initAdmin.js --name="Super Admin" --email="admin@nagriksahayak.gov.in" --password="YourSecurePassword123"
 *
 * Never commits passwords to source control.
 */

const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB } = require('../config/db');
const User = require('../models/User');

// Parse CLI arguments: --name=..., --email=..., --password=...
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  if (key && value) {
    acc[key.replace(/^--/, '')] = value;
  }
  return acc;
}, {});

const name = args.name || process.env.INITIAL_ADMIN_NAME || 'System Administrator';
const email = args.email || process.env.INITIAL_ADMIN_EMAIL || 'admin@nagriksahayak.gov.in';
const password = args.password || process.env.INITIAL_ADMIN_PASSWORD;

async function initAdmin() {
  if (!password) {
    console.error(`
================================================================================
ERROR: No password provided!
Please run the command with a strong password:
  node server/src/scripts/initAdmin.js --email="admin@nagriksahayak.gov.in" --password="YourSecurePassword123" --name="System Administrator"
================================================================================`);
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('ERROR: Administrator password must be at least 8 characters long for security.');
    process.exit(1);
  }

  console.log('[InitAdmin] Connecting to database...');
  await connectDB();

  const existingAdmin = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingAdmin) {
    console.log(`[InitAdmin] User with email ${email} already exists (Role: ${existingAdmin.role}).`);
    if (existingAdmin.role !== 'admin') {
      existingAdmin.role = 'admin';
      existingAdmin.password = password;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log(`[InitAdmin] Successfully promoted existing user ${email} to Administrator.`);
    } else {
      console.log(`[InitAdmin] Updating password for existing Administrator ${email}...`);
      existingAdmin.password = password;
      existingAdmin.isActive = true;
      await existingAdmin.save();
      console.log(`[InitAdmin] Administrator credentials updated successfully.`);
    }
  } else {
    const newAdmin = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'admin',
      isActive: true,
    });
    console.log(`
================================================================================
SUCCESS: Initial Administrator account created successfully!
  Name:  ${newAdmin.name}
  Email: ${newAdmin.email}
  Role:  ${newAdmin.role}
  ID:    ${newAdmin._id}
================================================================================`);
  }

  await mongoose.disconnect();
  console.log('[InitAdmin] Database connection closed.');
  process.exit(0);
}

initAdmin().catch((err) => {
  console.error('[InitAdmin] Failed to initialize administrator:', err.message);
  process.exit(1);
});
