const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const MODEL_PATH = path.resolve(__dirname, '../ml/models/sla_model.joblib');
const METRICS_PATH = path.resolve(__dirname, '../ml/models/sla_metrics.json');
const SCRIPT_PATH = path.resolve(__dirname, '../ml/sla_predictor.py');

// Department heuristics for fallback
const FALLBACK_BASE_HOURS = {
  'Water Supply': 28,
  'Electricity': 18,
  'Roads and Infrastructure': 72,
  'Sanitation and Waste Management': 20,
  'Public Health': 36,
  'Education': 50,
  'Public Safety': 22,
  'Transport': 40,
  'Other': 60,
};

const PRIORITY_MULTIPLIERS = {
  Urgent: 0.45,
  High: 0.75,
  Medium: 1.0,
  Low: 1.4,
};

// Locate Python executable from virtual environment or system
const resolvePythonExecutable = () => {
  const venvWindows = path.resolve(__dirname, '../../ml_env/Scripts/python.exe');
  const venvUnix = path.resolve(__dirname, '../../ml_env/bin/python');

  if (fs.existsSync(venvWindows)) return venvWindows;
  if (fs.existsSync(venvUnix)) return venvUnix;
  return process.platform === 'win32' ? 'python' : 'python3';
};

/**
 * Deterministic Fallback Predictor
 * Used when Python runner is not available
 */
const runFallbackPrediction = ({ category, priority }) => {
  const base = FALLBACK_BASE_HOURS[category] || 48;
  const mult = PRIORITY_MULTIPLIERS[priority] || 1.0;
  const hours = Math.round(base * mult * 10) / 10;
  const days = Math.round((hours / 24.0) * 10) / 10;

  return {
    predictedHours: hours,
    predictedDays: days,
    confidenceLevel: 'Medium',
    modelType: 'civic_heuristic_fallback',
    isAdvisoryOnly: true,
  };
};

/**
 * Run ML Inference via Python script
 */
const runPythonPrediction = (payload, timeoutMs = 8000) => {
  return new Promise((resolve, reject) => {
    const pythonExe = resolvePythonExecutable();

    if (!fs.existsSync(SCRIPT_PATH)) {
      return reject(new Error(`SLA predictor script not found at ${SCRIPT_PATH}`));
    }

    const pyProcess = spawn(pythonExe, [SCRIPT_PATH], {
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdoutData = '';
    let stderrData = '';
    let isSettled = false;

    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        pyProcess.kill();
        reject(new Error(`SLA predictor timed out after ${timeoutMs}ms`));
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
          return reject(new Error(`SLA predictor exited with code ${code}: ${stderrData}`));
        }

        try {
          const lines = stdoutData.trim().split('\n');
          let parsed = null;
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                parsed = JSON.parse(line);
                break;
              } catch (_) {}
            }
          }

          if (parsed && parsed.success) {
            resolve({
              predictedHours: Number(parsed.predictedHours),
              predictedDays: Number(parsed.predictedDays),
              confidenceLevel: parsed.confidenceLevel || 'High',
              modelType: parsed.modelType || 'GradientBoostingRegressor',
              isAdvisoryOnly: true,
            });
          } else {
            reject(new Error(`Invalid prediction output: ${stdoutData}`));
          }
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });

    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
};

/**
 * Predict Resolution Time for a Grievance
 * CRITICAL RULE: This result is purely advisory and MUST NEVER overwrite the statutory slaDeadline!
 *
 * @param {Object} params
 * @param {string} params.category - Complaint category
 * @param {string} [params.department] - Department name or code
 * @param {string} [params.priority] - Priority (Low, Medium, High, Urgent)
 * @param {string} [params.description] - Description text
 * @param {Object} [params.location] - Location object
 */
const predictResolutionTime = async ({
  category = 'Other',
  department = '',
  priority = 'Medium',
  description = '',
  location = {},
  forcePython = false,
}) => {
  const payload = {
    category,
    department: typeof department === 'string' ? department : '',
    priority,
    description_length: description ? description.length : 120,
    zone: location?.address?.toLowerCase().includes('north')
      ? 'North'
      : location?.address?.toLowerCase().includes('south')
      ? 'South'
      : location?.address?.toLowerCase().includes('west')
      ? 'West'
      : location?.address?.toLowerCase().includes('east')
      ? 'East'
      : 'Central',
  };

  // In test environment, use fast deterministic predictor unless forcePython is set
  if (process.env.NODE_ENV === 'test' && !forcePython) {
    return runFallbackPrediction({ category, priority });
  }

  try {
    return await runPythonPrediction(payload);
  } catch (err) {
    console.warn(`[SlaPredictionService] ML inference fallback: ${err.message}`);
    return runFallbackPrediction({ category, priority });
  }
};

/**
 * Retrieve authentic model evaluation metrics
 */
const getSlaMetrics = () => {
  try {
    if (fs.existsSync(METRICS_PATH)) {
      const raw = fs.readFileSync(METRICS_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[SlaPredictionService] Failed to read metrics file:', err.message);
  }
  return null;
};

module.exports = {
  predictResolutionTime,
  getSlaMetrics,
  runFallbackPrediction,
};
