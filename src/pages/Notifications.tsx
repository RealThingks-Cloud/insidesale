import { Bell, CheckCheck, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const Notifications = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    loading,
    currentPage,
    totalNotifications,
    itemsPerPage,
    fetchNotifications,
    setCurrentPage
  } = useNotifications();
  const navigate = useNavigate();

  // Calculate total pages
  const totalPages = Math.ceil(totalNotifications / itemsPerPage);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchNotifications(page);
  };

  // Fetch initial data
  useEffect(() => {
    fetchNotifications(1);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    if (notification.status === 'unread') {
      await markAsRead(notification.id);
    }

    const message = notification.message.toLowerCase();
    const dealMatch = message.match(/deal[:\s]+([a-f0-9-]{36})/);
    const leadMatch = message.match(/lead[:\s]+([a-f0-9-]{36})/);
    
    if (notification.lead_id) {
      navigate(`/leads?highlight=${notification.lead_id}`);
    } else if (dealMatch) {
      const dealId = dealMatch[1];
      navigate(`/deals?highlight=${dealId}`);
    } else if (leadMatch) {
      const leadId = leadMatch[1];
      navigate(`/leads?highlight=${leadId}`);
    } else if (notification.notification_type === 'action_item') {
      if (message.includes('deal')) {
        navigate('/deals');
      } else if (message.includes('lead') || message.includes('contact')) {
        navigate('/leads');
      } else {
        navigate('/deals');
      }
    } else if (notification.notification_type === 'deal_update') {
      navigate('/deals');
    } else if (notification.notification_type === 'lead_update') {
      navigate('/leads');
    } else {
      navigate('/dashboard');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'action_item':
        return '📋';
      case 'lead_update':
        return '👤';
      case 'deal_update':
        return '💼';
      default:
        return '🔔';
    }
  };

  // Show skeleton instead of blocking full-screen loader
  const showSkeleton = loading && notifications.length === 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="rounded-full">
                  {unreadCount} unread
                </Badge>
              )}
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} • {totalNotifications} total
              </div>
            </div>
            
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                className="flex items-center gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all as read
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showSkeleton ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
              <p className="text-sm">You'll see updates about action items and leads here</p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-6 hover:bg-muted/50 cursor-pointer transition-colors relative group",
                    notification.status === 'unread' && "bg-blue-50/50 border-l-4 border-l-blue-500"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-4">
                        <span className="text-2xl mt-1 flex-shrink-0">
                          {getNotificationIcon(notification.notification_type)}
                        </span>
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm text-foreground leading-relaxed mb-3",
                            notification.status === 'unread' && "font-semibold"
                          )}>
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </p>
                            {notification.status === 'unread' && (
                              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                New
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs capitalize">
                              {notification.notification_type.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {notification.status === 'unread' && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            Mark as read
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-6 border-t bg-background">
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="cursor-pointer"
                  />
                </PaginationItem>
              )}
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
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
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="cursor-pointer"
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default Notifications;
