import { useState, useEffect } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { ContactActivityTimeline } from './ContactActivityTimeline';
import { ContactActivityLogModal } from './ContactActivityLogModal';
import { ContactTagsManager } from './ContactTagsManager';
import { ContactEmailTracking } from './ContactEmailTracking';
import { ContactAssociations } from './ContactAssociations';
import { EntityEmailHistory } from '@/components/shared/EntityEmailHistory';
import { SendEmailModal } from '@/components/SendEmailModal';
import { AccountDetailModalById } from '@/components/accounts/AccountDetailModalById';
import { MeetingModal } from '@/components/MeetingModal';
import { TaskModal } from '@/components/tasks/TaskModal';
import { useTasks } from '@/hooks/useTasks';
import { toast } from '@/hooks/use-toast';
import {
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Plus,
  Clock,
  Tag,
  Activity,
  BarChart3,
  Send,
  History,
  Pencil,
  Link2,
  CalendarPlus,
  ListTodo,
} from 'lucide-react';
import { format } from 'date-fns';

interface Contact {
  id: string;
  contact_name: string;
  company_name: string | null;
  account_id?: string | null;
  position: string | null;
  email: string | null;
  phone_no: string | null;
  linkedin: string | null;
  website: string | null;
  region: string | null;
  industry: string | null;
  contact_source: string | null;
  description: string | null;
  tags: string[] | null;
  score: number | null;
  segment: string | null;
  email_opens: number | null;
  email_clicks: number | null;
  engagement_score: number | null;
  created_time: string | null;
  modified_time?: string | null;
}

interface ContactDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  onUpdate?: () => void;
  onEdit?: (contact: Contact) => void;
}

