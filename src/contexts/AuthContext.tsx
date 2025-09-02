import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logActivity } from '@/utils/activityLogger';

interface User {
  id: string;
  username: string;
  role: string;
  sessionid?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const sessionId = localStorage.getItem('sessionId');
    const username = localStorage.getItem('username');
    
    if (sessionId && username) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('sessionid', sessionId)
        .single();
      
      if (data) {
        setUser(data);
      } else {
        localStorage.removeItem('sessionId');
        localStorage.removeItem('username');
      }
    }
    setLoading(false);
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (data) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        await supabase
          .from('users')
          .update({ sessionid: sessionId })
          .eq('id', data.id);

        localStorage.setItem('sessionId', sessionId);
        localStorage.setItem('username', username);
        
        const userData = { ...data, sessionid: sessionId };
        setUser(userData);

        // Log successful login
        await logActivity({
          username: userData.username,
          role: userData.role,
          action: 'login',
          description: `User ${userData.username} logged in successfully`,
          metadata: { sessionId }
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = async () => {
    if (user) {
      // Log logout before clearing user data
      await logActivity({
        username: user.username,
        role: user.role,
        action: 'logout',
        description: `User ${user.username} logged out`,
        metadata: { sessionId: user.sessionid }
      });
    }

    localStorage.removeItem('sessionId');
    localStorage.removeItem('username');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
