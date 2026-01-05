import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Task, CreateTaskData, TaskStatus, TaskPriority, TaskModuleType, TaskModalContext } from '@/types/task';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { SubtasksSection, SubtaskItem } from './SubtasksSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['high', 'medium', 'low']),
  due_date: z.string().min(1, 'Due date is required'),
  due_time: z.string().optional(),
  assigned_to: z.string().optional(),
  module_type: z.enum(['accounts', 'contacts', 'leads', 'meetings', 'deals']).optional(),
  account_id: z.string().optional(),
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
  meeting_id: z.string().optional(),
  deal_id: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (data: CreateTaskData) => Promise<any>;
  onUpdate?: (taskId: string, data: Partial<Task>, originalTask?: Task) => Promise<boolean>;
  context?: TaskModalContext;
}

export const TaskModal = ({
  open,
  onOpenChange,
  task,
  onSubmit,
  onUpdate,
  context,
}: TaskModalProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [accounts, setAccounts] = useState<{ id: string; company_name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; contact_name: string; account_id: string | null; account_name?: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; lead_name: string; account_id: string | null; account_name?: string }[]>([]);
  const [meetings, setMeetings] = useState<{ id: string; subject: string; start_time: string }[]>([]);
  const [deals, setDeals] = useState<{ id: string; deal_name: string; stage: string }[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  
  const [selectedContact, setSelectedContact] = useState<typeof contacts[0] | null>(null);
  const [selectedLead, setSelectedLead] = useState<typeof leads[0] | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<typeof deals[0] | null>(null);

  // Fetch current user's display name
  useEffect(() => {
    const fetchCurrentUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.full_name && !data.full_name.includes('@')) {
        setCurrentUserName(data.full_name);
      } else {
        // Fallback to first part of email
        setCurrentUserName(user.email?.split('@')[0] || 'Current User');
      }
    };
    fetchCurrentUserName();
  }, [user?.id, user?.email]);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      due_date: '',
      due_time: '',
      assigned_to: '',
      module_type: undefined,
      account_id: '',
      contact_id: '',
      lead_id: '',
      meeting_id: '',
      deal_id: '',
    },
  });

  const selectedModule = form.watch('module_type');

  useEffect(() => {
    if (open) {
      fetchDropdownData();
      setActiveTab('details');
      if (task) {
        form.reset({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          due_date: task.due_date || '',
          due_time: task.due_time || '',
          assigned_to: task.assigned_to || '',
          module_type: task.module_type || undefined,
          account_id: task.account_id || '',
          contact_id: task.contact_id || '',
          lead_id: task.lead_id || '',
          meeting_id: task.meeting_id || '',
          deal_id: task.deal_id || '',
        });
        fetchSubtasks(task.id);
      } else {
        form.reset({
          title: '',
          description: '',
          status: 'open',
          priority: 'medium',
          due_date: '',
          due_time: '',
          assigned_to: '',
          module_type: context?.module || undefined,
          account_id: context?.module === 'accounts' ? context?.recordId : '',
          contact_id: context?.module === 'contacts' ? context?.recordId : '',
          lead_id: context?.module === 'leads' ? context?.recordId : '',
          meeting_id: context?.module === 'meetings' ? context?.recordId : '',
          deal_id: context?.module === 'deals' ? context?.recordId : '',
        });
        setSubtasks([]);
      }
    }
  }, [open, task, form, context]);

  const fetchSubtasks = async (taskId: string) => {
    const { data, error } = await supabase
      .from('task_subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('order_index', { ascending: true });

    if (!error && data) {
      setSubtasks(data.map(s => ({
        id: s.id,
        title: s.title,
        is_completed: s.is_completed,
        order_index: s.order_index,
      })));
    }
  };

  const fetchDropdownData = async () => {
    const [usersRes, accountsRes, contactsRes, leadsRes, meetingsRes, dealsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name'),
      supabase.from('accounts').select('id, company_name').order('company_name'),
      supabase.from('contacts').select('id, contact_name, account_id, accounts:account_id (company_name)').order('contact_name'),
      supabase.from('leads').select('id, lead_name, account_id, accounts:account_id (company_name)').order('lead_name'),
      supabase.from('meetings').select('id, subject, start_time').order('start_time', { ascending: false }).limit(100),
      supabase.from('deals').select('id, deal_name, stage').order('deal_name'),
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (accountsRes.data) setAccounts(accountsRes.data);
    if (contactsRes.data) {
      setContacts(contactsRes.data.map((c: any) => ({
        id: c.id,
        contact_name: c.contact_name,
        account_id: c.account_id,
        account_name: c.accounts?.company_name
      })));
    }
    if (leadsRes.data) {
      setLeads(leadsRes.data.map((l: any) => ({
        id: l.id,
        lead_name: l.lead_name,
        account_id: l.account_id,
        account_name: l.accounts?.company_name
      })));
    }
    if (meetingsRes.data) setMeetings(meetingsRes.data);
    if (dealsRes.data) setDeals(dealsRes.data);
  };

  const handleModuleChange = (value: TaskModuleType) => {
    form.setValue('module_type', value);
    // Clear all module-specific fields
    form.setValue('account_id', '');
    form.setValue('contact_id', '');
    form.setValue('lead_id', '');
    form.setValue('meeting_id', '');
    form.setValue('deal_id', '');
    setSelectedContact(null);
    setSelectedLead(null);
    setSelectedDeal(null);
  };

  const handleContactChange = (contactId: string) => {
    form.setValue('contact_id', contactId);
    const contact = contacts.find(c => c.id === contactId);
    setSelectedContact(contact || null);
  };

  const handleLeadChange = (leadId: string) => {
    form.setValue('lead_id', leadId);
    const lead = leads.find(l => l.id === leadId);
    setSelectedLead(lead || null);
  };

  const handleDealChange = (dealId: string) => {
    form.setValue('deal_id', dealId);
    const deal = deals.find(d => d.id === dealId);
    setSelectedDeal(deal || null);
  };

  const saveSubtasks = async (taskId: string) => {
    // Get existing subtasks
    const { data: existingSubtasks } = await supabase
      .from('task_subtasks')
      .select('id')
      .eq('task_id', taskId);

    const existingIds = new Set((existingSubtasks || []).map(s => s.id));
    const currentIds = new Set(subtasks.filter(s => !s.id.startsWith('temp-')).map(s => s.id));

    // Delete removed subtasks
    const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));
    if (idsToDelete.length > 0) {
      await supabase.from('task_subtasks').delete().in('id', idsToDelete);
    }

    // Upsert subtasks
    for (const subtask of subtasks) {
      if (subtask.id.startsWith('temp-')) {
        // Insert new subtask
        await supabase.from('task_subtasks').insert({
          task_id: taskId,
          title: subtask.title,
          is_completed: subtask.is_completed,
          order_index: subtask.order_index,
        });
      } else {
        // Update existing subtask
        await supabase.from('task_subtasks').update({
          title: subtask.title,
          is_completed: subtask.is_completed,
          order_index: subtask.order_index,
        }).eq('id', subtask.id);
      }
    }
  };

  const handleSubmit = async (data: TaskFormData) => {
    setLoading(true);
    try {
      const taskData: CreateTaskData & { due_time?: string } = {
        title: data.title,
        description: data.description || undefined,
        status: data.status as TaskStatus,
        priority: data.priority as TaskPriority,
        due_date: data.due_date,
        due_time: data.due_time || undefined,
        assigned_to: data.assigned_to || undefined,
        module_type: data.module_type as TaskModuleType | undefined,
        account_id: data.account_id || undefined,
        contact_id: data.contact_id || undefined,
        lead_id: data.lead_id || undefined,
        meeting_id: data.meeting_id || undefined,
        deal_id: data.deal_id || undefined,
      };

      if (task && onUpdate) {
        await onUpdate(task.id, taskData, task);
        await saveSubtasks(task.id);
      } else {
        const result = await onSubmit(taskData);
        if (result?.id) {
          await saveSubtasks(result.id);
        }
      }
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const isModuleLocked = context?.locked && context?.module;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="subtasks">
                  Subtasks {subtasks.length > 0 && `(${subtasks.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                {/* Module and Module-Specific Field in Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Module Selector */}
                  <FormField
                    control={form.control}
                    name="module_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Module</FormLabel>
                        <Select 
                          onValueChange={handleModuleChange} 
                          value={field.value || ''}
                          disabled={!!isModuleLocked}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select module" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="accounts">Accounts</SelectItem>
                            <SelectItem value="contacts">Contacts</SelectItem>
                            <SelectItem value="leads">Leads</SelectItem>
                            <SelectItem value="meetings">Meetings</SelectItem>
                            <SelectItem value="deals">Deals</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  {/* Dynamic Module-Specific Fields */}
                  {selectedModule === 'accounts' && (
                    <FormField
                      control={form.control}
                      name="account_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ''}
                            disabled={!!isModuleLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {accounts.map(account => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.company_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedModule === 'contacts' && (
                    <FormField
                      control={form.control}
                      name="contact_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact</FormLabel>
                          <Select 
                            onValueChange={handleContactChange} 
                            value={field.value || ''}
                            disabled={!!isModuleLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contact" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {contacts.map(contact => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.contact_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedModule === 'leads' && (
                    <FormField
                      control={form.control}
                      name="lead_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lead</FormLabel>
                          <Select 
                            onValueChange={handleLeadChange} 
                            value={field.value || ''}
                            disabled={!!isModuleLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select lead" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {leads.map(lead => (
                                <SelectItem key={lead.id} value={lead.id}>
                                  {lead.lead_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedModule === 'meetings' && (
                    <FormField
                      control={form.control}
                      name="meeting_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meeting</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || ''}
                            disabled={!!isModuleLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select meeting" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {meetings.map(meeting => (
                                <SelectItem key={meeting.id} value={meeting.id}>
                                  {meeting.subject} - {format(new Date(meeting.start_time), 'dd/MM/yyyy HH:mm')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {selectedModule === 'deals' && (
                    <FormField
                      control={form.control}
                      name="deal_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deal</FormLabel>
                          <Select 
                            onValueChange={handleDealChange} 
                            value={field.value || ''}
                            disabled={!!isModuleLocked}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select deal" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {deals.map(deal => (
                                <SelectItem key={deal.id} value={deal.id}>
                                  {deal.deal_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Empty placeholder when no module selected */}
                  {!selectedModule && <div />}
                </div>

                {/* Task Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter task title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Assigned To and Due Date in Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select 
                          onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} 
                          value={field.value || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {users.map(u => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.full_name || 'Unknown'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Due Time */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="due_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div />
                </div>

                {/* Status & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Enter task description" rows={3} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {/* Created By (read-only) */}
                {user && (
                  <FormItem>
                    <FormLabel>Created By</FormLabel>
                    <Input value={currentUserName || 'Current User'} disabled className="bg-muted" />
                  </FormItem>
                )}
              </TabsContent>

              <TabsContent value="subtasks" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Break down this task into smaller subtasks. Drag to reorder.
                  </p>
                  <SubtasksSection
                    subtasks={subtasks}
                    onChange={setSubtasks}
                    disabled={loading}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {task ? 'Update Task' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