export const ContactDetailModal = ({
  open,
  onOpenChange,
  contact,
  onUpdate,
  onEdit,
}: ContactDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [accountName, setAccountName] = useState<string | null>(null);
  
  const { createTask, updateTask } = useTasks();

  useEffect(() => {
    if (contact) {
      setTags(contact.tags || []);
      // Fetch account name if linked
      if (contact.account_id) {
        fetchAccountName(contact.account_id);
      } else {
        setAccountName(null);
      }
    }
  }, [contact]);

  const fetchAccountName = async (accountId: string) => {
    const { data } = await supabase
      .from('accounts')
      .select('company_name')
      .eq('id', accountId)
      .single();
    setAccountName(data?.company_name || null);
  };

  const handleTagsChange = async (newTags: string[]) => {
    if (!contact) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ tags: newTags })
        .eq('id', contact.id);

      if (error) throw error;

      setTags(newTags);
      toast({
        title: "Tags Updated",
        description: "Contact tags have been updated",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating tags:', error);
      toast({
        title: "Error",
        description: "Failed to update tags",
        variant: "destructive",
      });
    }
  };

  const handleActivityLogged = () => {
    onUpdate?.();
  };

  if (!contact) return null;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {contact.contact_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {contact.position && <span>{contact.position}</span>}
                  {contact.position && (contact.company_name || accountName) && <span>at</span>}
                  {(accountName || contact.company_name) && (
                    <button
                      onClick={() => contact.account_id && setShowAccountModal(true)}
                      className={`font-medium ${contact.account_id ? 'text-primary hover:underline cursor-pointer' : ''}`}
                      disabled={!contact.account_id}
                    >
                      {accountName || contact.company_name}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {contact.score !== null && (
                    <Badge className={`${getScoreColor(contact.score)} border`}>
                      Score: {contact.score}
                    </Badge>
                  )}
                  {contact.segment && (
                    <Badge variant="outline" className="capitalize">
                      {contact.segment}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(contact)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Update
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMeetingModal(true)}
                  className="gap-2"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Schedule Meeting
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTaskModal(true)}
                  className="gap-2"
                >
                  <ListTodo className="h-4 w-4" />
                  Create Task
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityLogModal(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Log Activity
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="related" className="flex items-center gap-1">
                <Link2 className="h-4 w-4" />
                Related
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="emails" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Tags
              </TabsTrigger>
              <TabsTrigger value="engagement" className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                Engagement
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">Contact Information</h3>
                  
                  {contact.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${contact.email}`} className="text-sm hover:underline">
                          {contact.email}
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => setShowEmailModal(true)}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {contact.phone_no && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${contact.phone_no}`} className="text-sm hover:underline">
                        {contact.phone_no}
                      </a>
                    </div>
                  )}
                  
                  {contact.linkedin && (
                    <div className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-muted-foreground" />
                      <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  
                  {contact.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                        {contact.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">Company Details</h3>
                  
                  {(accountName || contact.company_name) && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {contact.account_id ? (
                        <button
                          onClick={() => setShowAccountModal(true)}
                          className="text-sm text-primary hover:underline"
                        >
                          {accountName || contact.company_name}
                        </button>
                      ) : (
                        <span className="text-sm">{contact.company_name}</span>
                      )}
                    </div>
                  )}
                  
                  {contact.industry && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{contact.industry}</span>
                    </div>
                  )}
                  
                  {contact.region && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{contact.region}</span>
                    </div>
                  )}
                  
                  {contact.contact_source && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Source: {contact.contact_source}</span>
                    </div>
                  )}
                </div>
              </div>

              {contact.description && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-2">Description</h3>
                    <p className="text-sm">{contact.description}</p>
                  </div>
                </>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                {contact.created_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(contact.created_time), 'dd/MM/yyyy')}
                  </span>
                )}
                {contact.modified_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(contact.modified_time), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="related" className="mt-4">
              <ContactAssociations 
                contactId={contact.id} 
                contactName={contact.contact_name}
                accountId={contact.account_id || undefined}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Activity Timeline</h3>
                <Button size="sm" onClick={() => setShowActivityLogModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Log Activity
                </Button>
              </div>
              <ContactActivityTimeline contactId={contact.id} />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Email History</h3>
                  {contact.email && (
                    <Button size="sm" onClick={() => setShowEmailModal(true)}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>
                  )}
                </div>
                <EntityEmailHistory entityType="contact" entityId={contact.id} />
              </div>
            </TabsContent>

            <TabsContent value="tags" className="mt-4">
              <div className="space-y-4">
                <h3 className="font-medium">Tags & Labels</h3>
                <ContactTagsManager tags={tags} onTagsChange={handleTagsChange} />
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Email Tracking & Engagement</h3>
                  {contact.email && (
                    <Button size="sm" onClick={() => setShowEmailModal(true)}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>
                  )}
                </div>
                <ContactEmailTracking
                  emailOpens={contact.email_opens || 0}
                  emailClicks={contact.email_clicks || 0}
                  engagementScore={contact.engagement_score || 0}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <ContactActivityLogModal
        open={showActivityLogModal}
        onOpenChange={setShowActivityLogModal}
        contactId={contact.id}
        onSuccess={handleActivityLogged}
      />

      <SendEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        recipient={{
          name: contact.contact_name,
          email: contact.email || undefined,
          company_name: contact.company_name || undefined,
          position: contact.position || undefined,
        }}
        contactId={contact.id}
        onEmailSent={onUpdate}
      />

      <AccountDetailModalById
        open={showAccountModal}
        onOpenChange={setShowAccountModal}
        accountId={contact.account_id || null}
      />

      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        initialContactId={contact.id}
        onSuccess={() => {
          onUpdate?.();
          setShowMeetingModal(false);
        }}
      />

      <TaskModal
        open={showTaskModal}
        onOpenChange={setShowTaskModal}
        onSubmit={async (data) => {
          const result = await createTask({ ...data, contact_id: contact.id, module_type: 'contacts' });
          if (result) {
            onUpdate?.();
            setShowTaskModal(false);
          }
          return result;
        }}
        onUpdate={updateTask}
        context={{ module: 'contacts', recordId: contact.id, recordName: contact.contact_name }}
      />
    </>
  );
};
