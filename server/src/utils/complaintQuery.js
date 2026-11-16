const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const { PRIORITY_RANK } = require('../services/slaService');

/**
 * Safely convert an ObjectId-like value (ObjectId, hex string, or populated subdoc) to mongoose.Types.ObjectId
 * so aggregation $match queries always match reference fields consistently.
 * @param {mongoose.Types.ObjectId|string|Object|null|undefined} value
 * @returns {mongoose.Types.ObjectId|null}
 */
function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  const rawId = typeof value === 'object' && value._id ? value._id.toString() : String(value);
  return mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : null;
}

/**
 * Query complaints sorted by explicit priority ranking (Urgent -> High -> Medium -> Low),
 * followed by earliest SLA deadline and newest creation timestamp.
 * Uses MongoDB $switch because lexicographic sorting puts 'High'/'Low'/'Medium' before 'Urgent'.
 * @param {Object} matchQuery
 * @param {Object} [options]
 * @param {number} [options.skip=0]
 * @param {number} [options.limit=10]
 * @param {Array} [options.populate=[]]
 * @param {boolean} [options.excludeEvidence=true] - Exclude heavy base64 evidence fields from list queries
 * @returns {Promise<Array<Object>>}
 */
async function findComplaintsByPriority(
  matchQuery,
  { skip = 0, limit = 10, populate = [], excludeEvidence = true } = {}
) {
  const safeSkip = Math.max(0, Number(skip) || 0);
  const safeLimit = Math.max(1, Number(limit) || 10);

  const projectStage = { priorityRank: 0 };
  if (excludeEvidence) {
    projectStage.evidenceImage = 0;
    projectStage.resolutionEvidence = 0;
  }

  const docs = await Complaint.aggregate([
    { $match: matchQuery },
    {
      $addFields: {
        priorityRank: {
          $switch: {
            branches: [
              { case: { $eq: ['$priority', 'Urgent'] }, then: PRIORITY_RANK.Urgent },
              { case: { $eq: ['$priority', 'High'] }, then: PRIORITY_RANK.High },
              { case: { $eq: ['$priority', 'Medium'] }, then: PRIORITY_RANK.Medium },
              { case: { $eq: ['$priority', 'Low'] }, then: PRIORITY_RANK.Low },
            ],
            default: 5,
          },
        },
      },
    },
    { $sort: { priorityRank: 1, slaDeadline: 1, createdAt: -1 } },
    { $skip: safeSkip },
    { $limit: safeLimit },
    { $project: projectStage },
  ]);

  if (!docs.length || !populate.length) {
    return docs;
  }

  return Complaint.populate(docs, populate);
}

module.exports = {
  toObjectId,
  findComplaintsByPriority,
};

