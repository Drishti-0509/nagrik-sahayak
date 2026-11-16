import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nagrik_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('nagrik_token') || null);
  const [loading, setLoading] = useState(true);

  // Verify auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('nagrik_token');
      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.data.success && res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('nagrik_user', JSON.stringify(res.data.user));
        } else {
          logout();
        }
      } catch (err) {
        console.warn('[AuthContext] Verification failed:', err.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password, requiredRole = null) => {
    const payload = { email, password };
    if (requiredRole) payload.requiredRole = requiredRole;
    const res = await api.post('/auth/login', payload);
    if (res.data.success) {
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('nagrik_token', newToken);
      localStorage.setItem('nagrik_user', JSON.stringify(newUser));
      return { success: true, user: newUser };
    }
    return { success: false, message: res.data.message };
  };

  const register = async (formData) => {
    const res = await api.post('/auth/register', formData);
    if (res.data.success) {
      const { token: newToken, user: newUser } = res.data;
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('nagrik_token', newToken);
      localStorage.setItem('nagrik_user', JSON.stringify(newUser));
      return { success: true, user: newUser };
    }
    return { success: false, message: res.data.message };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('nagrik_token');
      localStorage.removeItem('nagrik_user');
    }
  };

  const updateProfile = async (profileData) => {
    const res = await api.put('/auth/profile', profileData);
    if (res.data.success) {
      setUser(res.data.user);
      localStorage.setItem('nagrik_user', JSON.stringify(res.data.user));
      return { success: true, user: res.data.user };
    }
    return { success: false, message: res.data.message };
  };

  const userRole = user?.role ? String(user.role).toLowerCase().trim() : null;
  const isCitizen = userRole === 'citizen';
  const isOfficer = userRole === 'officer';
  const isAdmin = userRole === 'admin';

  const value = {
    user,
    token,
    loading,
    role: userRole,
    isAuthenticated: Boolean(user && token),
    isCitizen,
    isOfficer,
    isAdmin,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
