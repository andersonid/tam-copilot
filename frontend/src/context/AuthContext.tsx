import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../services/api";

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  username: null,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("tam_token"));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("tam_user"));

  useEffect(() => {
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common["Authorization"];
    }
  }, [token]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401 && token) {
          setToken(null);
          setUsername(null);
          localStorage.removeItem("tam_token");
          localStorage.removeItem("tam_user");
        }
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [token]);

  const login = async (user: string, pass: string) => {
    const { data } = await api.post("/auth/login", { username: user, password: pass });
    setToken(data.access_token);
    setUsername(data.username);
    localStorage.setItem("tam_token", data.access_token);
    localStorage.setItem("tam_user", data.username);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("tam_token");
    localStorage.removeItem("tam_user");
    delete api.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
