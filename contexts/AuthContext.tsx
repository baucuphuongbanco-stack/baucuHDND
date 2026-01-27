
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

interface UserProfile {
  role: string;
  unitId?: string;
  areaId?: string;
  fullName?: string;
  neighborhoodId?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  signOut: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  signOut: () => { },
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 1. Lấy session hiện tại
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('Supabase auth session check failed (có thể do chưa cấu hình URL):', error.message);
          setSession(null);
          setUser(null);
          setIsLoading(false);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
            // fetchProfile sẽ set isLoading = false
          } else {
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Lỗi không mong muốn khi khởi tạo Auth:', err);
        setIsLoading(false);
      }
    };

    initializeAuth();

    // 2. Lắng nghe thay đổi auth (đăng nhập/đăng xuất)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsLoading(true);
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // Changed from single() to maybeSingle() to handle missing profiles gracefully

      if (!error && data) {
        setProfile({
          role: data.role,
          unitId: data.unit_id,
          areaId: data.area_id,
          fullName: data.full_name,
          neighborhoodId: data.neighborhood_id
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
