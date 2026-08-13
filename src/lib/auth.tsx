import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, clearStoredSession, getStoredSession, type ApiUser, type Permission } from "./api";

export type User = ApiUser;

interface AuthCtx {
  user: User | null;
  permissions: Set<string>;
  isRestoring: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isRestoring, setIsRestoring] = useState(true);

  const applyAccess = (nextUser: User, nextPermissions: Permission[] = nextUser.permissions) => {
    setUser(nextUser);
    setPermissions(nextPermissions.filter((permission) => permission.is_active));
  };

  const refreshAccess = async () => {
    const [currentUser, access] = await Promise.all([authApi.me(), authApi.access()]);
    applyAccess({ ...currentUser, role: access.role, permissions: access.permissions }, access.permissions);
  };

  useEffect(() => {
    if (!getStoredSession()) { setIsRestoring(false); return; }
    refreshAccess().catch(() => { clearStoredSession(); setUser(null); setPermissions([]); }).finally(() => setIsRestoring(false));
    const onExpired = () => { setUser(null); setPermissions([]); setIsRestoring(false); };
    const onAccessChanged = () => { refreshAccess().catch(() => undefined); };
    window.addEventListener("safishapro:session-expired", onExpired);
    window.addEventListener("safishapro:access-changed", onAccessChanged);
    return () => { window.removeEventListener("safishapro:session-expired", onExpired); window.removeEventListener("safishapro:access-changed", onAccessChanged); };
  }, []);

  const permissionSlugs = useMemo(() => new Set(permissions.map((permission) => permission.slug)), [permissions]);

  return (
    <Ctx.Provider value={{
      user,
      permissions: permissionSlugs,
      isRestoring,
      login: async (identifier, password) => {
        const session = await authApi.login(identifier, password);
        if (!session.user.is_active || !session.permissions.some((permission) => permission.is_active)) {
          clearStoredSession();
          throw new Error("This account does not have access to the administrative portal.");
        }
        applyAccess(session.user, session.permissions);
        return session.user;
      },
      logout: async () => {
        const session = getStoredSession();
        try { if (session) await authApi.logout(session.refresh_token); } finally { clearStoredSession(); setUser(null); setPermissions([]); }
      },
      refreshAccess,
      can: (...required) => required.every((permission) => permissionSlugs.has(permission)),
    }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(Ctx);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
};
