import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Task, TaskModuleType, CreateTaskData } from '@/types/task';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, ListTodo, AlertCircle } from 'lucide-react';
import { TaskModal } from '@/components/tasks/TaskModal';
import { useTasks } from '@/hooks/useTasks';
import { getTaskStatusColor, getTaskPriorityColor, getTaskStatusLabel } from '@/utils/statusBadgeUtils';

interface RelatedTasksSectionProps {
  moduleType: TaskModuleType;
  recordId: string;
  recordName?: string;
}

export const RelatedTasksSection = ({
  moduleType,
  recordId,
  recordName,
}: RelatedTasksSectionProps) => {
  const { user } = useAuth();
  const { createTask, updateTask } = useTasks();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchRelatedTasks = async () => {
    try {
      setLoading(true);
      
      // Build the query based on module type
      let query = supabase.from('tasks').select('*');
      
      switch (moduleType) {
        case 'accounts':
          query = query.eq('account_id', recordId);
          break;
        case 'contacts':
          query = query.eq('contact_id', recordId);
          break;
        case 'leads':
          query = query.eq('lead_id', recordId);
          break;
        case 'meetings':
          query = query.eq('meeting_id', recordId);
          break;
        case 'deals':
          query = query.eq('deal_id', recordId);
          break;
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching related tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recordId) {
      fetchRelatedTasks();
    }
  }, [recordId, moduleType]);

  const handleToggleComplete = async (task: Task) => {
    const newStatus = task.status === 'completed' ? 'open' : 'completed';
    await updateTask(task.id, { status: newStatus }, task);
    fetchRelatedTasks();
  };

  const handleTaskSubmit = async (data: CreateTaskData) => {
    // Pre-fill the module-specific ID
    const taskData: CreateTaskData = {
      ...data,
      module_type: moduleType,
    };
    
    switch (moduleType) {
      case 'accounts':
        taskData.account_id = recordId;
        break;
      case 'contacts':
        taskData.contact_id = recordId;
        break;
      case 'leads':
        taskData.lead_id = recordId;
        break;
      case 'meetings':
        taskData.meeting_id = recordId;
        break;
      case 'deals':
        taskData.deal_id = recordId;
        break;
    }
    
    const result = await createTask(taskData);
    if (result) {
      setShowTaskModal(false);
      fetchRelatedTasks();
    }
    return result;
  };

  const getDueDateInfo = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'completed' || status === 'cancelled') return { isOverdue: false };
    const date = new Date(dueDate);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { isOverdue: date < today };
  };

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-4">
            <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Tasks ({tasks.length})
            </CardTitle>
            <Button size="sm" onClick={() => setShowTaskModal(true)} className="gap-1">
              <Plus className="h-3 w-3" />
              Add Task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No tasks yet</p>
              <p className="text-xs mt-1">Add a task to track work for this {moduleType.slice(0, -1)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Open Tasks */}
              {openTasks.length > 0 && (
                <div className="space-y-2">
                  {openTasks.map((task) => {
                    const dueDateInfo = getDueDateInfo(task.due_date, task.status);
                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer ${
                          dueDateInfo.isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''
                        }`}
                        onClick={() => {
                          setEditingTask(task);
                          setShowTaskModal(true);
                        }}
                      >
                        <Checkbox
                          checked={task.status === 'completed'}
                          onCheckedChange={() => handleToggleComplete(task)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${getTaskStatusColor(task.status)}`}>
                              {getTaskStatusLabel(task.status)}
                            </Badge>
                            <Badge variant="outline" className={`text-xs capitalize ${getTaskPriorityColor(task.priority)}`}>
                              {task.priority}
                            </Badge>
                            {task.due_date && (
                              <span className={`text-xs flex items-center gap-1 ${dueDateInfo.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {dueDateInfo.isOverdue && <AlertCircle className="h-3 w-3" />}
                                {format(new Date(task.due_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed Tasks (collapsed by default) */}
              {completedTasks.length > 0 && (
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground py-2">
                    {completedTasks.length} completed task{completedTasks.length === 1 ? '' : 's'}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer opacity-60"
                        onClick={() => {
                          setEditingTask(task);
                          setShowTaskModal(true);
                        }}
                      >
                        <Checkbox
                          checked={true}
                          onCheckedChange={() => handleToggleComplete(task)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-through text-muted-foreground truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${getTaskStatusColor(task.status)}`}>
                              {getTaskStatusLabel(task.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskModal
        open={showTaskModal}
        onOpenChange={(open) => {
          setShowTaskModal(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        onSubmit={handleTaskSubmit}
        onUpdate={async (taskId, data, original) => {
          const result = await updateTask(taskId, data, original);
          if (result) {
            setShowTaskModal(false);
            setEditingTask(null);
            fetchRelatedTasks();
          }
          return result;
        }}
        context={{ module: moduleType, recordId, recordName, locked: true }}
      />
    </>
  );
};
