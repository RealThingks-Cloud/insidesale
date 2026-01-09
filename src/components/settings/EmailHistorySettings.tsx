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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Search, Eye, MousePointer, Clock, Filter, RefreshCw, ChevronLeft, ChevronRight, X, RotateCcw, Loader2, Download, Calendar } from "lucide-react";
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
  click_count: number | null;
  opened_at: string | null;
  clicked_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  account_id: string | null;
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

  useEffect(() => {
    fetchEmailHistory();
  }, [user]);

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
        .select('*')
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

  const handleRetryEmail = async (email: EmailHistoryRecord, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    setRetryingEmailId(email.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: email.recipient_email,
          subject: email.subject,
          body: email.body,
          recipientName: email.recipient_name,
          contactId: email.contact_id,
          leadId: email.lead_id,
          accountId: email.account_id,
        }
      });

      if (error) throw error;

      // Update the email status in the database
      await supabase
        .from('email_history')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', email.id);

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

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      opened: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      clicked: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.sent}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
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

  const stats = {
    total: emails.length,
    opened: emails.filter(e => (e.open_count || 0) > 0).length,
    clicked: emails.filter(e => (e.click_count || 0) > 0).length,
    openRate: emails.length > 0 ? Math.round((emails.filter(e => (e.open_count || 0) > 0).length / emails.length) * 100) : 0,
    clickRate: emails.length > 0 ? Math.round((emails.filter(e => (e.click_count || 0) > 0).length / emails.length) * 100) : 0,
  };

  const handleExportCSV = () => {
    const headers = ["Recipient Name", "Recipient Email", "Subject", "Sent At", "Status", "Opens", "Clicks", "Type"];
    const rows = filteredEmails.map(email => [
      email.recipient_name || "Unknown",
      email.recipient_email,
      email.subject,
      format(new Date(email.sent_at), "yyyy-MM-dd HH:mm"),
      email.status,
      email.open_count || 0,
      email.click_count || 0,
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Opened</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.opened}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clicked</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.clicked}</p>
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
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Click Rate</span>
            </div>
            <p className="text-xl font-bold mt-1">{stats.clickRate}%</p>
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
                      <TableHead className="text-center">Clicks</TableHead>
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
                            {getStatusBadge(email.status)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={email.open_count ? "text-primary font-medium" : "text-muted-foreground"}>
                              {email.open_count || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={email.click_count ? "text-primary font-medium" : "text-muted-foreground"}>
                              {email.click_count || 0}
                            </span>
                          </TableCell>
                          <TableCell>
                            {email.status === 'failed' && (
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

      {/* Email Detail Modal */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Details
            </DialogTitle>
            <DialogDescription>
              {selectedEmail && `Sent on ${format(new Date(selectedEmail.sent_at), "MMMM d, yyyy 'at' HH:mm")}`}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">{selectedEmail.sender_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="font-medium">{selectedEmail.recipient_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedEmail.recipient_email}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{selectedEmail.subject}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Message</p>
                <div 
                  className="p-3 bg-muted/50 rounded-lg text-sm max-h-[200px] overflow-y-auto email-body-preview"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body || "<p>No message content</p>" }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedEmail.status)}</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Opens</p>
                  <p className="text-xl font-bold text-primary">{selectedEmail.open_count || 0}</p>
                  {selectedEmail.opened_at && (
                    <p className="text-xs text-muted-foreground">
                      Last: {format(new Date(selectedEmail.opened_at), "MMM d, HH:mm")}
                    </p>
                  )}
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Clicks</p>
                  <p className="text-xl font-bold text-primary">{selectedEmail.click_count || 0}</p>
                  {selectedEmail.clicked_at && (
                    <p className="text-xs text-muted-foreground">
                      Last: {format(new Date(selectedEmail.clicked_at), "MMM d, HH:mm")}
                    </p>
                  )}
                </div>
                <div className="text-center p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">Entity Type</p>
                  <Badge variant={getEntityBadgeVariant(getEntityType(selectedEmail))} className="mt-1">
                    {getEntityType(selectedEmail)}
                  </Badge>
                </div>
              </div>

              {/* Retry Button for Failed Emails */}
              {selectedEmail.status === 'failed' && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => handleRetryEmail(selectedEmail)}
                    disabled={retryingEmailId === selectedEmail.id}
                    className="w-full"
                  >
                    {retryingEmailId === selectedEmail.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Retry Sending Email
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailHistorySettings;
