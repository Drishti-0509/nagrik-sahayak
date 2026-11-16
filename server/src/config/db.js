const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./env');

const EXPECTED_DB_NAME = 'nagrik_sahayak';
const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];
const DNS_FAILURE_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ESERVFAIL',
  'ENODATA',
  'EBADRESP',
  'EBADQUERY',
]);

/**
 * Masks credentials in MongoDB connection strings for safe logging.
 * Handles both mongodb:// and mongodb+srv:// without exposing passwords.
 */
const sanitizeUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  const schemeMatch = trimmed.match(/^(mongodb(?:\+srv)?):\/\/(.*)$/i);
  if (!schemeMatch) {
    return '<invalid-mongodb-uri>';
  }

  const [, scheme, rest] = schemeMatch;
  const queryOrHashIdx = rest.search(/[?#]/);
  const beforeQuery = queryOrHashIdx === -1 ? rest : rest.slice(0, queryOrHashIdx);
  let suffix = queryOrHashIdx === -1 ? '' : rest.slice(queryOrHashIdx);
  suffix = suffix.replace(/([?&](?:password|pass|pwd)=)[^&#]*/gi, '$1***');

  const atIdx = beforeQuery.lastIndexOf('@');
  if (atIdx !== -1) {
    const afterAt = beforeQuery.slice(atIdx + 1);
    const slashIdx = afterAt.indexOf('/');
    const dbPath = slashIdx === -1 ? '' : afterAt.slice(slashIdx);
    return `${scheme}://***:***@<cluster>${dbPath}${suffix}`;
  }

  const slashIdx = beforeQuery.indexOf('/');
  const authority = slashIdx === -1 ? beforeQuery : beforeQuery.slice(0, slashIdx);
  const dbPath = slashIdx === -1 ? '' : beforeQuery.slice(slashIdx);
  const looksLikeHostsOnly =
    authority.length > 0 &&
    authority.split(',').every((host) => /^(\[[^\]]+\]|[^:\s]+)(:\d+)?$/.test(host));

  if (!looksLikeHostsOnly) {
    return `${scheme}://<redacted>${dbPath}${suffix}`;
  }

  return `${scheme}://${authority}${dbPath}${suffix}`;
};

/**
 * Redacts any embedded MongoDB URI credentials from arbitrary log or error text.
 */
const sanitizeLogText = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(
    /(mongodb(?:\+srv)?):\/\/[^\s@]+@[^\s/?#]+/gi,
    '$1://***:***@<cluster>'
  );
};

const createCodedError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

/**
 * Validates MONGODB_URI syntax and enforces target database name "nagrik_sahayak".
 */
const validateMongoUri = (uri) => {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw createCodedError(
      'MONGODB_URI is required to start Nagrik Sahayak backend',
      'MISSING_MONGODB_URI'
    );
  }

  const trimmed = uri.trim();
  if (/\s/.test(trimmed)) {
    throw createCodedError(
      'MONGODB_URI contains whitespace or newline characters.',
      'INVALID_MONGODB_URI'
    );
  }

  if (!/^mongodb(\+srv)?:\/\//.test(trimmed)) {
    if (/^mongodb(\+srv)?:\/\//i.test(trimmed)) {
      throw createCodedError(
        'MongoDB URI scheme must be lowercase ("mongodb://" or "mongodb+srv://").',
        'INVALID_MONGODB_URI'
      );
    }
    throw createCodedError(
      'Invalid MongoDB URI scheme. Expected connection string to start with "mongodb://" or "mongodb+srv://".',
      'INVALID_MONGODB_URI'
    );
  }

  const isSrv = trimmed.startsWith('mongodb+srv://');
  const withoutScheme = trimmed.replace(/^mongodb(?:\+srv)?:\/\//, '');
  const queryOrHashIdx = withoutScheme.search(/[?#]/);
  const beforeQuery = queryOrHashIdx === -1 ? withoutScheme : withoutScheme.slice(0, queryOrHashIdx);

  const atIdx = beforeQuery.lastIndexOf('@');
  const userInfo = atIdx === -1 ? '' : beforeQuery.slice(0, atIdx);
  const hostAndPath = atIdx === -1 ? beforeQuery : beforeQuery.slice(atIdx + 1);

  if (atIdx !== -1) {
    if (!userInfo) {
      throw createCodedError(
        'Missing username/credentials before "@" in MONGODB_URI.',
        'INVALID_MONGODB_URI'
      );
    }
    if (userInfo.includes('@')) {
      throw createCodedError(
        'Credentials in MONGODB_URI contain an unencoded "@" character. URL-encode special characters (e.g. "@" -> "%40").',
        'INVALID_MONGODB_URI'
      );
    }
    if (userInfo.includes('/')) {
      throw createCodedError(
        'Credentials in MONGODB_URI contain an unencoded "/" character. URL-encode special characters (e.g. "/" -> "%2F").',
        'INVALID_MONGODB_URI'
      );
    }
    const firstColon = userInfo.indexOf(':');
    if (firstColon !== -1 && userInfo.slice(firstColon + 1).includes(':')) {
      throw createCodedError(
        'Password in MONGODB_URI contains an unencoded ":" character. URL-encode special characters (e.g. ":" -> "%3A").',
        'INVALID_MONGODB_URI'
      );
    }
  }

  const slashIdx = hostAndPath.indexOf('/');
  const hostPart = slashIdx === -1 ? hostAndPath : hostAndPath.slice(0, slashIdx);
  const dbName = slashIdx === -1 ? '' : hostAndPath.slice(slashIdx + 1);

  if (!hostPart) {
    throw createCodedError('Missing cluster hostname in MONGODB_URI.', 'INVALID_MONGODB_URI');
  }

  if (isSrv && (hostPart.includes(',') || hostPart.includes(':'))) {
    throw createCodedError(
      'mongodb+srv:// URIs must specify a single hostname without a port number.',
      'INVALID_MONGODB_URI'
    );
  }

  if (dbName.includes('/')) {
    throw createCodedError('Invalid database path in MONGODB_URI.', 'INVALID_MONGODB_URI');
  }

  if (dbName && dbName !== EXPECTED_DB_NAME) {
    throw createCodedError(
      `MONGODB_URI specifies database "${dbName}", but Nagrik Sahayak requires "${EXPECTED_DB_NAME}". Refusing to switch to an unrelated database.`,
      'DATABASE_MISMATCH'
    );
  }

  return {
    isSrv,
    hasDbInUri: Boolean(dbName),
    dbName: EXPECTED_DB_NAME,
  };
};

const collectErrors = (err) => {
  const errors = [];
  if (!err) return errors;
  errors.push(err);
  if (err.cause && typeof err.cause === 'object') {
    errors.push(err.cause);
  }

  const serverMaps = [err.reason?.servers, err.cause?.servers];
  for (const servers of serverMaps) {
    if (servers && typeof servers.values === 'function') {
      for (const desc of servers.values()) {
        if (desc && desc.error) {
          errors.push(desc.error);
        }
      }
    }
  }
  return errors;
};

const isSrvDnsError = (err) => {
  if (!err) return false;
  return (
    err.syscall === 'querySrv' ||
    err.syscall === 'queryTxt' ||
    /querySrv|queryTxt|resolveSrv|resolveTxt/i.test(err.message || '')
  );
};

const isAtlasConnection = (err, uri) => {
  if (typeof uri === 'string' && /\.mongodb\.net(?:[/:?#]|$)/i.test(uri)) {
    return true;
  }
  const servers = err?.reason?.servers || err?.cause?.servers;
  if (servers && typeof servers.values === 'function') {
    for (const desc of servers.values()) {
      if (desc?.host && desc.host.endsWith('.mongodb.net')) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Classifies MongoDB connection errors into clear operational categories.
 */
const classifyMongoError = (err, uri) => {
  const allErrors = collectErrors(err);
  const topName = err?.name || '';
  const topCode = err?.code;
  const topMessage = err?.message || '';

  const isTxtRecordParseError = allErrors.some((e) =>
    /DNS TXT Record|text records?/i.test(e.message || '')
  );

  // 1. Invalid MongoDB URI (including missing env var or wrong database name)
  if (
    topCode === 'MISSING_MONGODB_URI' ||
    topCode === 'INVALID_MONGODB_URI' ||
    topCode === 'DATABASE_MISMATCH' ||
    (!isTxtRecordParseError &&
      (topName === 'MongoParseError' ||
        topName === 'MongoInvalidArgumentError' ||
        topName === 'MongoMissingCredentialsError' ||
        /Invalid scheme|unescaped characters|Invalid connection string|Cannot parse|URI cannot contain|Unsupported option/i.test(
          topMessage
        )))
  ) {
    return {
      category: 'Invalid MongoDB URI',
      summary:
        topCode === 'MISSING_MONGODB_URI'
          ? 'MONGODB_URI is not configured in server/.env.'
          : topCode === 'DATABASE_MISMATCH'
            ? `Connection refused because MONGODB_URI does not target "${EXPECTED_DB_NAME}".`
            : 'The MONGODB_URI connection string is malformed or contains invalid/unescaped characters.',
      troubleshooting: [
        'Set MONGODB_URI in server/.env (no surrounding spaces or invalid characters).',
        `Ensure the URI starts with "mongodb+srv://" or "mongodb://" and targets "/${EXPECTED_DB_NAME}".`,
        'If your password contains special characters (@, :, /, ?, #, %), URL-encode them.',
      ],
    };
  }

  // 2. Authentication failure
  if (
    allErrors.some(
      (e) =>
        e.code === 18 ||
        e.code === 8000 ||
        e.codeName === 'AuthenticationFailed' ||
        /bad auth|Authentication failed|auth failed|SCRAM|unable to authenticate|AuthenticationFailed/i.test(
          e.message || ''
        )
    )
  ) {
    return {
      category: 'Authentication failure',
      summary: 'MongoDB rejected the database username, password, or authSource credentials.',
      troubleshooting: [
        'Verify the database username and password in MongoDB Atlas (Database Access) or your MongoDB server.',
        'URL-encode special characters in the password inside server/.env MONGODB_URI.',
        `Confirm the database user has readWrite permissions on "${EXPECTED_DB_NAME}".`,
      ],
    };
  }

  // 3. DNS resolution failure
  if (
    isTxtRecordParseError ||
    allErrors.some(
      (e) =>
        ['querySrv', 'queryTxt', 'getaddrinfo'].includes(e.syscall) ||
        DNS_FAILURE_CODES.has(e.code) ||
        ((e.code === 'ECONNREFUSED' || e.code === 'ETIMEOUT') &&
          /querySrv|queryTxt|resolveSrv|resolveTxt/i.test(e.message || '')) ||
        /querySrv|queryTxt|getaddrinfo|ENOTFOUND|EAI_AGAIN|ESERVFAIL|No addresses found at host/i.test(
          e.message || ''
        )
    )
  ) {
    return {
      category: 'DNS resolution failure',
      summary:
        'Could not resolve the MongoDB cluster SRV/TXT or host DNS records (even after public DNS fallback).',
      troubleshooting: [
        'Verify your machine has active internet access and DNS resolution works.',
        'Check that the cluster hostname in MONGODB_URI matches your MongoDB Atlas connection string.',
        'If a router, VPN, or corporate firewall blocks SRV DNS queries, check DNS settings or try Atlas standard connection string.',
      ],
    };
  }

  // 4. IP address not whitelisted (Atlas TLS/network rejection or Mongoose Atlas whitelist error)
  const atlasTarget = isAtlasConnection(err, uri);
  const hasConnectionRefused = allErrors.some(
    (e) => e.code === 'ECONNREFUSED' || /ECONNREFUSED/i.test(e.message || '')
  );
  const serverMap = err?.reason?.servers || err?.cause?.servers;
  const serverEntries =
    serverMap && typeof serverMap.values === 'function' ? Array.from(serverMap.values()) : [];
  const allAtlasServersUnknown =
    serverEntries.length > 0 && serverEntries.every((desc) => desc?.type === 'Unknown');

  if (
    atlasTarget &&
    !hasConnectionRefused &&
    (/whitelisted|whitelist/i.test(topMessage) ||
      allAtlasServersUnknown ||
      allErrors.some((e) =>
        /Client network socket disconnected before secure TLS connection was established|tlsv1 alert|ECONNRESET|ETIMEDOUT|MongoNetworkTimeoutError/i.test(
          e.message || ''
        )
      ))
  ) {
    return {
      category: 'IP address not whitelisted',
      summary:
        'MongoDB Atlas dropped or timed out the connection before handshake — typically because your current IP is not whitelisted.',
      troubleshooting: [
        'Open MongoDB Atlas -> Security -> Network Access and add your current public IP address (or 0.0.0.0/0 for dev).',
        'Wait 1-2 minutes for Atlas Network Access rules to propagate, then retry.',
        'Verify outbound TCP port 27017 is not blocked by a firewall/VPN and that the cluster is not paused.',
      ],
    };
  }

  // 5. Cluster unavailable
  return {
    category: 'Cluster unavailable',
    summary:
      'Could not reach an available primary node on the MongoDB cluster or local MongoDB service.',
    troubleshooting: [
      'If using MongoDB Atlas, verify the cluster is active (not paused, upgrading, or deleted) in MongoDB Cloud Console.',
      'If using local MongoDB, verify the MongoDB service is running (e.g. "net start MongoDB") on the configured port.',
      'Check network connectivity, firewall rules, and replica set health.',
    ],
  };
};

const connectWithOptions = async (uri, options) => {
  const conn = await mongoose.connect(uri, options);
  if (conn.connection.name !== EXPECTED_DB_NAME) {
    const actualName = conn.connection.name;
    await mongoose.disconnect().catch(() => {});
    throw createCodedError(
      `Connected to unexpected database "${actualName}". Expected "${EXPECTED_DB_NAME}".`,
      'DATABASE_MISMATCH'
    );
  }
  return conn;
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    if (mongoose.connection.name !== EXPECTED_DB_NAME) {
      throw createCodedError(
        `Active MongoDB connection targets "${mongoose.connection.name}" instead of "${EXPECTED_DB_NAME}".`,
        'DATABASE_MISMATCH'
      );
    }
    return mongoose.connection;
  }

  let uriMeta;
  try {
    uriMeta = validateMongoUri(config.mongoUri);
  } catch (validationErr) {
    const diagnosis = classifyMongoError(validationErr, config.mongoUri);
    validationErr.mongoFailureCategory = diagnosis.category;
    if (validationErr.code === 'MISSING_MONGODB_URI') {
      console.error(`
================================================================================
CRITICAL CONFIGURATION ERROR [${diagnosis.category}]: MONGODB_URI is not set.
Please configure MONGODB_URI in your server/.env file.
Example for MongoDB Atlas:
  MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/${EXPECTED_DB_NAME}?retryWrites=true&w=majority
Example for Local MongoDB:
  MONGODB_URI=mongodb://localhost:27017/${EXPECTED_DB_NAME}
================================================================================`);
    } else {
      console.error(`
================================================================================
MONGODB CONNECTION FAILURE [${diagnosis.category}]:
Target URI: "${sanitizeUri(config.mongoUri)}"
Reason: ${diagnosis.summary}
Details: ${sanitizeLogText(validationErr.message)}

RECOMMENDED ACTIONS:
${diagnosis.troubleshooting.map((step, i) => `${i + 1}. ${step}`).join('\n')}
================================================================================`);
    }
    throw validationErr;
  }

  if (!uriMeta.hasDbInUri) {
    console.warn(
      `[MongoDB] MONGODB_URI did not include a database path; explicitly pinning database to "${EXPECTED_DB_NAME}".`
    );
  }

  const connectOptions = {
    dbName: EXPECTED_DB_NAME,
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 15000,
  };

  try {
    const conn = await connectWithOptions(config.mongoUri, connectOptions);
    console.log(
      `[MongoDB] Connected successfully to host: ${conn.connection.host} / database: ${conn.connection.name}`
    );
    return conn;
  } catch (err) {
    // If local system/router DNS fails to resolve Atlas SRV/TXT records on Windows, fallback to public DNS
    const currentServers = dns.getServers();
    const alreadyUsingPublicDns =
      PUBLIC_DNS_SERVERS.every((ip) => currentServers.includes(ip)) &&
      currentServers.length === PUBLIC_DNS_SERVERS.length;

    if (uriMeta.isSrv && isSrvDnsError(err) && !alreadyUsingPublicDns) {
      console.warn(
        '[MongoDB] Local DNS failed SRV resolution. Applying public DNS fallback (8.8.8.8, 1.1.1.1)...'
      );
      try {
        dns.setServers(PUBLIC_DNS_SERVERS);
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect().catch(() => {});
        }
        const conn = await connectWithOptions(config.mongoUri, connectOptions);
        console.log(
          `[MongoDB] Connected successfully via fallback DNS to host: ${conn.connection.host} / database: ${conn.connection.name}`
        );
        return conn;
      } catch (retryErr) {
        err = retryErr;
      }
    }

    const diagnosis = classifyMongoError(err, config.mongoUri);
    err.mongoFailureCategory = diagnosis.category;
    const safeDetails = sanitizeLogText(err.message);
    if (err.message && err.message !== safeDetails) {
      err.message = safeDetails;
    }

    console.error(`
================================================================================
MONGODB CONNECTION FAILURE [${diagnosis.category}]:
Could not connect to MongoDB at "${sanitizeUri(config.mongoUri)}".
Target DB: "${EXPECTED_DB_NAME}"
Reason: ${diagnosis.summary}
Details: ${safeDetails}

RECOMMENDED ACTIONS:
${diagnosis.troubleshooting.map((step, i) => `${i + 1}. ${step}`).join('\n')}
================================================================================`);
    throw err;
  }
};

const getDBStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return {
    status: states[state] || 'unknown',
    isConnected: state === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

module.exports = {
  connectDB,
  getDBStatus,
  sanitizeUri,
  sanitizeLogText,
  validateMongoUri,
  classifyMongoError,
  EXPECTED_DB_NAME,
};
