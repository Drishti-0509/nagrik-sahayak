# Nagrik Sahayak — Project Status & Verification Report

Last Verified: November 15, 2026
Version: 1.0.0 (Production Ready — All Approved Phases 1, 2, 3, 4A, 4B, 4C, 4D, 4E Complete)

## 1. Executive Summary
**Nagrik Sahayak (नागरिक सहायक)** is an enterprise-grade AI-powered citizen grievance redressal system built on a full-stack MERN architecture (Node.js, Express, MongoDB/Mongoose, React, Vite, Tailwind CSS) augmented with dedicated Machine Learning subsystems (SentenceTransformers, FAISS, scikit-learn Gradient Boosting regression). The platform provides transparent complaint tracking, legally enforced Service Level Agreements (SLA), role-based access control (Citizen, Department Officer, Administrator), tamper-evident audit logs, multi-channel notification delivery (In-App, Email via Nodemailer, SMS), full bilingual support in English and Hindi (हिंदी), and AI triage with deterministic zero-downtime fallbacks.

---

## 2. Actual Verification Results Across All Phases

| Check Item | Phase | Description | Result | Details |
|---|---|---|---|---|
| **1. Security & RBAC** | Phase 1 | Authentication, JWT, bcrypt, public registration locked to citizen, mass-assignment guards | **VERIFIED** | Tested via `security_phase1.test.js` & `auth.test.js`. 401/403 guards active. |
| **2. Complaint Lifecycle & SLA** | Phase 2 | Unique reference (`NS-YYYY-XXXXX`), SLA deadlines, status transitions, timeline tracking | **VERIFIED** | Tested via `complaint.test.js` & `phase2_stats_sla.test.js`. |
| **3. Officer Assignment & Claiming** | Phase 3 | Department unassigned pool, officer self-claiming, category-department routing patch | **VERIFIED** | Tested via `phase3_officer_claim.test.js` & `phase3_routing_patch.test.js`. |
| **4. Historical Evidence Fix** | Phase 4A | Resolution certificates & photo evidence preserved across all cycles (Reopened, In Progress) | **VERIFIED** | Tested via `phase4_evidence.test.js` & `phase4_frontend_evidence_logic.test.js`. |
| **5. AI Duplicate Complaint Detection** | Phase 4B | Sentence Transformers (`all-MiniLM-L6-v2`) + FAISS (`IndexFlatIP`) cosine similarity | **VERIFIED** | Tested via `phase4b_duplicate_detection.test.js`. Configurable threshold (0.78), advisory UI warning without auto-rejection. |
| **6. Intelligent SLA Prediction** | Phase 4C | scikit-learn GradientBoostingRegressor vs Dummy Mean baseline; authentic MAE & RMSE metrics | **VERIFIED** | Tested via `phase4c_sla_prediction.test.js`. GBR MAE: 3.32 hrs vs Baseline: 18.20 hrs (81.74% error reduction). Preserves statutory SLA. |
| **7. Multi-Channel Notifications** | Phase 4D | In-app alerts + Email (Nodemailer) + SMS provider interface with fault-tolerant failure isolation | **VERIFIED** | Tested via `phase4d_notifications.test.js`. External failures never compromise complaint workflow. |
| **8. Production Readiness & Build** | Phase 4E | Dockerfiles, Docker Compose, Helmet security headers, Nginx reverse proxy, health probes | **VERIFIED** | Frontend Vite production build succeeded in 6.83s. **115 / 115 tests passed across 16 Jest test suites**. |

---

## 3. Machine Learning Evaluation Metrics (Phase 4C)

Trained and evaluated on 1,000 realistic historical civic resolution records (800 train, 200 holdout test):

| Metric | DummyRegressor Baseline (Mean) | GradientBoostingRegressor ML Model | Authentic Improvement |
|---|---|---|---|
| **Mean Absolute Error (MAE)** | **18.20 hours** | **3.32 hours** | **81.74% error reduction** |
| **Root Mean Squared Error (RMSE)** | **23.37 hours** | **4.51 hours** | **80.68% error reduction** |
| **Coefficient of Determination ($R^2$)** | **-0.0050** | **0.9625** | **High predictive fidelity** |
| **Model Artifact** | N/A | `server/src/ml/models/sla_model.joblib` | Persisted pipeline |
| **Evaluation Metrics Artifact** | N/A | `server/src/ml/models/sla_metrics.json` | Authentic metrics |

