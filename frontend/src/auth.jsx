import { createContext, useContext, useState } from 'react';
import { getSession, setSession } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setState] = useState(getSession());

  const login = (s) => {
    setSession(s);
    setState(s);
  };
  const logout = () => {
    setSession(null);
    setState(null);
  };

  return <AuthContext.Provider value={{ session, user: session?.usuario, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
