import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('erp_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [moduleAccess, setModuleAccess] = useState(() => {
    const raw = localStorage.getItem('erp_module_access');
    return raw ? JSON.parse(raw) : [];
  });

  function login({ token, user, moduleAccess }) {
    localStorage.setItem('erp_token', token);
    localStorage.setItem('erp_user', JSON.stringify(user));
    localStorage.setItem('erp_module_access', JSON.stringify(moduleAccess));
    setUser(user);
    setModuleAccess(moduleAccess);
  }

  function logout() {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_user');
    localStorage.removeItem('erp_module_access');
    setUser(null);
    setModuleAccess([]);
  }

  function hasModule(name) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return moduleAccess.some((m) => m.module === name);
  }

  return (
    <AuthContext.Provider value={{ user, moduleAccess, login, logout, hasModule }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
