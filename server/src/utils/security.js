const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB decoded image limit
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 128;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Escapes RegExp metacharacters in untrusted search strings to prevent
 * MongoDB $regex injection and ReDoS attacks.
 */
const escapeRegex = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 120).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Verifies image magic bytes match the declared MIME type.
 */
const hasValidImageSignature = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
};

/**
 * Validates a base64 Data URI for uploaded evidence images.
 * Allows only JPEG, PNG, and WebP up to 5MB decoded size with matching file signatures.
 */
const validateImageDataUri = (rawImage, fieldLabel = 'Image') => {
  if (rawImage === undefined || rawImage === null || rawImage === '') {
    return { valid: true, value: '' };
  }

  if (typeof rawImage !== 'string') {
    return { valid: false, message: `${fieldLabel} must be a valid base64 image data URI.` };
  }

  const trimmed = rawImage.trim();
  if (!trimmed) {
    return { valid: true, value: '' };
  }

  const match = trimmed.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    return {
      valid: false,
      message: `${fieldLabel} must be a base64-encoded JPEG, PNG, or WebP image.`,
    };
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      valid: false,
      message: `Unsupported ${fieldLabel.toLowerCase()} format "${mimeType}". Only JPEG, PNG, and WebP images are allowed.`,
    };
  }

  const cleanBase64 = match[2].replace(/\s+/g, '');
  if (!cleanBase64 || cleanBase64.length > MAX_BASE64_LENGTH) {
    return {
      valid: false,
      message: `${fieldLabel} exceeds the maximum allowed size of 5MB.`,
    };
  }

  // Validate strict base64 length & character formatting
  if (cleanBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) {
    return {
      valid: false,
      message: `${fieldLabel} contains malformed base64 data.`,
    };
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return {
      valid: false,
      message: `${fieldLabel} exceeds the maximum allowed size of 5MB.`,
    };
  }

  if (!hasValidImageSignature(buffer, mimeType)) {
    return {
      valid: false,
      message: `${fieldLabel} file content does not match declared ${mimeType} format.`,
    };
  }

  return {
    valid: true,
    value: `data:${mimeType};base64,${cleanBase64}`,
  };
};

module.exports = {
  escapeRegex,
  validateImageDataUri,
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
};

