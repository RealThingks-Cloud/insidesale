import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PagePermission {
  id: string;
  page_name: string;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
}

interface PermissionsContextType {
  userRole: string;
  isAdmin: boolean;
  isManager: boolean;
  permissions: PagePermission[];
  loading: boolean;
  hasPageAccess: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export const PermissionsProvider = ({ children }: PermissionsProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<string>('user');
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setUserRole('user');
      setPermissions([]);
      setLoading(false);
      setHasFetched(false);
      return;
    }

    // Skip if already fetched for this user
    if (hasFetched) {
      return;
    }

    try {
      setLoading(true);

      // Fetch role and permissions in parallel
      const [roleResult, permissionsResult] = await Promise.all([
        supabase.rpc('get_user_role', { p_user_id: user.id }),
        supabase.from('page_permissions').select('*')
      ]);

      // Handle role
      if (roleResult.error) {
        console.error('Error fetching user role:', roleResult.error);
        setUserRole('user');
      } else {
        setUserRole(roleResult.data || 'user');
      }

      // Handle permissions
      if (permissionsResult.error) {
        console.error('Error fetching permissions:', permissionsResult.error);
        setPermissions([]);
      } else {
        setPermissions(permissionsResult.data || []);
      }

      setHasFetched(true);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setUserRole('user');
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user, hasFetched]);

  // Fetch on user change
  useEffect(() => {
    if (authLoading) return;
    
    if (user) {
      fetchPermissions();
    } else {
      setUserRole('user');
      setPermissions([]);
      setLoading(false);
      setHasFetched(false);
    }
  }, [user, authLoading, fetchPermissions]);

  // Reset hasFetched when user changes
  useEffect(() => {
    setHasFetched(false);
  }, [user?.id]);

  const refreshPermissions = useCallback(async () => {
    setHasFetched(false);
    await fetchPermissions();
  }, [fetchPermissions]);

  const hasPageAccess = useCallback((route: string): boolean => {
    // Normalize route
    const normalizedRoute = route === '/' ? '/dashboard' : route.replace(/\/$/, '');
    
    // Find permission for this route
    const permission = permissions.find(p => p.route === normalizedRoute);
    
    // If no permission record exists, allow access by default
    if (!permission) {
      return true;
    }

    // Check access based on role
    switch (userRole) {
      case 'admin':
        return permission.admin_access;
      case 'manager':
        return permission.manager_access;
      case 'user':
      default:
        return permission.user_access;
    }
  }, [permissions, userRole]);

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  const value = useMemo(() => ({
    userRole,
    isAdmin,
    isManager,
    permissions,
    loading: loading || authLoading,
    hasPageAccess,
    refreshPermissions
  }), [userRole, isAdmin, isManager, permissions, loading, authLoading, hasPageAccess, refreshPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
