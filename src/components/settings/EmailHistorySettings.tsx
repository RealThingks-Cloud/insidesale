import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Mail, Search, Eye, Clock, Filter, RefreshCw, ChevronLeft, ChevronRight, X, RotateCcw, Loader2, Download, Calendar, AlertTriangle, XCircle, CheckCircle2, Send, Ban } from "lucide-react";
import { format } from "date-fns";

interface EmailHistoryRecord {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string | null;
  sender_email: string;
  sent_at: string;
  status: string;
  open_count: number | null;
  unique_opens: number | null;
  is_valid_open: boolean | null;
  opened_at: string | null;
  clicked_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  account_id: string | null;
  bounce_type: string | null;
  bounce_reason: string | null;
  bounced_at: string | null;
}

const ITEMS_PER_PAGE = 10;

const EmailHistorySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<EmailHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [retryingEmailId, setRetryingEmailId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<string>("all");
  const [isSyncingBounces, setIsSyncingBounces] = useState(false);
  const [markingBounced, setMarkingBounced] = useState<string | null>(null);
  const [showBounceConfirm, setShowBounceConfirm] = useState(false);
  const [emailToMarkBounced, setEmailToMarkBounced] = useState<EmailHistoryRecord | null>(null);

  useEffect(() => {
    fetchEmailHistory();
  }, [user]);

  // Real-time subscription for bounce detection
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('email-bounce-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'email_history',
        },
        (payload) => {
          const newRecord = payload.new as EmailHistoryRecord;
          const oldRecord = payload.old as Partial<EmailHistoryRecord>;
          
          // Check if status changed to bounced
          if (newRecord.status === 'bounced' && oldRecord.status !== 'bounced') {
            toast({
              title: "Bounce Detected",
              description: `Email to ${newRecord.recipient_email} has bounced.`,
              variant: "destructive",
            });
            
            // Refresh the list to show updated status
            fetchEmailHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, dateRange]);

  const fetchEmailHistory = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_history')
        .select('id, recipient_email, recipient_name, sender_email, subject, body, status, sent_at, sent_by, delivered_at, opened_at, open_count, unique_opens, is_valid_open, click_count, clicked_at, contact_id, lead_id, account_id, bounce_type, bounce_reason, bounced_at')
        .eq('sent_by', user.id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error fetching email history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncBounces = async () => {
    setIsSyncingBounces(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Use the improved process-bounce-checks function
      const { data, error } = await supabase.functions.invoke('process-bounce-checks', {
        body: {},
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data.hint && data.totalBouncesFound === 0) {
        toast({
          title: "Bounce Check Complete",
          description: data.hint,
          variant: "default",
        });
      } else {
        toast({
          title: "Bounce Check Complete",
          description: data.message || `Found ${data.totalBouncesFound || 0} bounced email(s)`,
        });
      }

      // Refresh the list
      fetchEmailHistory();
    } catch (error: any) {
      console.error('Error syncing bounces:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to check bounces. Ensure Azure app has 'Mail.Read' application permission.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingBounces(false);
    }
  };

  const handleMarkAsBounced = async (email: EmailHistoryRecord) => {
    setMarkingBounced(email.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('mark-email-bounced', {
        body: {
          emailId: email.id,
          bounceType: 'hard',
          bounceReason: 'Manually marked as bounced',
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Email Marked as Bounced",
        description: "The email has been marked as bounced and metrics updated.",
      });

      // Refresh the list
      fetchEmailHistory();
      setShowBounceConfirm(false);
      setEmailToMarkBounced(null);
      setSelectedEmail(null);
    } catch (error: any) {
      console.error('Error marking email as bounced:', error);
      toast({
        title: "Action Failed",
        description: error.message || "Failed to mark email as bounced.",
        variant: "destructive",
      });
    } finally {
      setMarkingBounced(null);
    }
  };

  const handleRetryEmail = async (email: EmailHistoryRecord, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    setRetryingEmailId(email.id);
    try {
      // Determine entity type and id for proper association
      let entityType: string | undefined;
      let entityId: string | undefined;
      
      if (email.contact_id) {
        entityType = 'contact';
        entityId = email.contact_id;
      } else if (email.lead_id) {
        entityType = 'lead';
        entityId = email.lead_id;
      } else if (email.account_id) {
        entityType = 'account';
        entityId = email.account_id;
      }
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email.recipient_email,
          toName: email.recipient_name,
          from: email.sender_email,
          subject: email.subject,
          body: email.body,
          entityType,
          entityId,
        }
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: `Email to ${email.recipient_email} has been resent successfully.`,
      });

      // Refresh the list
      fetchEmailHistory();
    } catch (error: any) {
      console.error('Error retrying email:', error);
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to resend email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingEmailId(null);
    }
  };

  const getEntityType = (email: EmailHistoryRecord): string => {
    if (email.contact_id) return "Contact";
    if (email.lead_id) return "Lead";
    if (email.account_id) return "Account";
    return "Other";
  };

  const getEntityBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "Contact": return "default";
      case "Lead": return "secondary";
      case "Account": return "outline";
      default: return "outline";
    }
  };

  const getStatusBadge = (email: EmailHistoryRecord) => {
    const status = email.status;
    const bounceType = email.bounce_type;
    const isValidOpen = email.is_valid_open;

    // Bounced takes priority
    if (bounceType || status === 'bounced') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Bounced
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{bounceType === 'hard' ? 'Hard Bounce' : bounceType === 'soft' ? 'Soft Bounce' : 'Bounced'}</p>
              {email.bounce_reason && <p className="text-xs max-w-[200px]">{email.bounce_reason}</p>}
              {email.bounced_at && <p className="text-xs text-muted-foreground">At: {format(new Date(email.bounced_at), 'PPp')}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    // Suspicious open
    if (status === 'opened' && isValidOpen === false) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Suspicious
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>This open may be from an email scanner or bot</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const statusColors: Record<string, { bg: string; icon: React.ReactNode }> = {
      sent: { bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: <Send className="w-3 h-3" /> },
      delivered: { bg: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
      opened: { bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <Eye className="w-3 h-3" /> },
      failed: { bg: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3 h-3" /> },
    };

    const config = statusColors[status] || statusColors.sent;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.bg}`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getOpensDisplay = (email: EmailHistoryRecord) => {
    // Bounced emails should show 0 opens
    if (email.bounce_type || email.status === 'bounced') {
      return <span className="text-muted-foreground">0</span>;
    }

    const uniqueOpens = email.unique_opens || 0;
    const totalOpens = email.open_count || 0;
    const isValidOpen = email.is_valid_open;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1">
            <Eye className={`w-4 h-4 ${isValidOpen === false ? 'text-yellow-500' : ''}`} />
            <span className={isValidOpen === false ? 'text-yellow-600' : (uniqueOpens > 0 ? 'text-primary font-medium' : 'text-muted-foreground')}>
              {uniqueOpens}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Unique opens: {uniqueOpens}</p>
            <p>Total opens: {totalOpens}</p>
            {isValidOpen === false && <p className="text-yellow-500">May include scanner/bot opens</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const filteredEmails = emails.filter(email => {
    const matchesSearch = 
      email.recipient_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.recipient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Date range filter
    let matchesDate = true;
    if (dateRange !== "all") {
      const emailDate = new Date(email.sent_at);
      const now = new Date();
      const days = parseInt(dateRange);
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      matchesDate = emailDate >= cutoffDate;
    }
    
    let matchesType = true;
    if (filterType === "contact") matchesType = !!email.contact_id;
    else if (filterType === "lead") matchesType = !!email.lead_id;
    else if (filterType === "account") matchesType = !!email.account_id;
    
    return matchesSearch && matchesDate && matchesType;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEmails = filteredEmails.slice(startIndex, endIndex);

  // Calculate stats excluding bounced emails for open rate
  const nonBouncedEmails = emails.filter(e => !e.bounce_type && e.status !== 'bounced');
  const validOpens = nonBouncedEmails.filter(e => (e.unique_opens || e.open_count || 0) > 0 && e.is_valid_open !== false);
  const stats = {
    total: emails.length,
    bounced: emails.filter(e => e.bounce_type || e.status === 'bounced').length,
    opened: validOpens.length,
    openRate: nonBouncedEmails.length > 0 ? Math.round((validOpens.length / nonBouncedEmails.length) * 100) : 0,
  };

  const handleExportCSV = () => {
    const headers = ["Recipient Name", "Recipient Email", "Subject", "Sent At", "Status", "Unique Opens", "Total Opens", "Valid Open", "Bounce Type", "Bounce Reason", "Type"];
    const rows = filteredEmails.map(email => [
      email.recipient_name || "Unknown",
      email.recipient_email,
      email.subject,
      format(new Date(email.sent_at), "yyyy-MM-dd HH:mm"),
      email.status,
      email.unique_opens || 0,
      email.open_count || 0,
      email.is_valid_open !== false ? "Yes" : "No",
      email.bounce_type || "",
      email.bounce_reason || "",
      getEntityType(email)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `email_history_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Email History</h2>
        <p className="text-sm text-muted-foreground">
          View all emails you've sent to contacts, leads, and accounts with tracking details.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Sent</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Bounced</span>
            </div>
            <p className="text-xl font-bold mt-1 text-destructive">{stats.bounced}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Opened</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.opened}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Open Rate</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.openRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Emails</SelectItem>
            <SelectItem value="contact">Contacts</SelectItem>
            <SelectItem value="lead">Leads</SelectItem>
            <SelectItem value="account">Accounts</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchEmailHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleSyncBounces} disabled={isSyncingBounces}>
                  <Ban className={`h-4 w-4 mr-2 ${isSyncingBounces ? 'animate-pulse' : ''}`} />
                  {isSyncingBounces ? 'Syncing...' : 'Sync Bounces'}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[300px]">
                <p className="font-medium">Bounce Detection</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Checks Office 365 mailbox for bounce-back emails (NDRs).
                </p>
                <p className="text-xs text-orange-500 mt-1 font-medium">
                  ⚠️ Requires Azure AD app to have "Mail.Read" APPLICATION permission with admin consent.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button variant="outline" onClick={handleExportCSV} disabled={filteredEmails.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Email Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sent Emails</CardTitle>
          <CardDescription>
            {filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} found
            {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No emails found</p>
              <p className="text-sm">Emails you send will appear here</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Opens</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmails.map((email) => {
                      const entityType = getEntityType(email);
                      return (
                        <TableRow 
                          key={email.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{email.recipient_name || "Unknown"}</p>
                              <p className="text-sm text-muted-foreground">{email.recipient_email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[200px] truncate">{email.subject}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEntityBadgeVariant(entityType)}>
                              {entityType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(email.sent_at), "MMM d, yyyy HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(email)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getOpensDisplay(email)}
                          </TableCell>
                          <TableCell>
                            {(email.status === 'failed' || email.bounce_type) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => handleRetryEmail(email, e)}
                                      disabled={retryingEmailId === email.id}
                                    >
                                      {retryingEmailId === email.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Retry sending</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredEmails.length)} of {filteredEmails.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              Sent on {selectedEmail && format(new Date(selectedEmail.sent_at), "MMMM d, yyyy 'at' h:mm a")}
            </DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="font-medium">{selectedEmail.recipient_name || "Unknown"}</p>
                  <p className="text-sm">{selectedEmail.recipient_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">{selectedEmail.sender_email}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{selectedEmail.subject}</p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedEmail)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Opens</p>
                  <p className="font-medium">{getOpensDisplay(selectedEmail)}</p>
                </div>
                {selectedEmail.opened_at && !selectedEmail.bounce_type && (
                  <div>
                    <p className="text-sm text-muted-foreground">First Opened</p>
                    <p className="text-sm">{format(new Date(selectedEmail.opened_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
              </div>

              {/* Bounce info */}
              {selectedEmail.bounce_type && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">
                      {selectedEmail.bounce_type === 'hard' ? 'Hard Bounce' : 'Soft Bounce'}
                    </span>
                  </div>
                  {selectedEmail.bounce_reason && (
                    <p className="text-sm mt-1 text-muted-foreground">{selectedEmail.bounce_reason}</p>
                  )}
                  {selectedEmail.bounced_at && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Detected: {format(new Date(selectedEmail.bounced_at), 'PPp')}
                    </p>
                  )}
                </div>
              )}

              {/* Suspicious open warning */}
              {selectedEmail.status === 'opened' && selectedEmail.is_valid_open === false && !selectedEmail.bounce_type && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Suspicious Open Detected</span>
                  </div>
                  <p className="text-sm mt-1 text-muted-foreground">
                    This open may be from an email security scanner or bot, not the actual recipient.
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Content</p>
                <div 
                  className="p-4 bg-muted/50 rounded-lg prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body || '' }}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {!selectedEmail.bounce_type && selectedEmail.status !== 'bounced' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setEmailToMarkBounced(selectedEmail);
                      setShowBounceConfirm(true);
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Mark as Bounced
                  </Button>
                )}
                {(selectedEmail.status === 'failed' || selectedEmail.bounce_type) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetryEmail(selectedEmail)}
                    disabled={retryingEmailId === selectedEmail.id}
                  >
                    {retryingEmailId === selectedEmail.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Retry Sending
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bounce Confirmation Dialog */}
      <Dialog open={showBounceConfirm} onOpenChange={setShowBounceConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Email as Bounced?</DialogTitle>
            <DialogDescription>
              This will mark the email to {emailToMarkBounced?.recipient_email} as bounced, reset open counts, and update any associated contact's engagement score.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBounceConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => emailToMarkBounced && handleMarkAsBounced(emailToMarkBounced)}
              disabled={markingBounced === emailToMarkBounced?.id}
            >
              {markingBounced === emailToMarkBounced?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Mark as Bounced
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailHistorySettings;
