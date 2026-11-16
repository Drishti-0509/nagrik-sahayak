const Evidence = require('../models/Evidence');
const { validateImageDataUri } = require('../utils/security');

/**
 * Parses MIME type and byte size from a valid Base64 Data URI.
 * @param {string} dataUri
 * @returns {{ mimeType: string, fileSizeBytes: number }}
 */
function inspectBase64DataUri(dataUri) {
  const match = String(dataUri || '').match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Invalid Base64 Data URI format.');
  }
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return {
    mimeType,
    fileSizeBytes: buffer.length,
  };
}

/**
 * Validates, processes, and persists an evidence image record.
 * Decouples storage details so external providers (S3/Cloudinary) can be plugged in later.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.complaintId
 * @param {mongoose.Types.ObjectId|string} [params.timelineEventId=null]
 * @param {number} params.cycleNumber
 * @param {'citizen_complaint'|'officer_resolution'} params.evidenceType
 * @param {string} params.rawImage - Base64 Data URI
 * @param {string} [params.caption='']
 * @param {Object} params.user - { _id, role }
 * @param {'base64'|'cloudinary'|'s3'} [params.storageType='base64']
 * @returns {Promise<Object>} The persisted Evidence document
 */
async function storeEvidence({
  complaintId,
  timelineEventId = null,
  cycleNumber = 1,
  evidenceType = 'officer_resolution',
  rawImage,
  caption = '',
  user,
  storageType = 'base64',
}) {
  if (!rawImage) {
    throw new Error('Image data is required to store evidence.');
  }

  // Enforce central strict validation (MIME, 5MB limit, magic bytes)
  const validation = validateImageDataUri(rawImage, 'Resolution evidence image');
  if (!validation.valid) {
    const error = new Error(validation.message);
    error.statusCode = 400;
    throw error;
  }

  const validatedDataUri = validation.value;
  const { mimeType, fileSizeBytes } = inspectBase64DataUri(validatedDataUri);

  const evidenceDoc = await Evidence.create({
    complaint: complaintId,
    timelineEventId,
    cycleNumber,
    evidenceType,
    storageType,
    dataUrl: storageType === 'base64' ? validatedDataUri : '',
    storageKey: '',
    mimeType,
    fileSizeBytes,
    caption: String(caption || '').trim().slice(0, 500),
    uploadedBy: user._id,
    uploaderRole: user.role,
  });

  return evidenceDoc;
}

/**
 * Retrieves all evidence records for a given complaint in chronological order.
 *
 * @param {mongoose.Types.ObjectId|string} complaintId
 * @param {Object} [options]
 * @param {boolean} [options.includeDataUrl=true]
 * @returns {Promise<Array<Object>>}
 */
async function getEvidenceByComplaint(complaintId, { includeDataUrl = true } = {}) {
  let query = Evidence.find({ complaint: complaintId })
    .populate('uploadedBy', 'name role email')
    .sort({ createdAt: 1, cycleNumber: 1 });

  if (!includeDataUrl) {
    query = query.select('-dataUrl');
  }

  return query.lean();
}

/**
 * Retrieves a single evidence record by ID.
 *
 * @param {mongoose.Types.ObjectId|string} evidenceId
 * @returns {Promise<Object|null>}
 */
async function getEvidenceById(evidenceId) {
  return Evidence.findById(evidenceId).populate('uploadedBy', 'name role').lean();
}

module.exports = {
  storeEvidence,
  getEvidenceByComplaint,
  getEvidenceById,
  inspectBase64DataUri,
};

