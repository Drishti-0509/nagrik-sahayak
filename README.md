# Nagrik Sahayak (नागरिक सहायक)
### AI-Powered Public Grievance Redressal System

Nagrik Sahayak connects citizens with municipal and state government departments through an accountable, transparent digital grievance redressal ecosystem. Powered by a robust MERN architecture with Google Gemini AI classification (and resilient deterministic NLP fallback), the platform enforces statutory SLA deadlines, maintains tamper-evident audit trails, and provides a full bilingual interface in English and Hindi (हिंदी).

---

## 🏛️ System Features & Highlights

1. **AI-Assisted Civic Triage**:
   - Automated categorization into municipal sectors (*Water Supply, Electricity, Roads, Sanitation, Health, Education, Public Safety, Transport, etc.*).
   - Dynamic priority suggestion (*Low, Medium, High, Urgent*) based on hazard and public safety risk.
   - Ground-truth executive summary and recommended officer next action.
   - **Zero-Downtime Deterministic Fallback**: If Gemini API key is unconfigured or external service is rate-limited, an honest rule-based heuristic classifier transparently categorizes complaints without crashing.

2. **End-to-End Grievance Lifecycle**:
   - Unique tracking reference generator (e.g., `NS-2026-10492`).
   - Legally enforced Service Level Agreements (SLA) with live countdowns and overdue breach flags.
   - Full timeline history recording actor, action, timestamps, and notes.
   - Citizen follow-up comments and internal department officer remarks.
   - Citizen right to **Reopen** within 7 days if resolution is unsatisfactory, triggering administrative audit.
   - Statutory **Escalation** flags on breached or delayed complaints.

3. **Role-Based Access Control (RBAC)**:
   - **Citizen**: Submit complaints, view only their own records (HTTP 403 on tampering), monitor timeline, receive notifications, reopen/escalate.
   - **Department Officer**: Inspect departmental queues, prioritize urgent cases, update statuses (*In Progress, Resolved, Rejected*), record resolution certificates.
   - **Administrator**: Master dashboard, department workload charts, officer assignment, user activation/deactivation, statutory SLA settings, compliance audit logs.

4. **100% Bilingual Interface (English & हिंदी)**:
   - Genuine language switcher in header.
   - Complete translations for navigation, form controls, statuses, priorities, charts, notifications, and error states.
   - Preserves original citizen description in submitted language without corruption.

---

## 🛠️ Technology Stack

- **Backend**: Node.js & Express.js (REST API under `/api/v1`)
- **Database**: MongoDB with Mongoose ODM
- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Lucide Icons
- **Authentication**: JWT authentication with bcrypt password hashing & HTTP-only cookies
- **AI Integration**: Google Gemini API via `@google/generative-ai` with deterministic NLP fallback
- **Security**: Helmet HTTP headers, CORS credentials support, express-rate-limit, centralized error handling

---

## 🚀 Quick Start Guide (Windows)

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24)
- **MongoDB**: MongoDB Atlas connection URI or local MongoDB instance

### 2. Environment Configuration

#### Backend Configuration:
Copy `server/.env.example` to `server/.env`:
```bash
# In server directory:
copy .env.example .env
```
Edit `server/.env` with your values:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/nagrik_sahayak # or your MongoDB Atlas URI
JWT_SECRET=your_secure_32_character_jwt_secret_key
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=your_gemini_api_key_here # Optional: if empty, deterministic fallback activates
GEMINI_MODEL=gemini-2.5-flash
```

#### Frontend Configuration:
Create `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

### 3. Running the Project

#### Step A: Install Dependencies
From the root directory:
```bash
# Install root, backend, and frontend dependencies
npm run install:all
```
*(Or individually: `cd server && npm install`, `cd client && npm install`)*

#### Step B: Seed Demo Departments & Sample Data (Optional)
```bash
node server/src/scripts/seedData.js
```
*Seeds standard civic departments (Water, Electricity, Roads, Sanitation, etc.) and demo accounts.*

#### Step C: Start Backend Server
```bash
npm run dev:server
```
*API will run at: `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)*

#### Step D: Start Frontend Dev Server
In a separate terminal:
```bash
npm run dev:client
```
*Frontend will open at: `http://localhost:5173`*

