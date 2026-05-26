import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'editor' | 'viewer' | 'nursing' | 'service_development' | 'program_administrator' | 'adon' | 'don' | 'him' | 'sdd' | 'human_resources';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isEditor: boolean;
  isNursing: boolean;
  isServiceDevelopment: boolean;
  isProgramAdministrator: boolean;
  isAdon: boolean;
  isDon: boolean;
  isHim: boolean;
  isSdd: boolean;
  isHumanResources: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('role')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.role as AppRole || 'viewer';
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id).then(setRole);
          }, 0);
        } else {
          setRole(null);
        }

        if (event === 'SIGNED_OUT') {
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id).then((r) => {
          setRole(r);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isNursing = role === 'nursing';
  const isServiceDevelopment = role === 'service_development';
  const isProgramAdministrator = role === 'program_administrator';
  const isAdon = role === 'adon';
  const isDon = role === 'don';
  const isHim = role === 'him';
  const isSdd = role === 'sdd';
  const isHumanResources = role === 'human_resources';
  const canEdit = isAdmin || isEditor || isNursing || isServiceDevelopment || isProgramAdministrator || isAdon || isDon || isHim || isSdd || isHumanResources;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isEditor,
        isNursing,
        isServiceDevelopment,
        isProgramAdministrator,
        isAdon,
        isDon,
        isHim,
        isSdd,
        isHumanResources,
        canEdit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
