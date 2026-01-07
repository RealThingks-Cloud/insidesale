import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  user_id: string;
  lead_id: string | null;
  message: string;
  status: 'read' | 'unread';
  notification_type: string;
  action_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useNotifications = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const itemsPerPage = 50;

  // Fetch notifications with React Query
  const { data: notificationsData, isLoading: loading } = useQuery({
    queryKey: ['notifications', user?.id, currentPage],
    queryFn: async () => {
      if (!user) return { notifications: [], total: 0, unreadCount: 0 };

      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;

      // Get paginated notifications
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;

      // Get total unread count separately
      const { data: unreadData, error: unreadError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'unread');
      
      if (unreadError) throw unreadError;

      const typedNotifications: Notification[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'read' | 'unread'
      }));

      return {
        notifications: typedNotifications,
        total: count || 0,
        unreadCount: unreadData?.length || 0
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const notifications = notificationsData?.notifications || [];
  const totalNotifications = notificationsData?.total || 0;
  const unreadCount = notificationsData?.unreadCount || 0;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
    },
    onError: (error) => {
      console.error('Error marking notification as read:', error);
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('user_id', user.id)
        .eq('status', 'unread');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    },
    onError: (error) => {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive"
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      toast({
        title: "Success",
        description: "Notification deleted"
      });
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive"
      });
    },
  });

  // Wrapper functions to maintain API compatibility
  const markAsRead = useCallback(async (notificationId: string) => {
    await markAsReadMutation.mutateAsync(notificationId);
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await deleteNotificationMutation.mutateAsync(notificationId);
  }, [deleteNotificationMutation]);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    setCurrentPage(page);
  }, []);

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });

          // Show toast notification for new action item notifications
          const newNotification = payload.new as Notification;
          if (newNotification.notification_type === 'action_item') {
            toast({
              title: "New Action Item Notification",
              description: newNotification.message,
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, toast]);

  return {
    notifications,
    unreadCount,
    loading,
    currentPage,
    totalNotifications,
    itemsPerPage,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    setCurrentPage
  };
};
