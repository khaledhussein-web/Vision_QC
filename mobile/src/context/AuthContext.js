import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginApi, registerApi } from '../api/client';

const SESSION_STORAGE_KEY = 'visionqc_mobile_session_v1';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const hydrateSession = async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw || !active) return;
        const parsed = JSON.parse(raw);
        if (parsed?.token && parsed?.userId) {
          setSession(parsed);
        }
      } catch (_error) {
        // Ignore invalid storage payloads.
      } finally {
        if (active) setLoading(false);
      }
    };

    hydrateSession();
    return () => {
      active = false;
    };
  }, []);

  const persistSession = async (rawSession) => {
    const nextSession = {
      token: String(rawSession?.token || '').trim(),
      userId: Number(rawSession?.user_id || rawSession?.userId || 0),
      role: String(rawSession?.role || 'user').toLowerCase(),
      email: String(rawSession?.email || '').trim().toLowerCase()
    };

    if (!nextSession.token || !nextSession.userId) {
      throw new Error('Invalid session payload');
    }

    setSession(nextSession);
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    return nextSession;
  };

  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    return persistSession({
      token: data?.token,
      user_id: data?.user_id,
      role: data?.role,
      email
    });
  };

  const register = async ({ fullName, email, password, passwordConfirm }) => {
    const data = await registerApi({ fullName, email, password, passwordConfirm });
    return persistSession({
      token: data?.token,
      user_id: data?.user_id,
      role: data?.role || 'user',
      email
    });
  };

  const logout = async () => {
    setSession(null);
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      loading,
      session,
      isAuthenticated: Boolean(session?.token),
      login,
      register,
      logout
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
