import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Task, CreateTaskData, TaskStatus } from '@/types/task';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useTasks = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tasks with React Query caching
  const { data: tasks = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id (lead_name, account_id, accounts:account_id (company_name)),
          contacts:contact_id (contact_name, account_id, accounts:account_id (company_name)),
          deals:deal_id (deal_name, stage),
          accounts:account_id (company_name),
          meetings:meeting_id (subject, start_time)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData = (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name || null,
        contact_name: task.contacts?.contact_name || null,
        deal_name: task.deals?.deal_name || null,
        deal_stage: task.deals?.stage || null,
        account_name: task.accounts?.company_name || null,
        meeting_subject: task.meetings?.subject || null,
        contact_account_name: task.contacts?.accounts?.company_name || null,
        lead_account_name: task.leads?.accounts?.company_name || null,
      })) as Task[];

      return transformedData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: CreateTaskData) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Sanitize special placeholder values that could break DB insert
      const sanitizedData = {
        ...taskData,
        assigned_to: taskData.assigned_to && taskData.assigned_to !== 'unassigned' ? taskData.assigned_to : null,
        due_time: (taskData as any).due_time && (taskData as any).due_time !== 'none' ? (taskData as any).due_time : null,
        created_by: user.id,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(sanitizedData)
        .select()
        .single();

      if (error) throw error;

      // Create notification for assigned user if different from creator
      if (taskData.assigned_to && taskData.assigned_to !== user.id) {
        await supabase.from('notifications').insert({
          user_id: taskData.assigned_to,
          message: `You have been assigned a new task: ${taskData.title}`,
          notification_type: 'task_assigned',
        });
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task created successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error creating task:', error);
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates, originalTask }: { taskId: string; updates: Partial<Task>; originalTask?: Task }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const updateData: any = { ...updates };
      
      // If status is changing to completed, set completed_at
      if (updates.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status) {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      // Create notifications for changes
      if (originalTask) {
        // Notify on reassignment
        if (updates.assigned_to && updates.assigned_to !== originalTask.assigned_to && updates.assigned_to !== user.id) {
          await supabase.from('notifications').insert({
            user_id: updates.assigned_to,
            message: `You have been assigned a task: ${originalTask.title}`,
            notification_type: 'task_assigned',
          });
        }

        // Notify on completion (notify creator)
        if (updates.status === 'completed' && originalTask.created_by && originalTask.created_by !== user.id) {
          await supabase.from('notifications').insert({
            user_id: originalTask.created_by,
            message: `Task completed: ${originalTask.title}`,
            notification_type: 'task_completed',
          });
        }

        // Notify assigned user on due date change
        if (updates.due_date && updates.due_date !== originalTask.due_date && originalTask.assigned_to && originalTask.assigned_to !== user.id) {
          await supabase.from('notifications').insert({
            user_id: originalTask.assigned_to,
            message: `Due date changed for task: ${originalTask.title}`,
            notification_type: 'task_updated',
          });
        }
      }

      return { taskId, updates };
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error updating task:', error);
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return taskId;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Task deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] });
    },
    onError: (error: any) => {
      console.error('Error deleting task:', error);
      toast({ title: "Error", description: error.message || "Failed to delete task", variant: "destructive" });
    },
  });

  // Wrapper functions to maintain API compatibility
  const createTask = async (taskData: CreateTaskData) => {
    try {
      const result = await createTaskMutation.mutateAsync(taskData);
      return result;
    } catch {
      return null;
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>, originalTask?: Task) => {
    try {
      await updateTaskMutation.mutateAsync({ taskId, updates, originalTask });
      return true;
    } catch {
      return false;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      return true;
    } catch {
      return false;
    }
  };

  const fetchTasks = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
};
