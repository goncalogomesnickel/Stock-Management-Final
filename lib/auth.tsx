'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { User, UserRole } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isAdmin: false,
  login: async () => ({ ok: false }),
  logout: async () => {},
});

async function fetchProfile(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) return null;

  return data as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user?.email) {
        const profile = await fetchProfile(session.user.email);

        if (profile) {
          setUser(profile);
        } else {
          await supabase.auth.signOut();
        }
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        (async () => {
          if (event === 'SIGNED_OUT') {
            setUser(null);
            return;
          }

          if (event === 'TOKEN_REFRESHED' && session?.user?.email) {
            const profile = await fetchProfile(session.user.email);
            setUser(profile);
          }
        })();
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    if (!data.session || !data.user.email) {
      return {
        ok: false,
        error: 'Não foi possível criar uma sessão.',
      };
    }

    const profile = await fetchProfile(data.user.email);

    if (!profile) {
      await supabase.auth.signOut();

      return {
        ok: false,
        error:
          'Utilizador não encontrado ou inactivo. Contacte o administrador.',
      };
    }

    setUser(profile);

    return {
      ok: true,
    };
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin: user?.role === 'admin',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireAuth(allowedRoles?: UserRole[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, loading, allowedRoles, router]);

  return { user, loading };
}
