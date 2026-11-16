const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Complaint = require('../models/Complaint');

const DEFAULT_THRESHOLD = parseFloat(process.env.DUPLICATE_SIMILARITY_THRESHOLD) || 0.78;

// Locate Python executable from virtual environment or system
const resolvePythonExecutable = () => {
  const venvWindows = path.resolve(__dirname, '../../ml_env/Scripts/python.exe');
  const venvUnix = path.resolve(__dirname, '../../ml_env/bin/python');

  if (fs.existsSync(venvWindows)) return venvWindows;
  if (fs.existsSync(venvUnix)) return venvUnix;
  return process.platform === 'win32' ? 'python' : 'python3';
};

/**
 * Deterministic In-Memory Token Cosine / Jaccard Fallback
 * Used if Python environment is unavailable or times out
 */
const calculateTokenSimilarity = (textA, textB) => {
  if (!textA || !textB) return 0;
  const tokenize = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  // Use Dice coefficient for closer alignment to vector cosine similarity
  return (2 * intersection) / (tokensA.size + tokensB.size);
};

const runJsFallback = (queryText, candidates, threshold, limit) => {
  const matches = [];
  for (const c of candidates) {
    const sim = calculateTokenSimilarity(queryText, c.text);
    if (sim >= threshold) {
      matches.push({
        id: c.id,
        trackingId: c.trackingId,
        title: c.title,
        status: c.status,
        category: c.category,
        department: c.department,
        createdAt: c.createdAt,
        similarity: parseFloat(sim.toFixed(4)),
        method: 'token_jaccard_fallback',
      });
    }
  }

  matches.sort((a, b) => b.similarity - a.similarity);
  const duplicates = matches.slice(0, limit);
  const highest = duplicates.length > 0 ? duplicates[0].similarity : 0;

  return {
    isDuplicate: duplicates.length > 0,
    highestSimilarity: highest,
    threshold,
    duplicates,
    model: 'token_jaccard_fallback',
  };
};

/**
 * Run Python Sentence-Transformers + FAISS similarity detection
 */
const runPythonDetection = (payload, timeoutMs = 15000) => {
  return new Promise((resolve, reject) => {
    const pythonExe = resolvePythonExecutable();
    const scriptPath = path.resolve(__dirname, '../ml/duplicate_detector.py');

    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`ML script not found at ${scriptPath}`));
    }

    const pyProcess = spawn(pythonExe, [scriptPath], {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
        TRANSFORMERS_VERBOSITY: 'error',
      },
    });

    let stdoutData = '';
    let stderrData = '';
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        pyProcess.kill();
        reject(new Error(`Duplicate detector timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf-8');
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf-8');
    });

    pyProcess.on('error', (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    pyProcess.on('close', (code) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);

        if (code !== 0 && !stdoutData.trim()) {
          return reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
        }

        try {
          // Extract the JSON line from stdout
          const lines = stdoutData.trim().split('\n');
          let parsed = null;
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                parsed = JSON.parse(line);
                break;
              } catch (_) {
                // Continue scanning upward
              }
            }
          }

          if (parsed && typeof parsed === 'object') {
            resolve(parsed);
          } else {
            reject(new Error(`Invalid JSON output from duplicate_detector: ${stdoutData}`));
          }
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });

    // Write input payload to python stdin
    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
};

/**
 * Main Service: Check for duplicate / highly similar complaints
 *
 * @param {Object} params
 * @param {string} params.title - Complaint title
 * @param {string} params.description - Complaint description
 * @param {string} [params.category] - Optional category filter
 * @param {string} [params.departmentId] - Optional department ID
 * @param {string} [params.excludeComplaintId] - Exclude a specific complaint (avoid self-comparison)
 * @param {number} [params.threshold] - Cosine similarity threshold (default: DUPLICATE_SIMILARITY_THRESHOLD or 0.78)
 * @param {number} [params.limit] - Max candidate matches to return (default: 5)
 */
const checkDuplicateComplaints = async ({
  title,
  description,
  category,
  departmentId,
  excludeComplaintId = null,
  threshold = DEFAULT_THRESHOLD,
  limit = 5,
  forcePython = false,
}) => {
  if (!title || !description) {
    return {
      isDuplicate: false,
      highestSimilarity: 0,
      threshold,
      duplicates: [],
      model: 'none',
    };
  }

  // Construct query to retrieve candidates from MongoDB
  const query = {
    status: { $nin: ['Rejected', 'Closed'] }, // Only active / pending / under review / in progress
  };

  if (category) {
    query.category = category;
  }

  if (departmentId) {
    query.department = departmentId;
  }

  if (excludeComplaintId) {
    query._id = { $ne: excludeComplaintId };
  }

  // Retrieve candidate records strictly stripping any Citizen PII
  const candidateDocs = await Complaint.find(query)
    .select('_id trackingId title description category department status createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  if (!candidateDocs || candidateDocs.length === 0) {
    return {
      isDuplicate: false,
      highestSimilarity: 0,
      threshold,
      duplicates: [],
      model: 'all-MiniLM-L6-v2',
    };
  }

  // Format candidate data strictly without citizen PII
  const candidates = candidateDocs.map((doc) => ({
    id: doc._id.toString(),
    trackingId: doc.trackingId,
    title: doc.title,
    text: `${doc.title}. ${doc.description ? doc.description.substring(0, 300) : ''}`,
    category: doc.category,
    department: doc.department ? doc.department.toString() : '',
    status: doc.status,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : '',
  }));

  const payload = {
    query: {
      title: title.trim(),
      description: description.trim(),
    },
    candidates,
    threshold: Number(threshold) || DEFAULT_THRESHOLD,
    top_k: Number(limit) || 5,
  };

  const queryText = `${payload.query.title}. ${payload.query.description}`;

  // In test environment, use deterministic fast in-memory matcher unless forcePython is explicitly true
  if (process.env.NODE_ENV === 'test' && !forcePython) {
    return runJsFallback(queryText, candidates, payload.threshold, payload.top_k);
  }

  try {
    const mlResult = await runPythonDetection(payload);
    if (mlResult && mlResult.success) {
      return {
        isDuplicate: Boolean(mlResult.isDuplicate),
        highestSimilarity: Number(mlResult.highestSimilarity) || 0,
        threshold: payload.threshold,
        duplicates: Array.isArray(mlResult.duplicates) ? mlResult.duplicates : [],
        model: mlResult.model || 'all-MiniLM-L6-v2',
      };
    }
    // Fall back to JS token similarity if Python returned failure
    return runJsFallback(queryText, candidates, payload.threshold, payload.top_k);
  } catch (pyErr) {
    console.warn(`[DuplicateDetectionService] ML inference fallback: ${pyErr.message}`);
    return runJsFallback(queryText, candidates, payload.threshold, payload.top_k);
  }
};

module.exports = {
  checkDuplicateComplaints,
  calculateTokenSimilarity,
  DEFAULT_THRESHOLD,
};
