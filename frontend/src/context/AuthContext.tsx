import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../services/api";

const savedToken = localStorage.getItem("tam_token");
if (savedToken) {
  api.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
}

export type UserRole = "admin" | "manager" | "tam" | "viewer";

interface AuthState {
  token: string | null;
  username: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isManagerOrAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  username: null,
  role: "tam",
  isAuthenticated: false,
  isAdmin: false,
  isManager: false,
  isManagerOrAdmin: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(savedToken);
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem("tam_user"));
  const [role, setRole] = useState<UserRole>(() => (localStorage.getItem("tam_role") as UserRole) || "tam");

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
          localStorage.removeItem("tam_role");
        }
        return Promise.reject(err);
      },
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [token]);

  const login = async (user: string, pass: string) => {
    const { data } = await api.post("/auth/login", { username: user, password: pass });
    const userRole = (data.role || "tam") as UserRole;
    setToken(data.access_token);
    setUsername(data.username);
    setRole(userRole);
    localStorage.setItem("tam_token", data.access_token);
    localStorage.setItem("tam_user", data.username);
    localStorage.setItem("tam_role", userRole);
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setRole("tam");
    localStorage.removeItem("tam_token");
    localStorage.removeItem("tam_user");
    localStorage.removeItem("tam_role");
    delete api.defaults.headers.common["Authorization"];
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isManagerOrAdmin = role === "admin" || role === "manager";

  return (
    <AuthContext.Provider value={{ token, username, role, isAuthenticated: !!token, isAdmin, isManager, isManagerOrAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
