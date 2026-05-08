import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = async (username, password) => {
    try {
      const result = await window.api.login(username, password);
      if (result.success) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (e) {
      return { success: false, message: 'Login failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
