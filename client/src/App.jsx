import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import About from './pages/About';
import Departments from './pages/Departments';
import Login from './pages/Login';
import Register from './pages/Register';

// Citizen Pages
import CitizenDashboard from './pages/CitizenDashboard';
import SubmitComplaint from './pages/SubmitComplaint';
import MyComplaints from './pages/MyComplaints';
import ComplaintDetail from './pages/ComplaintDetail';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';

// Officer Pages
import OfficerDashboard from './pages/OfficerDashboard';
import AssignedComplaints from './pages/AssignedComplaints';
import OfficerComplaintDetail from './pages/OfficerComplaintDetail';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import AdminComplaints from './pages/AdminComplaints';
import AdminUsers from './pages/AdminUsers';
import AdminDepartments from './pages/AdminDepartments';
import AdminReports from './pages/AdminReports';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/login" element={<Login initialRole="citizen" />} />
          <Route path="/login/citizen" element={<Login initialRole="citizen" />} />
          <Route path="/login/officer" element={<Login initialRole="officer" />} />
          <Route path="/officer/login" element={<Login initialRole="officer" />} />
          <Route path="/login/admin" element={<Login initialRole="admin" />} />
          <Route path="/admin/login" element={<Login initialRole="admin" />} />
          <Route path="/register" element={<Register />} />

          {/* Citizen Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <CitizenDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/submit"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <SubmitComplaint />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/my"
            element={
              <ProtectedRoute allowedRoles={['citizen']}>
                <MyComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/complaints/:id"
            element={
              <ProtectedRoute allowedRoles={['citizen', 'officer', 'admin']}>
                <ComplaintDetail />
              </ProtectedRoute>
            }
          />

          {/* Shared Authenticated Routes */}
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Officer Protected Routes */}
          <Route
            path="/officer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <OfficerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/assigned"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AssignedComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/complaints"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AssignedComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/officer/complaints/:id"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <OfficerComplaintDetail />
              </ProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminComplaints />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/departments"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDepartments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReports />
              </ProtectedRoute>
            }
          />

          {/* Catch-all 404 */}
          <Route
            path="*"
            element={
              <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
                <h1 className="text-4xl font-extrabold text-navy-950">404</h1>
                <p className="text-sm text-slate-600">The civic page you requested does not exist.</p>
                <a
                  href="/"
                  className="px-4 py-2 rounded-lg bg-navy-800 text-white font-semibold text-xs"
                >
                  Return to Home
                </a>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