> [!IMPORTANT]
> Statutory SLA deadlines (`slaDeadline`) remain strictly enforced based on citizen charter timelines (Urgent: 24h, High: 48h, Medium: 72h, Low: 120h). The ML prediction is purely advisory to provide officers and citizens with realistic completion projections.

---

## 4. Multi-Channel Notification Architecture (Phase 4D)

1. **In-App Notifications**: Stored in MongoDB `notifications` collection with deduplication `eventKey` to prevent notification spamming.
2. **Email Notifications**: Powered by `nodemailer` with standard responsive HTML civic templates containing grievance reference and direct action link.
3. **SMS Notifications**: Dispatched via pluggable SMS provider interface (Twilio SDK ready + default mock provider).
4. **Resilience & Fault Isolation**: External dispatch operations run asynchronously in background. Any network timeout, SMTP rejection, or invalid contact detail is caught gracefully without interrupting or rolling back complaint submission or state transitions.

---

## 5. Environment Variables Reference

### Backend (`server/.env`):
| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Optional | Port for the Express backend | `5000` |
| `NODE_ENV` | Optional | Runtime environment | `development` / `production` / `test` |
| `CLIENT_URL` | Optional | Allowed frontend origin for CORS | `http://localhost:5173` |
| `MONGODB_URI` | **Required** | MongoDB connection string (Atlas or Local) | `mongodb://localhost:27017/nagrik_sahayak` |
| `JWT_SECRET` | **Required** | Secret key for signing authentication tokens | 32+ character random string |
| `JWT_EXPIRES_IN` | Optional | Token expiration timeframe | `7d` |
| `GEMINI_API_KEY` | Optional | Google AI Studio Gemini API key | If omitted, deterministic rule-based fallback activates |
| `GEMINI_MODEL` | Optional | Gemini model name | `gemini-2.5-flash` |
| `SLA_URGENT_HOURS`| Optional | Default SLA hours for Urgent complaints | `24` |
| `SLA_HIGH_HOURS` | Optional | Default SLA hours for High complaints | `48` |
| `SLA_MEDIUM_HOURS`| Optional | Default SLA hours for Medium complaints | `72` |
| `SLA_LOW_HOURS` | Optional | Default SLA hours for Low complaints | `120` |
| `DUPLICATE_SIMILARITY_THRESHOLD` | Optional | Cosine similarity threshold for duplicate warnings | `0.78` |
| `EMAIL_NOTIFICATIONS_ENABLED` | Optional | Enable Nodemailer external emails | `false` |
| `SMTP_HOST` | Optional | SMTP mail host | `smtp.gmail.com` |
| `SMTP_PORT` | Optional | SMTP mail port | `587` |
| `SMTP_USER` | Optional | SMTP account username | `notifications@nagriksahayak.gov.in` |
| `SMTP_PASS` | Optional | SMTP account password / app token | `your_app_password` |
| `SMTP_SECURE` | Optional | Use TLS | `false` |
| `FROM_EMAIL` | Optional | Sender email string | `"Nagrik Sahayak" <no-reply@nagriksahayak.gov.in>` |
| `SMS_NOTIFICATIONS_ENABLED` | Optional | Enable external SMS dispatch | `false` |
| `SMS_PROVIDER` | Optional | SMS gateway provider (`mock`, `twilio`) | `mock` |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio Account SID | `your_twilio_sid` |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio Auth Token | `your_twilio_token` |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio sender phone number | `+1234567890` |

### Frontend (`client/.env`):
| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `VITE_API_URL` | Optional | Backend API base URL | `http://localhost:5000/api/v1` |

---

## 6. Docker Deployment Commands

To run the full stack via Docker Compose:

```bash
# 1. Start all containers (MongoDB, Backend with ML, Frontend with Nginx)
docker compose up -d --build

# 2. Check health status
docker compose ps

# 3. View backend logs
docker compose logs -f server
```

- Web Portal: `http://localhost` (Port 80 via Nginx)
- Backend API: `http://localhost:5000` (Direct) or `http://localhost/api/` (Proxied via Nginx)
- Health Check: `http://localhost/api/health`

---

## 7. Local Development & Verification Commands

```powershell
# Run full backend test suite (16 suites, 115 tests)
npm run test:server

# Build production frontend client
npm run build:client

# Seed initial departments and demo accounts
node server/src/scripts/seedData.js

# Train and evaluate SLA ML model
& server\ml_env\Scripts\python.exe server\src\ml\sla_predictor.py --train
```
