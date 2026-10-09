import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const AuthContext = createContext(null);
const EXTERNAL = ['Client', 'Contractor', 'Worker'];

export function AuthProvider({ children }) {
  const qc = useQueryClient();
  const [state, setState] = useState({ user: null, permissions: {}, loading: !!localStorage.getItem('token') });

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setState({ user: data.user, permissions: data.permissions, loading: false });
    } catch {
      localStorage.removeItem('token');
      setState({ user: null, permissions: {}, loading: false });
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('token')) loadMe();
    const onLogout = () => {
      setState({ user: null, permissions: {}, loading: false });
      qc.clear();
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [loadMe, qc]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setState({ user: null, permissions: {}, loading: false });
    qc.clear();
  }, [qc]);

  const value = useMemo(() => {
    const role = state.user?.role;
    const isAdmin = role === 'Super Admin' || role === 'Admin';
    const can = (module, action = 'view') => {
      if (!role) return false;
      if (isAdmin) return true;
      if (!module) return true;
      return (state.permissions[module]?.[action] || []).includes(role);
    };
    return { ...state, role, isAdmin, isExternal: EXTERNAL.includes(role), can, login, logout, reload: loadMe, setUser: (user) => setState((s) => ({ ...s, user })) };
  }, [state, login, logout, loadMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
