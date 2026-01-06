import { useState, useEffect } from 'react';
import { format, isToday, startOfDay } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, Clock, AlertCircle, X, Calendar, ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskStatus } from '@/types/task';
import { getTaskPriorityColor, getTaskStatusColor } from '@/utils/statusBadgeUtils';

const POPUP_STORAGE_KEY = 'daily-tasks-popup-last-shown';

interface DailyTasksPopupProps {
  onViewTask?: (task: Task) => void;
}

export const DailyTasksPopup = ({ onViewTask }: DailyTasksPopupProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Check if popup should be shown today
  useEffect(() => {
    if (!user?.id) return;

    const lastShown = localStorage.getItem(POPUP_STORAGE_KEY);
    const today = startOfDay(new Date()).toISOString();

    if (lastShown !== today) {
      // Show popup after a short delay to let dashboard load
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Fetch today's tasks for the current user
  const { data: todaysTasks = [], isLoading } = useQuery({
    queryKey: ['todays-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('due_date', today)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('priority', { ascending: true })
        .order('due_time', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching today\'s tasks:', error);
        return [];
      }

      return (data || []) as Task[];
    },
    enabled: !!user?.id && open,
    staleTime: 60000,
  });

  // Mutation to mark task as complete
  const completeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: 'completed' as TaskStatus, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-tasks'] });
      toast.success('Task marked as complete!');
    },
    onError: () => {
      toast.error('Failed to complete task');
    },
  });

  // Handle closing and remember that we showed it today
  const handleClose = () => {
    const today = startOfDay(new Date()).toISOString();
    localStorage.setItem(POPUP_STORAGE_KEY, today);
    setOpen(false);
  };

  // Handle task click
  const handleTaskClick = (task: Task) => {
    handleClose();
    onViewTask?.(task);
  };

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <AlertCircle className="w-4 h-4 text-rose-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-slate-400" />;
    }
  };

  // Don't render if no tasks
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <ListTodo className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Today's Tasks</DialogTitle>
              <DialogDescription className="text-sm">
                {format(new Date(), 'EEEE, MMMM d, yyyy')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : todaysTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">
                You have no tasks due today.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">
                  {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''} due today
                </span>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="w-3 h-3 mr-1" />
                  Today
                </Badge>
              </div>

              <ScrollArea className="max-h-[300px] pr-3">
                <div className="space-y-2">
                  {todaysTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
                    >
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => completeMutation.mutate(task.id)}
                        className="mt-0.5"
                        disabled={completeMutation.isPending}
                      />
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleTaskClick(task)}
                          className="text-left w-full"
                        >
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {task.description}
                            </p>
                          )}
                        </button>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getTaskPriorityColor(task.priority)}`}
                          >
                            {task.priority}
                          </Badge>
                          {task.due_time && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {task.due_time}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getPriorityIcon(task.priority)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Dismiss
          </Button>
          <Button 
            size="sm" 
            onClick={() => {
              handleClose();
              window.location.href = '/tasks';
            }}
          >
            View All Tasks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
