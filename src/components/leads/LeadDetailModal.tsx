import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityEmailHistory } from '@/components/shared/EntityEmailHistory';
import { SendEmailModal } from '@/components/SendEmailModal';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { LeadActivityLogModal } from './LeadActivityLogModal';
import { MeetingModal } from '@/components/MeetingModal';
import { TaskModal } from '@/components/tasks/TaskModal';
import { getLeadStatusColor } from '@/utils/leadStatusUtils';
import {
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Clock,
  Send,
  Plus,
  Factory,
  Pencil,
  CalendarPlus,
  CheckSquare,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';

interface Lead {
  id: string;
  lead_name: string;
  company_name: string | null;
  account_id?: string | null;
  position: string | null;
  email: string | null;
  phone_no: string | null;
  linkedin: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
  contact_source: string | null;
  description: string | null;
  lead_status: string | null;
  created_time: string | null;
  modified_time?: string | null;
}

interface Account {
  id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  country: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
}

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onUpdate?: () => void;
  onEdit?: (lead: Lead) => void;
}

export const LeadDetailModal = ({
  open,
  onOpenChange,
  lead,
  onUpdate,
  onEdit,
}: LeadDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch linked account details
  const { data: linkedAccount } = useQuery({
    queryKey: ['linked-account', lead?.account_id],
    queryFn: async () => {
      if (!lead?.account_id) return null;
      const { data, error } = await supabase
        .from('accounts')
        .select('id, company_name, industry, website, country, region, phone, email, status')
        .eq('id', lead.account_id)
        .single();
      
      if (error) {
        console.error('Error fetching linked account:', error);
        return null;
      }
      return data as Account;
    },
    enabled: !!lead?.account_id,
  });

  if (!lead) return null;

  const handleActivityLogged = () => {
    setRefreshKey(prev => prev + 1);
    onUpdate?.();
  };

  // Get display company name from linked account or lead's legacy field
  const displayCompanyName = linkedAccount?.company_name || lead.company_name;
  const displayIndustry = linkedAccount?.industry || lead.industry;
  const displayCountry = linkedAccount?.country || lead.country;
  const displayWebsite = linkedAccount?.website || lead.website;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {lead.lead_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {lead.position && <span>{lead.position}</span>}
                  {lead.position && displayCompanyName && <span>at</span>}
                  {displayCompanyName && (
                    <span className="font-medium">{displayCompanyName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getLeadStatusColor(lead.lead_status)}>
                    {lead.lead_status || 'New'}
                  </Badge>
                  {lead.contact_source && (
                    <Badge variant="outline">Source: {lead.contact_source}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(lead)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMeetingModal(true)}
                  className="gap-2"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Meeting
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTaskModal(true)}
                  className="gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityLogModal(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Activity
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                          {lead.email}
                        </a>
                      </div>
                    )}
                    {lead.phone_no && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${lead.phone_no}`} className="hover:underline">
                          {lead.phone_no}
                        </a>
                      </div>
                    )}
                    {lead.linkedin && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {displayWebsite && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {displayWebsite}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayCompanyName && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{displayCompanyName}</span>
                      </div>
                    )}
                    {displayIndustry && (
                      <div className="flex items-center gap-2 text-sm">
                        <Factory className="h-4 w-4 text-muted-foreground" />
                        <span>{displayIndustry}</span>
                      </div>
                    )}
                    {displayCountry && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{displayCountry}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {lead.description && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {lead.created_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(lead.created_time), 'dd/MM/yyyy')}
                  </span>
                )}
                {lead.modified_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(lead.modified_time), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <LeadActivityTimeline key={refreshKey} leadId={lead.id} />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Email History</h3>
                  {lead.email && (
                    <Button size="sm" onClick={() => setShowEmailModal(true)}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>
                  )}
                </div>
                <EntityEmailHistory entityType="lead" entityId={lead.id} />
              </div>
            </TabsContent>

            <TabsContent value="related" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Linked Account</CardTitle>
                </CardHeader>
                <CardContent>
                  {linkedAccount ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{linkedAccount.company_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {[linkedAccount.industry, linkedAccount.country].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <ExternalLink className="h-4 w-4" />
                          View Account
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                        {linkedAccount.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{linkedAccount.email}</span>
                          </div>
                        )}
                        {linkedAccount.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{linkedAccount.phone}</span>
                          </div>
                        )}
                        {linkedAccount.website && (
                          <div className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <a 
                              href={linkedAccount.website.startsWith('http') ? linkedAccount.website : `https://${linkedAccount.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {linkedAccount.website}
                            </a>
                          </div>
                        )}
                        {linkedAccount.region && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{linkedAccount.region}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No linked account</p>
                      <p className="text-xs mt-1">Link this lead to an account for full company details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <LeadActivityLogModal
        open={showActivityLogModal}
        onOpenChange={setShowActivityLogModal}
        leadId={lead.id}
        onSuccess={handleActivityLogged}
      />

      <SendEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        recipient={{
          name: lead.lead_name,
          email: lead.email || undefined,
          company_name: displayCompanyName || undefined,
          position: lead.position || undefined,
        }}
        leadId={lead.id}
        onEmailSent={onUpdate}
      />

      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        initialLeadId={lead.id}
        onSuccess={() => {
          setShowMeetingModal(false);
          onUpdate?.();
        }}
      />

      <TaskModal
        open={showTaskModal}
        onOpenChange={setShowTaskModal}
        onSubmit={async (data) => {
          // Import and use createTask from useTasks if needed
          const { supabase } = await import('@/integrations/supabase/client');
          const { data: userData } = await supabase.auth.getUser();
          if (!userData?.user?.id) return null;
          
          const { data: taskData, error } = await supabase
            .from('tasks')
            .insert({
              ...data,
              lead_id: lead.id,
              module_type: 'leads',
              created_by: userData.user.id,
            })
            .select()
            .single();

          if (!error && taskData) {
            setShowTaskModal(false);
            onUpdate?.();
            return taskData;
          }
          return null;
        }}
        context={{ module: 'leads', recordId: lead.id, recordName: lead.lead_name }}
      />
    </>
  );
};