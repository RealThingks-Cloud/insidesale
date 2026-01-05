import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Building2,
  Briefcase,
  Video,
  ExternalLink,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserX,
  CalendarClock,
  Activity,
  ListTodo,
  Pencil,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { getMeetingStatus } from "@/utils/meetingStatus";
import { MeetingFollowUpsSection } from "./MeetingFollowUpsSection";
import { TaskModal } from "@/components/tasks/TaskModal";

interface Meeting {
  id: string;
  subject: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date?: string | null;
}

interface LinkedAccount {
  id: string;
  company_name: string;
}

interface LinkedDeal {
  id: string;
  deal_name: string;
  stage: string;
}

interface MeetingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  onEdit?: (meeting: Meeting) => void;
  onUpdate?: () => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  ongoing: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const outcomeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  successful: {
    label: "Successful",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  follow_up_needed: {
    label: "Follow-up Needed",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  },
  no_show: {
    label: "No-show",
    icon: <UserX className="h-3 w-3" />,
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  },
  rescheduled: {
    label: "Rescheduled",
    icon: <CalendarClock className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
};

export const MeetingDetailModal = ({ 
  open, 
  onOpenChange, 
  meeting, 
  onEdit,
  onUpdate 
}: MeetingDetailModalProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [linkedTasks, setLinkedTasks] = useState<LinkedTask[]>([]);
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
  const [linkedDeal, setLinkedDeal] = useState<LinkedDeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const userIds = [meeting?.created_by].filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    if (meeting && open) {
      fetchLinkedData();
    }
  }, [meeting?.id, open]);

  const fetchLinkedData = async () => {
    if (!meeting) return;
    setLoading(true);
    try {
      // Fetch linked tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: false });
      
      setLinkedTasks(tasksData || []);

      // Fetch linked account if exists
      if (meeting.account_id) {
        const { data: accountData } = await supabase
          .from('accounts')
          .select('id, company_name')
          .eq('id', meeting.account_id)
          .single();
        setLinkedAccount(accountData);
      } else {
        setLinkedAccount(null);
      }

      // Fetch linked deal if exists
      if (meeting.deal_id) {
        const { data: dealData } = await supabase
          .from('deals')
          .select('id, deal_name, stage')
          .eq('id', meeting.deal_id)
          .single();
        setLinkedDeal(dealData);
      } else {
        setLinkedDeal(null);
      }
    } catch (error) {
      console.error('Error fetching linked data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!meeting) return null;

  const effectiveStatus = getMeetingStatus(meeting);
  const attendeesList = meeting.attendees && Array.isArray(meeting.attendees) 
    ? (meeting.attendees as { email: string; name?: string }[])
    : [];

  const getStatusBadge = () => {
    const label = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);
    return (
      <Badge variant="outline" className={statusColors[effectiveStatus]}>
        {label}
      </Badge>
    );
  };

  const getOutcomeBadge = () => {
    if (!meeting.outcome) return null;
    const config = outcomeConfig[meeting.outcome];
    if (!config) return null;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
    medium: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    low: 'bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400',
  };

  const taskStatusColors: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    in_progress: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
    completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {meeting.subject}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                {getStatusBadge()}
                {getOutcomeBadge()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {meeting.join_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(meeting.join_url!, '_blank')}
                  className="gap-2"
                >
                  <Video className="h-4 w-4" />
                  Join
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTaskModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Task
              </Button>
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(meeting)}
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="related">Related</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Meeting Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(meeting.start_time), 'EEEE, dd MMM yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                    </span>
                  </div>
                  {meeting.description && (
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground mb-1">Description</p>
                      <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>
                    </div>
                  )}
                  {meeting.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Attendees</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {meeting.lead_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Lead: {meeting.lead_name}</span>
                    </div>
                  )}
                  {meeting.contact_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Contact: {meeting.contact_name}</span>
                    </div>
                  )}
                  {attendeesList.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-2">External Participants</p>
                      <div className="space-y-1">
                        {attendeesList.map((attendee, idx) => (
                          <div key={idx} className="text-sm flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{attendee.name || attendee.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {meeting.created_by && (
                    <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>Organizer: {displayNames[meeting.created_by] || 'Loading...'}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {meeting.created_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Created: {format(new Date(meeting.created_at), 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          </TabsContent>

          <TabsContent value="followups" className="mt-4">
            <MeetingFollowUpsSection meetingId={meeting.id} />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Activity tracking coming soon</p>
                  <p className="text-xs mt-1">Meeting history and changes will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="related" className="mt-4 space-y-4">
            {/* Linked Account */}
            {linkedAccount && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Linked Account
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{linkedAccount.company_name}</p>
                      <p className="text-sm text-muted-foreground">Account</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Deal */}
            {linkedDeal && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Linked Deal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Briefcase className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{linkedDeal.deal_name}</p>
                      <Badge variant="outline" className="mt-1">{linkedDeal.stage}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Linked Tasks ({linkedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : linkedTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No linked tasks</p>
                    <p className="text-xs mt-1">Tasks linked to this meeting will appear here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {linkedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            {task.due_date && (
                              <p className="text-xs text-muted-foreground">
                                Due: {format(new Date(task.due_date), 'dd/MM/yyyy')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <Badge variant="outline" className={taskStatusColors[task.status] || ''}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={priorityColors[task.priority] || ''}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Lead/Contact Info */}
            {(meeting.lead_name || meeting.contact_name) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Primary Contact
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{meeting.lead_name || meeting.contact_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {meeting.lead_name ? 'Lead' : 'Contact'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state for no linked entities */}
            {!linkedAccount && !linkedDeal && linkedTasks.length === 0 && !meeting.lead_name && !meeting.contact_name && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No linked records</p>
                <p className="text-xs mt-1">This meeting is not linked to any other records</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <TaskModal
      open={showTaskModal}
      onOpenChange={setShowTaskModal}
      onSubmit={async (data) => {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) return null;
        
        const { data: taskData, error } = await supabase
          .from('tasks')
          .insert({
            ...data,
            meeting_id: meeting.id,
            module_type: 'meetings',
            created_by: userData.user.id,
          })
          .select()
          .single();

        if (!error && taskData) {
          setShowTaskModal(false);
          fetchLinkedData();
          onUpdate?.();
          toast({
            title: "Success",
            description: "Task created and linked to meeting",
          });
          return taskData;
        }
        return null;
      }}
      context={{ module: 'meetings', recordId: meeting.id, recordName: meeting.subject, locked: true }}
    />
  </>
  );
};
