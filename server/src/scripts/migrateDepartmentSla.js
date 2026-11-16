const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Department = require('../models/Department');
const { STANDARD_SLA_HOURS } = require('../services/slaService');

/**
 * Idempotently standardize slaHours across all existing Department records
 * without deleting departments or modifying historical complaint deadlines.
 * @param {Object} [options]
 * @param {boolean} [options.dryRun=false]
 * @returns {Promise<{ totalDepartments: number, updatedCount: number, unchangedCount: number, details: Array }>}
 */
async function migrateDepartmentSla({ dryRun = false } = {}) {
  const departments = await Department.find({}).sort({ code: 1 });
  const details = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const dept of departments) {
    const current = dept.slaHours || {};
    const isAlreadyStandard =
      current.Low === STANDARD_SLA_HOURS.Low &&
      current.Medium === STANDARD_SLA_HOURS.Medium &&
      current.High === STANDARD_SLA_HOURS.High &&
      current.Urgent === STANDARD_SLA_HOURS.Urgent;

    const before = {
      Low: current.Low,
      Medium: current.Medium,
      High: current.High,
      Urgent: current.Urgent,
    };

    if (isAlreadyStandard) {
      unchangedCount++;
      details.push({
        code: dept.code,
        name: dept.name,
        status: 'unchanged',
        before,
        after: { ...STANDARD_SLA_HOURS },
      });
      continue;
    }

    if (!dryRun) {
      await Department.updateOne(
        { _id: dept._id },
        { $set: { slaHours: { ...STANDARD_SLA_HOURS } } }
      );
    }

    updatedCount++;
    details.push({
      code: dept.code,
      name: dept.name,
      status: dryRun ? 'would_update' : 'updated',
      before,
      after: { ...STANDARD_SLA_HOURS },
    });
  }

  return {
    totalDepartments: departments.length,
    updatedCount,
    unchangedCount,
    details,
  };
}

if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes('--dry-run');
    try {
      await connectDB();
      const summary = await migrateDepartmentSla({ dryRun });
      console.log(
        `[SLA Migration] Departments scanned: ${summary.totalDepartments}, updated: ${summary.updatedCount}, unchanged: ${summary.unchangedCount}`
      );
      summary.details.forEach((d) => {
        console.log(
          `  - ${d.code} (${d.name}): ${d.status} | before=${JSON.stringify(d.before)} -> after=${JSON.stringify(d.after)}`
        );
      });
      await mongoose.connection.close();
      process.exit(0);
    } catch (err) {
      console.error('[SLA Migration] Failed:', err.message);
      try {
        await mongoose.connection.close();
      } catch {
        // ignore close error
      }
      process.exit(1);
    }
  })();
}

module.exports = {
  migrateDepartmentSla,
};

