/**
 * Nagrik Sahayak — Administrative Officer Password Reset Utility
 *
 * Secure one-time password reset script for an existing department officer.
 * Connects to MongoDB, verifies the officer's existence, status, and department,
 * prompts for a new password interactively without echoing it to the screen,
 * and lets Mongoose's pre-save bcrypt hook hash the password securely.
 *
 * Usage (from workspace root):
 *   node server/src/scripts/resetOfficerPassword.js
 *
 * Or (from server directory):
 *   node src/scripts/resetOfficerPassword.js
 */

const readline = require('readline');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Department = require('../models/Department');
const { logAudit } = require('../services/auditService');

const TARGET_EMAIL = 'jeenu0509@skit.ac.in';
const EXPECTED_ROLE = 'officer';
const EXPECTED_DEPT_NAME = 'Electricity & Energy';

/**
 * Prompts for password interactively without echoing characters to screen
 * Handles backspace, enter, and Ctrl+C cancellation safely.
 */
function askHiddenPassword(promptText) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Non-interactive fallback (e.g. piped input)
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(promptText, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
      return;
    }

    process.stdout.write(promptText);

    const wasRaw = Boolean(process.stdin.isRaw);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let password = '';

    const onData = (chunk) => {
      const str = chunk.toString('utf-8');
      for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === '\r' || c === '\n' || c === '\u0004') {
          // Enter key
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(wasRaw);
          process.stdout.write('\n');
          return resolve(password);
        } else if (c === '\u0003') {
          // Ctrl+C
          process.stdin.removeListener('data', onData);
          process.stdin.setRawMode(wasRaw);
          process.stdout.write('\n[Operation cancelled by administrator]\n');
          process.exit(1);
        } else if (c === '\b' || c === '\x7f' || c === '\u0008') {
          // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else if (c.charCodeAt(0) >= 32) {
          // Printable character (store silently without display)
          password += c;
        }
      }
    };

    process.stdin.on('data', onData);
  });
}

async function runPasswordReset() {
  console.log('================================================================');
  console.log('       NAGRIK SAHAYAK — OFFICER PASSWORD RESET UTILITY           ');
  console.log('================================================================');

  try {
    console.log('[1/4] Connecting to database...');
    await connectDB();

    console.log(`[2/4] Verifying target account: ${TARGET_EMAIL}`);
    const user = await User.findOne({ email: TARGET_EMAIL.toLowerCase().trim() })
      .populate('department', 'name code');

    // Strict validation: Refuse to create a new account if missing
    if (!user) {
      console.error(`\n[ERROR] Target account "${TARGET_EMAIL}" does not exist in the database.`);
      console.error('Refusing to create a new account. Aborting.\n');
      process.exitCode = 1;
      return;
    }

    // Strict validation: Verify role is officer
    if (user.role !== EXPECTED_ROLE) {
      console.error(`\n[ERROR] Account exists but role is "${user.role}" (expected "${EXPECTED_ROLE}"). Aborting.\n`);
      process.exitCode = 1;
      return;
    }

    // Strict validation: Verify account is active
    if (!user.isActive) {
      console.error(`\n[ERROR] Account "${TARGET_EMAIL}" is currently deactivated. Aborting.\n`);
      process.exitCode = 1;
      return;
    }

    console.log('Account verified successfully:');
    console.log(`  - Name:       ${user.name}`);
    console.log(`  - Email:      ${user.email}`);
    console.log(`  - Role:       ${user.role}`);
    console.log(`  - Department: ${user.department?.name || 'Unassigned'} (${user.department?.code || 'N/A'})`);
    console.log(`  - Status:     ${user.isActive ? 'Active' : 'Inactive'}`);

    if (user.department?.name !== EXPECTED_DEPT_NAME) {
      console.warn(`  [WARNING] Department name "${user.department?.name}" differs from expected "${EXPECTED_DEPT_NAME}".`);
    }

    console.log('\n[3/4] Enter new credentials:');
    const newPassword = await askHiddenPassword('Enter new temporary password: ');

    // Existing password policy: minimum 6 characters
    if (!newPassword || newPassword.trim().length < 6) {
      console.error('\n[ERROR] Password policy violation: Password must be at least 6 characters long.');
      console.error('No changes were made. Aborting.\n');
      process.exitCode = 1;
      return;
    }

    const confirmPassword = await askHiddenPassword('Confirm new temporary password: ');

    if (newPassword !== confirmPassword) {
      console.error('\n[ERROR] Passwords do not match.');
      console.error('No changes were made. Aborting.\n');
      process.exitCode = 1;
      return;
    }

    console.log('\n[4/4] Updating password...');
    // Set user.password as plain text; Mongoose pre-save hook in User model will hash with bcryptjs
    user.password = newPassword.trim();
    await user.save();

    // Log administrative audit entry (passwords are automatically stripped in logAudit)
    await logAudit({
      actor: user._id,
      actorName: 'Administrative CLI',
      actorRole: 'admin',
      action: 'ADMIN_PASSWORD_RESET',
      targetType: 'User',
      targetId: user._id,
      details: {
        targetEmail: user.email,
        targetRole: user.role,
        department: user.department?.name,
      },
    });

    console.log('================================================================');
    console.log(' SUCCESS: Password updated successfully for:');
    console.log(`   Officer:    ${user.name}`);
    console.log(`   Email:      ${user.email}`);
    console.log(`   Department: ${user.department?.name}`);
    console.log('   The officer can now log in at /login/officer.');
    console.log('   Role, department, and complaint assignments were preserved.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('\n[FATAL ERROR] Password reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Database connection closed safely.');
    }
  }
}

// Ensure execution runs when called directly
if (require.main === module) {
  runPasswordReset();
}

module.exports = { runPasswordReset };

