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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CalendarIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountModal } from '@/components/AccountModal';
import { ContactModal } from '@/components/ContactModal';
import { LeadModal } from '@/components/LeadModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Generate 30-minute time slots
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

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
  
  const [selectedContact, setSelectedContact] = useState<typeof contacts[0] | null>(null);
  const [selectedLead, setSelectedLead] = useState<typeof leads[0] | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<typeof deals[0] | null>(null);

  // Modal states for creating new entities
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  // Handlers for when new entities are created
  const handleAccountCreated = (newAccount: { id: string; company_name: string }) => {
    setAccounts(prev => [...prev, newAccount].sort((a, b) => a.company_name.localeCompare(b.company_name)));
    form.setValue('account_id', newAccount.id);
    setAccountModalOpen(false);
  };

  const handleContactCreated = () => {
    // Refresh contacts list
    fetchDropdownData();
    setContactModalOpen(false);
  };

  const handleLeadCreated = () => {
    // Refresh leads list
    fetchDropdownData();
    setLeadModalOpen(false);
  };

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
      }
    }
  }, [open, task, form, context]);

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
      } else {
        await onSubmit(taskData);
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
            {/* Module and Module-Specific Field in Grid */}
            <div className="grid grid-cols-2 gap-3">
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
                              <SelectValue placeholder="Select module..." />
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
                          <div className="flex gap-1">
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || ''}
                              disabled={!!isModuleLocked}
                            >
                              <FormControl>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select account..." />
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => setAccountModalOpen(true)}
                                    disabled={!!isModuleLocked}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add new account</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
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
                          <div className="flex gap-1">
                            <Select 
                              onValueChange={handleContactChange} 
                              value={field.value || ''}
                              disabled={!!isModuleLocked}
                            >
                              <FormControl>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select contact..." />
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => setContactModalOpen(true)}
                                    disabled={!!isModuleLocked}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add new contact</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
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
                          <div className="flex gap-1">
                            <Select 
                              onValueChange={handleLeadChange} 
                              value={field.value || ''}
                              disabled={!!isModuleLocked}
                            >
                              <FormControl>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select lead..." />
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
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0"
                                    onClick={() => setLeadModalOpen(true)}
                                    disabled={!!isModuleLocked}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add new lead</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
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
                        <Input placeholder="e.g., Follow up with client" {...field} />
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
                              <SelectValue placeholder="Select user..." />
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
                      <FormItem className="flex flex-col">
                        <FormLabel>Due Date & Time *</FormLabel>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "flex-1 pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(new Date(field.value), "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value ? new Date(field.value) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    field.onChange(format(date, 'yyyy-MM-dd'));
                                  }
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          
                          {/* Time Select with 30-min slots */}
                          <FormField
                            control={form.control}
                            name="due_time"
                            render={({ field: timeField }) => (
                              <Select onValueChange={timeField.onChange} value={timeField.value || ''}>
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue placeholder="Time" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIME_SLOTS.map((slot) => (
                                    <SelectItem key={slot} value={slot}>
                                      {slot}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                        <Textarea placeholder="Additional details about the task..." rows={3} {...field} />
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

      {/* Nested modals for creating new entities */}
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        onSuccess={() => {}}
        onCreated={handleAccountCreated}
      />
      <ContactModal
        open={contactModalOpen}
        onOpenChange={setContactModalOpen}
        onSuccess={handleContactCreated}
      />
      <LeadModal
        open={leadModalOpen}
        onOpenChange={setLeadModalOpen}
        onSuccess={handleLeadCreated}
      />
    </Dialog>
  );
};
