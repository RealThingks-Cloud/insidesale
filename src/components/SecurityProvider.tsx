import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';
import { supabase } from '@/integrations/supabase/client';

interface SecurityContextType {
  isSecurityEnabled: boolean;
  hasAdminAccess: boolean;
  userRole: string | null;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const useSecurityContext = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurityContext must be used within SecurityProvider');
  }
  return context;
};

interface SecurityProviderProps {
  children: React.ReactNode;
}

export const SecurityProvider = ({ children }: SecurityProviderProps) => {
  const { user } = useAuth();
  const { logSecurityEvent } = useSecurityAudit();
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Refs to prevent duplicate session logging
  const sessionLoggedRef = useRef<string | null>(null);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  const hasAdminAccess = userRole === 'admin';

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        // Check user metadata first for role
        const metadataRole = user.user_metadata?.role;
        if (metadataRole) {
          setUserRole(metadataRole);
          return;
        }

        // Fallback to database lookup
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user role:', error);
          setUserRole('user');
          return;
        }

        const role = data?.role || 'user';
        setUserRole(role);
      } catch (error) {
        console.error('Failed to fetch user role:', error);
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, [user]);

  // Debounced visibility change handler
  const handleVisibilityChange = useCallback(() => {
    if (!user) return;
    if (document.hidden) {
      logSecurityEvent('SESSION_INACTIVE', 'auth', user.id);
    } else {
      logSecurityEvent('SESSION_ACTIVE', 'auth', user.id);
    }
  }, [user, logSecurityEvent]);

  useEffect(() => {
    if (!user || !userRole) {
      // Clean up if user logs out
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
      sessionLoggedRef.current = null;
      return;
    }

    // Only log session start once per user session
    const sessionKey = `${user.id}-${userRole}`;
    if (sessionLoggedRef.current !== sessionKey) {
      sessionLoggedRef.current = sessionKey;
      logSecurityEvent('SESSION_START', 'auth', user.id, {
        login_time: new Date().toISOString(),
        user_agent: navigator.userAgent,
        role: userRole,
        user_email: user.email
      });
    }

    // Set up visibility handler only once
    if (!visibilityHandlerRef.current) {
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
    };
  }, [user, userRole, logSecurityEvent, handleVisibilityChange]);

  const value = {
    isSecurityEnabled: true,
    hasAdminAccess,
    userRole
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};
