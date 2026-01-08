import { useState, useEffect, useMemo } from 'react';
import { format, startOfDay, addDays, isBefore, formatDistanceToNow } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar, 
  ListTodo, 
  AlertTriangle,
  Building2,
  User,
  Target,
  Briefcase,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { Task, TaskStatus } from '@/types/task';
import { useNavigate } from 'react-router-dom';
import { TaskDetailModal } from '@/components/tasks/TaskDetailModal';
import { cn } from '@/lib/utils';

const POPUP_STORAGE_KEY = 'daily-tasks-popup-last-shown';

interface DailyTasksPopupProps {
  onViewTask?: (task: Task) => void;
}

type SortOption = 'priority' | 'time' | 'module';

const priorityOrder = { high: 0, medium: 1, low: 2 };
const priorityColors = {
  high: 'border-l-destructive',
  medium: 'border-l-warning',
  low: 'border-l-emerald-500'
};
const priorityDotColors = {
  high: 'bg-destructive',
  medium: 'bg-warning',
  low: 'bg-emerald-500'
};

const moduleIcons: Record<string, React.ReactNode> = {
  accounts: <Building2 className="h-3 w-3" />,
  contacts: <User className="h-3 w-3" />,
  leads: <Target className="h-3 w-3" />,
  deals: <Briefcase className="h-3 w-3" />,
  meetings: <Calendar className="h-3 w-3" />,
};