---

### 🐳 Alternative: Running with Docker Compose

To launch the full production-ready stack (MongoDB + Express/ML backend + Nginx frontend) in isolated containers:
```bash
docker compose up --build
```
- Frontend: `http://localhost` (Port 80)
- Backend API: `http://localhost:5000` (Port 5000)
- Health check: `http://localhost:5000/api/health`

---

## 🔑 Demo & Test Credentials (LOCAL DEVELOPMENT ONLY)

> [!IMPORTANT]
> The credentials below are strictly for local offline evaluation, automated testing, and development environments seeded via `seedData.js`. Never use these credentials in staging or production deployments.

If `seedData.js` has been executed, you can immediately log in with one click using the demo credentials button on the login screen or manually:

| Role | Email Address | Password |
|---|---|---|
| **System Administrator** | `admin@nagriksahayak.gov.in` | `AdminSecurePassword123!` |
| **Water Department Officer** | `officer.water@nagriksahayak.gov.in` | `OfficerSecurePassword123!` |
| **Registered Citizen** | `citizen.demo@example.com` | `CitizenPassword123!` |

---

## 🛡️ Safe Administrator Initialization Script

To create or promote an administrator without hardcoding credentials:
```bash
node server/src/scripts/initAdmin.js --name="Super Admin" --email="admin@nagriksahayak.gov.in" --password="YourSecurePassword123!"
```

---

## 🧪 Running Automated Tests

Practical backend unit and integration tests run with an isolated in-memory MongoDB runner:
```bash
npm run test:server
```
Verifies:
- Citizen registration & duplicate email handling
- Mass-assignment protection (admin privilege injection blocked)
- Citizen complaint ownership protection (HTTP 403 on accessing other records)
- Unique `NS-YYYY-XXXXX` tracking ID generation & SLA calculation
- Gemini AI fallback & bilingual classification heuristics
- System health and database reporting

To run frontend production build validation:
```bash
npm run build:client
```

---

## 📡 Key API Endpoints (`/api/v1`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | System status, database state, uptime |
| `POST` | `/api/v1/auth/register` | Public | Citizen registration (locked to citizen role) |
| `POST` | `/api/v1/auth/login` | Public | Authentication & JWT token issuance |
| `GET` | `/api/v1/auth/me` | Protected | Current user profile |
| `POST` | `/api/v1/ai/analyze` | Protected | AI grievance categorization & triage |
| `POST` | `/api/v1/complaints` | Citizen | Submit a new grievance |
| `POST` | `/api/v1/complaints/check-duplicates` | Protected | AI duplicate check (SentenceTransformers + FAISS) |
| `POST` | `/api/v1/complaints/predict-sla` | Protected | Machine learning SLA resolution duration prediction |
| `GET` | `/api/v1/complaints/sla-metrics` | Protected | Authentic ML evaluation metrics (MAE, RMSE, R2) |
| `GET` | `/api/v1/complaints/my` | Citizen | List signed-in citizen's complaints |
| `GET` | `/api/v1/complaints/assigned`| Officer/Admin | Assigned complaints queue |
| `GET` | `/api/v1/complaints/:id` | Owner/Officer | Complaint details & timeline history |
| `PUT` | `/api/v1/complaints/:id/status`| Officer/Admin | Update status & resolution certificate |
| `PUT` | `/api/v1/complaints/:id/assign`| Admin/Officer | Reassign officer/department |
| `POST` | `/api/v1/complaints/:id/comments`| Protected | Post remark or follow-up note |
| `PUT` | `/api/v1/complaints/:id/escalate`| Protected | Escalate grievance to senior admin |
| `GET` | `/api/v1/departments` | Public | Public municipal departments directory |
| `GET` | `/api/v1/analytics/citizen` | Citizen | Citizen dashboard metrics |
| `GET` | `/api/v1/analytics/officer` | Officer | Department officer workload metrics |
| `GET` | `/api/v1/analytics/admin` | Admin | System-wide statistics & audit logs |

---

## 📄 License & Citizen Rights
Developed under the Citizen Charter and Right to Public Service (RTS) framework for transparent civic governance.
