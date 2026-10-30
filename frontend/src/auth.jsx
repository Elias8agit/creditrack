import { createContext, useContext, useMemo, useState } from 'react';
import { getSession, setSession as saveSession } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession());

  // useMemo evita crear un objeto nuevo en cada render y re-renderizar a todos los consumidores
  const value = useMemo(() => ({
    session,
    user: session?.usuario,
    login: (s) => { saveSession(s); setSession(s); },
    logout: () => { saveSession(null); setSession(null); },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