export const DailyTasksPopup = ({ onViewTask }: DailyTasksPopupProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showOverdue, setShowOverdue] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Check if popup should be shown today
  useEffect(() => {
    if (!user?.id) return;

    const lastShown = localStorage.getItem(POPUP_STORAGE_KEY);
    const todayKey = startOfDay(new Date()).toISOString();

    if (lastShown !== todayKey) {
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Fetch today's tasks with related entity names
  const { data: todaysTasks = [], isLoading } = useQuery({
    queryKey: ['todays-tasks', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id(lead_name, company_name),
          contacts:contact_id(contact_name, company_name),
          deals:deal_id(deal_name, customer_name),
          accounts:account_id(company_name),
          meetings:meeting_id(subject)
        `)
        .eq('assigned_to', user.id)
        .eq('due_date', today)
        .order('due_time', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching today\'s tasks:', error);
        return [];
      }

      return (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name,
        lead_account_name: task.leads?.company_name,
        contact_name: task.contacts?.contact_name,
        contact_account_name: task.contacts?.company_name,
        deal_name: task.deals?.deal_name,
        account_name: task.accounts?.company_name,
        meeting_subject: task.meetings?.subject,
      })) as Task[];
    },
    enabled: !!user?.id && open,
    staleTime: 60000,
  });

  // Fetch overdue tasks
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['overdue-tasks', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          leads:lead_id(lead_name, company_name),
          contacts:contact_id(contact_name, company_name),
          deals:deal_id(deal_name, customer_name),
          accounts:account_id(company_name),
          meetings:meeting_id(subject)
        `)
        .eq('assigned_to', user.id)
        .lt('due_date', today)
        .in('status', ['open', 'in_progress'])
        .order('due_date', { ascending: true });

      if (error) {
        console.error('Error fetching overdue tasks:', error);
        return [];
      }

      return (data || []).map(task => ({
        ...task,
        lead_name: task.leads?.lead_name,
        lead_account_name: task.leads?.company_name,
        contact_name: task.contacts?.contact_name,
        contact_account_name: task.contacts?.company_name,
        deal_name: task.deals?.deal_name,
        account_name: task.accounts?.company_name,
        meeting_subject: task.meetings?.subject,
      })) as Task[];
    },
    enabled: !!user?.id && open,
    staleTime: 60000,
  });

  // Toggle task completion
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, currentStatus }: { taskId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'completed' ? 'open' : 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus as TaskStatus, 
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null 
        })
        .eq('id', taskId);

      if (error) throw error;
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-tasks'] });
      toast.success(newStatus === 'completed' ? 'Task completed!' : 'Task reopened');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  // Snooze task to tomorrow
  const snoozeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('tasks')
        .update({ due_date: tomorrow })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task snoozed to tomorrow');
    },
    onError: () => {
      toast.error('Failed to snooze task');
    },
  });

  // Sort and filter tasks
  const sortedTodayTasks = useMemo(() => {
    let tasks = [...todaysTasks];

    if (!showCompleted) {
      tasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    }

    tasks.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                 (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        case 'time':
          if (!a.due_time && !b.due_time) return 0;
          if (!a.due_time) return 1;
          if (!b.due_time) return -1;
          return a.due_time.localeCompare(b.due_time);
        case 'module':
          return (a.module_type || '').localeCompare(b.module_type || '');
        default:
          return 0;
      }
    });

    return tasks;
  }, [todaysTasks, sortBy, showCompleted]);

  // Calculate progress
  const completedToday = todaysTasks.filter(t => t.status === 'completed').length;
  const totalToday = todaysTasks.length;
  const progressPercent = totalToday > 0 ? (completedToday / totalToday) * 100 : 0;

  // Handle closing and remember that we showed it today
  const handleClose = () => {
    const todayKey = startOfDay(new Date()).toISOString();
    localStorage.setItem(POPUP_STORAGE_KEY, todayKey);
    setOpen(false);
  };

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time || time === '00:00:00') return null;
    try {
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return null;
    }
  };

  // Get relative time for upcoming tasks
  const getRelativeTime = (dueDate: string, dueTime: string | null) => {
    try {
      const date = new Date(dueDate);
      if (dueTime && dueTime !== '00:00:00') {
        const [hours, minutes] = dueTime.split(':');
        date.setHours(parseInt(hours), parseInt(minutes));
      }
      
      if (isBefore(date, new Date())) return null;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return null;
    }
  };

  // Get linked entity info
  const getLinkedEntity = (task: Task) => {
    if (task.account_id && task.account_name) {
      return { type: 'accounts', name: task.account_name, icon: moduleIcons.accounts };
    }
    if (task.contact_id && task.contact_name) {
      return { type: 'contacts', name: task.contact_name, icon: moduleIcons.contacts };
    }
    if (task.lead_id && task.lead_name) {
      return { type: 'leads', name: task.lead_name, icon: moduleIcons.leads };
    }
    if (task.deal_id && task.deal_name) {
      return { type: 'deals', name: task.deal_name, icon: moduleIcons.deals };
    }
    if (task.meeting_id && task.meeting_subject) {
      return { type: 'meetings', name: task.meeting_subject, icon: moduleIcons.meetings };
    }
    return null;
  };

  // Handle task click to open detail modal
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  // Handle edit from detail modal
  const handleEditTask = (task: Task) => {
    setIsDetailModalOpen(false);
    handleClose();
    onViewTask?.(task);
  };

  // Compact Task Card Component
  const TaskCard = ({ task, isOverdue = false }: { task: Task; isOverdue?: boolean }) => {
    const linkedEntity = getLinkedEntity(task);
    const formattedTime = formatTime(task.due_time);
    const relativeTime = !isOverdue ? getRelativeTime(task.due_date || '', task.due_time) : null;
    const isCompleted = task.status === 'completed';
    const priority = task.priority as keyof typeof priorityColors;

    return (
      <div
        className={cn(
          "group relative flex items-center gap-2 p-2 rounded-md border-l-2 transition-all cursor-pointer",
          isOverdue ? "border-l-destructive bg-destructive/5" : priorityColors[priority] || 'border-l-border',
          isCompleted && "opacity-60",
          "hover:bg-accent/50"
        )}
        onClick={() => handleTaskClick(task)}
      >
        {/* Priority Dot */}
        <div className={cn(
          "w-2 h-2 rounded-full flex-shrink-0",
          isOverdue ? "bg-destructive" : priorityDotColors[priority] || 'bg-muted'
        )} />

        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleTaskMutation.mutate({ taskId: task.id, currentStatus: task.status });
          }}
          className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
          disabled={toggleTaskMutation.isPending}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-sm font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
            
            {formattedTime && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                <Clock className="h-2.5 w-2.5 mr-0.5" />
                {formattedTime}
              </Badge>
            )}
          </div>
          
          {linkedEntity && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-muted-foreground">{linkedEntity.icon}</span>
              <span className="text-xs text-muted-foreground truncate">{linkedEntity.name}</span>
            </div>
          )}
        </div>

        {/* Quick Actions - visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  snoozeMutation.mutate(task.id);
                }}
                disabled={snoozeMutation.isPending}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snooze to tomorrow</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTaskClick(task);
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>View details</TooltipContent>
          </Tooltip>
        </div>

        {/* Relative time on right */}
        {relativeTime && !isCompleted && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0 group-hover:hidden">
            {relativeTime}
          </span>
        )}

        {isOverdue && (
          <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 flex-shrink-0 group-hover:hidden">
            {format(new Date(task.due_date!), 'MMM d')}
          </Badge>
        )}
      </div>
    );
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg p-0 gap-0">
          {/* Header */}
          <DialogHeader className="p-4 pb-3 border-b">
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

          {/* Progress Bar */}
          {totalToday > 0 && (
            <div className="px-4 py-2 border-b bg-muted/30">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{completedToday} of {totalToday} completed</span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel className="text-xs">Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSortBy('priority')}>Priority</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('time')}>Due Time</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy('module')}>Module</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showCompleted ? 'Hide' : 'Show'} done
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="max-h-[50vh]">
            <div className="p-3 space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  {/* Overdue Section */}
                  {overdueTasks.length > 0 && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowOverdue(!showOverdue)}
                        className="flex items-center gap-2 text-sm font-medium text-destructive w-full"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        <span>Overdue ({overdueTasks.length})</span>
                        {showOverdue ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                      </button>
                      
                      {showOverdue && (
                        <div className="space-y-1.5">
                          {overdueTasks.map(task => (
                            <TaskCard key={task.id} task={task} isOverdue />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Today's Tasks */}
                  {sortedTodayTasks.length > 0 ? (
                    <div className="space-y-2">
                      {overdueTasks.length > 0 && (
                        <div className="text-sm font-medium text-muted-foreground pt-1">
                          Due Today ({sortedTodayTasks.length})
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {sortedTodayTasks.map(task => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  ) : overdueTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3 opacity-70" />
                      <p className="font-medium text-foreground">All caught up!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        No tasks due today
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-between items-center p-3 border-t bg-muted/20">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Dismiss
            </Button>
            <Button 
              size="sm" 
              onClick={() => {
                handleClose();
                navigate('/tasks');
              }}
            >
              View All Tasks
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          open={isDetailModalOpen}
          onOpenChange={(open) => {
            setIsDetailModalOpen(open);
            if (!open) setSelectedTask(null);
          }}
          task={selectedTask}
          onEdit={handleEditTask}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['todays-tasks'] });
            queryClient.invalidateQueries({ queryKey: ['overdue-tasks'] });
          }}
        />
      )}
    </>
  );
};
