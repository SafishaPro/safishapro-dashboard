import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role =
  | "System Administrator"
  | "Operations Manager"
  | "Dispatcher"
  | "Customer Support Officer"
  | "Finance Officer"
  | "Reporting Analyst"
  | "Cleaner"
  | "Customer";

export const ALL_ROLES: Role[] = [
  "System Administrator",
  "Operations Manager",
  "Dispatcher",
  "Customer Support Officer",
  "Finance Officer",
  "Reporting Analyst",
  "Cleaner",
  "Customer",
];

export interface User {
  name: string;
  email: string;
  role: Role;
  avatar?: string;
}

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => void;
  logout: () => void;
  setRole: (role: Role) => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const KEY = "safisha_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const persist = (u: User | null) => {
    setUser(u);
    if (typeof window !== "undefined") {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        login: (email) =>
          persist({
            name: email.split("@")[0] || "Admin User",
            email,
            role: "System Administrator",
          }),
        logout: () => persist(null),
        setRole: (role) => user && persist({ ...user, role }),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
