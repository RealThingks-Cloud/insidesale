import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, endOfWeek, isToday, subDays } from "date-fns";
import { getMeetingStatus } from "@/utils/meetingStatus";

const QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000, // 5 minutes for less volatile data
  gcTime: 10 * 60 * 1000,
};

const FAST_QUERY_OPTIONS = {
  staleTime: 30 * 1000, // 30 seconds for real-time data
  gcTime: 5 * 60 * 1000,
};

// User profile name
export const useUserProfileName = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-profile-name', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const name = data?.full_name;
      if (!name || name.includes('@')) {
        return user.email?.split('@')[0] || null;
      }
      return name;
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// User preferences for currency
export const useUserCurrency = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-preferences-currency', user?.id],
    queryFn: async () => {
      if (!user?.id) return { currency: 'USD' };
      const { data, error } = await supabase
        .from('user_preferences')
        .select('currency')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data || { currency: 'USD' };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Leads data
export const useLeadsData = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-leads-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, lead_status, lead_name, created_time')
        .eq('created_by', user?.id);
      if (error) throw error;
      const leads = data || [];
      const recentLead = leads.sort((a, b) => 
        new Date(b.created_time || 0).getTime() - new Date(a.created_time || 0).getTime()
      )[0];
      return {
        total: leads.length,
        new: leads.filter(l => l.lead_status === 'New').length,
        attempted: leads.filter(l => l.lead_status === 'Attempted').length,
        followUp: leads.filter(l => l.lead_status === 'Follow-up').length,
        qualified: leads.filter(l => l.lead_status === 'Qualified').length,
        recentLead: recentLead?.lead_name || null
      };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Contacts data
export const useContactsData = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-contacts-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, contact_name, email, phone_no, segment, contact_source, created_time')
        .eq('created_by', user?.id);
      if (error) throw error;
      const contacts = data || [];
      const bySource = {
        website: contacts.filter(c => c.contact_source?.toLowerCase() === 'website').length,
        referral: contacts.filter(c => c.contact_source?.toLowerCase() === 'referral').length,
        linkedin: contacts.filter(c => c.contact_source?.toLowerCase() === 'linkedin').length,
        other: contacts.filter(c => !['website', 'referral', 'linkedin'].includes(c.contact_source?.toLowerCase() || '')).length,
      };
      return { total: contacts.length, bySource };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Deals data with enhanced metrics
export const useDealsData = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-deals-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, stage, total_contract_value, deal_name, created_by, lead_owner, expected_closing_date, created_at');
      if (error) throw error;
      const userDeals = (data || []).filter(d => d.created_by === user?.id || d.lead_owner === user?.id);
      const activeDeals = userDeals.filter(d => !['Won', 'Lost', 'Dropped'].includes(d.stage));
      const wonDeals = userDeals.filter(d => d.stage === 'Won');
      const lostDeals = userDeals.filter(d => d.stage === 'Lost');
      const totalPipeline = activeDeals.reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
      const wonValue = wonDeals.reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
      
      // Calculate win rate
      const closedDeals = wonDeals.length + lostDeals.length;
      const winRate = closedDeals > 0 ? Math.round((wonDeals.length / closedDeals) * 100) : 0;
      
      // Calculate average deal size
      const avgDealSize = wonDeals.length > 0 ? Math.round(wonValue / wonDeals.length) : 0;
      
      // Pipeline funnel
      const funnelData = {
        lead: userDeals.filter(d => d.stage === 'Lead').length,
        discussions: userDeals.filter(d => d.stage === 'Discussions').length,
        qualified: userDeals.filter(d => d.stage === 'Qualified').length,
        rfq: userDeals.filter(d => d.stage === 'RFQ').length,
        offered: userDeals.filter(d => d.stage === 'Offered').length,
        won: wonDeals.length,
        lost: lostDeals.length,
      };

      return {
        total: userDeals.length,
        active: activeDeals.length,
        won: wonDeals.length,
        lost: lostDeals.length,
        totalPipeline,
        wonValue,
        winRate,
        avgDealSize,
        funnelData,
        byStage: {
          rfq: userDeals.filter(d => d.stage === 'RFQ').length,
          offered: userDeals.filter(d => d.stage === 'Offered').length,
          won: wonDeals.length,
          lost: lostDeals.length,
        }
      };
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Accounts data
export const useAccountsData = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-accounts-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts')
        .select('id, company_name, status, created_at, deal_count')
        .eq('created_by', user?.id);
      if (error) throw error;
      const accounts = data || [];
      const byStatus = {
        new: accounts.filter(a => a.status?.toLowerCase() === 'new').length,
        working: accounts.filter(a => a.status?.toLowerCase() === 'working').length,
        hot: accounts.filter(a => a.status?.toLowerCase() === 'hot').length,
        nurture: accounts.filter(a => a.status?.toLowerCase() === 'nurture').length,
      };
      
      // Top accounts by deal count
      const topAccounts = [...accounts]
        .sort((a, b) => (b.deal_count || 0) - (a.deal_count || 0))
        .slice(0, 5);
        
      return { total: accounts.length, byStatus, topAccounts };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Upcoming meetings
export const useUpcomingMeetings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-upcoming-meetings-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, subject, start_time, end_time, status, attendees')
        .eq('created_by', user?.id);
      if (error) throw error;
      const meetings = data || [];
      const now = new Date();
      
      const byStatus = {
        scheduled: meetings.filter(m => getMeetingStatus(m, now) === 'scheduled').length,
        ongoing: meetings.filter(m => getMeetingStatus(m, now) === 'ongoing').length,
        completed: meetings.filter(m => getMeetingStatus(m, now) === 'completed').length,
        cancelled: meetings.filter(m => getMeetingStatus(m, now) === 'cancelled').length,
      };
      
      const upcoming = meetings
        .filter(m => ['scheduled', 'ongoing'].includes(getMeetingStatus(m, now)))
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
        .slice(0, 5)
        .map(m => ({
          ...m,
          isToday: isToday(new Date(m.start_time)),
          attendeeCount: Array.isArray(m.attendees) ? m.attendees.length : 0
        }));
      return { meetings: upcoming, total: meetings.length, byStatus };
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Today's meetings
export const useTodaysMeetings = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-todays-meetings', user?.id],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('meetings')
        .select('id, subject, start_time, end_time, status')
        .eq('created_by', user?.id)
        .gte('start_time', todayStart.toISOString())
        .lte('start_time', todayEnd.toISOString())
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Today's tasks
export const useTodaysTasks = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-todays-tasks', user?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, status')
        .or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`)
        .in('status', ['open', 'in_progress'])
        .eq('due_date', today)
        .order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Overdue tasks
export const useOverdueTasks = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-overdue-tasks', user?.id],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, status')
        .or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`)
        .in('status', ['open', 'in_progress'])
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Task reminders
export const useTaskReminders = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-task-reminders-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, status')
        .or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`);
      if (error) throw error;
      const tasks = data || [];
      const byStatus = {
        open: tasks.filter(t => t.status === 'open').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length,
      };
      const today = format(new Date(), 'yyyy-MM-dd');
      const overdue = tasks.filter(t => t.due_date && t.due_date < today && ['open', 'in_progress'].includes(t.status)).length;
      const dueToday = tasks.filter(t => t.due_date === today).length;
      const highPriority = tasks.filter(t => t.priority === 'high' && ['open', 'in_progress'].includes(t.status)).length;
      return { tasks: tasks.slice(0, 5), overdue, dueToday, highPriority, total: tasks.length, byStatus };
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Email stats
export const useEmailStats = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-email-stats-enhanced', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('id, status, open_count, click_count, subject, sent_at')
        .eq('sent_by', user?.id)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      const emails = data || [];
      const sent = emails.length;
      const opened = emails.filter(e => (e.open_count || 0) > 0).length;
      const clicked = emails.filter(e => (e.click_count || 0) > 0).length;
      const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
      const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
      const recentEmail = emails[0];
      return { sent, opened, clicked, openRate, clickRate, recentSubject: recentEmail?.subject || null };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Follow-ups due
export const useFollowUpsDue = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-follow-ups-due', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_follow_ups')
        .select('id, title, status, due_date, meeting_id')
        .eq('assigned_to', user?.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      const followUps = data || [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const overdue = followUps.filter(f => f.due_date && f.due_date < today).length;
      return { followUps, total: followUps.length, overdue };
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Weekly summary
export const useWeeklySummary = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-weekly-summary-enhanced', user?.id],
    queryFn: async () => {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const startStr = weekStart.toISOString();
      const endStr = weekEnd.toISOString();
      
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekEnd);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      const lastStartStr = lastWeekStart.toISOString();
      const lastEndStr = lastWeekEnd.toISOString();
      
      const [
        leadsThisWeek, contactsThisWeek, accountsThisWeek, dealsThisWeek, meetingsThisWeek, tasksThisWeek,
        leadsLastWeek, contactsLastWeek, accountsLastWeek, dealsLastWeek, meetingsLastWeek, tasksLastWeek,
        leadsAllTime, contactsAllTime, accountsAllTime, dealsAllTime, meetingsAllTime, tasksAllTime
      ] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_time', startStr).lte('created_time', endStr),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_time', startStr).lte('created_time', endStr),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_at', startStr).lte('created_at', endStr),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_at', startStr).lte('created_at', endStr),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).eq('status', 'completed').gte('start_time', startStr).lte('start_time', endStr),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`).eq('status', 'completed').gte('completed_at', startStr).lte('completed_at', endStr),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_time', lastStartStr).lte('created_time', lastEndStr),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_time', lastStartStr).lte('created_time', lastEndStr),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_at', lastStartStr).lte('created_at', lastEndStr),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).gte('created_at', lastStartStr).lte('created_at', lastEndStr),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).eq('status', 'completed').gte('start_time', lastStartStr).lte('start_time', lastEndStr),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`).eq('status', 'completed').gte('completed_at', lastStartStr).lte('completed_at', lastEndStr),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('created_by', user?.id),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id),
        supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('created_by', user?.id),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('created_by', user?.id),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('created_by', user?.id).eq('status', 'completed'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`).eq('status', 'completed'),
      ]);
      
      return {
        thisWeek: {
          leads: leadsThisWeek.count || 0,
          contacts: contactsThisWeek.count || 0,
          accounts: accountsThisWeek.count || 0,
          deals: dealsThisWeek.count || 0,
          meetings: meetingsThisWeek.count || 0,
          tasks: tasksThisWeek.count || 0,
        },
        lastWeek: {
          leads: leadsLastWeek.count || 0,
          contacts: contactsLastWeek.count || 0,
          accounts: accountsLastWeek.count || 0,
          deals: dealsLastWeek.count || 0,
          meetings: meetingsLastWeek.count || 0,
          tasks: tasksLastWeek.count || 0,
        },
        allTime: {
          leads: leadsAllTime.count || 0,
          contacts: contactsAllTime.count || 0,
          accounts: accountsAllTime.count || 0,
          deals: dealsAllTime.count || 0,
          meetings: meetingsAllTime.count || 0,
          tasks: tasksAllTime.count || 0,
        },
        weekStartStr: weekStart.toISOString(),
        weekEndStr: weekEnd.toISOString(),
      };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Recent activities with user profiles
export const useRecentActivities = (showAllActivities: boolean = false) => {
  const { user } = useAuth();
  
  const { data: userProfiles } = useQuery({
    queryKey: ['all-user-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  return useQuery({
    queryKey: ['user-recent-activities', user?.id, showAllActivities],
    queryFn: async () => {
      let query = supabase
        .from('security_audit_log')
        .select('id, action, resource_type, resource_id, created_at, details, user_id')
        .in('action', ['CREATE', 'UPDATE', 'DELETE'])
        .in('resource_type', ['contacts', 'leads', 'deals', 'accounts', 'meetings', 'tasks'])
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!showAllActivities) {
        query = query.eq('user_id', user?.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(log => {
        let detailedSubject = `${log.action} ${log.resource_type}`;
        const details = log.details as any;
        
        if (details) {
          if (log.action === 'CREATE') {
            const name = details.deal_name || details.lead_name || details.contact_name || 
                        details.company_name || details.subject || details.title;
            if (name) detailedSubject = `Created ${log.resource_type.slice(0, -1)}: ${name}`;
          } else if (log.action === 'UPDATE') {
            const changes = details.changes || {};
            const changedFields = Object.keys(changes);
            if (changedFields.length > 0) {
              detailedSubject = `Updated ${changedFields.join(', ')} on ${log.resource_type.slice(0, -1)}`;
            }
          } else if (log.action === 'DELETE') {
            detailedSubject = `Deleted ${log.resource_type.slice(0, -1)}`;
          }
        }
        
        return {
          id: log.id,
          activity_type: log.action,
          resource_type: log.resource_type,
          subject: detailedSubject,
          activity_date: log.created_at,
          user_id: log.user_id,
        };
      });
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Upcoming deadlines (deals closing soon)
export const useUpcomingDeadlines = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-upcoming-deadlines', user?.id],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 14);
      
      const { data, error } = await supabase
        .from('deals')
        .select('id, deal_name, expected_closing_date, total_contract_value, stage')
        .or(`created_by.eq.${user?.id},lead_owner.eq.${user?.id}`)
        .not('stage', 'in', '("Won","Lost","Dropped")')
        .gte('expected_closing_date', today.toISOString().split('T')[0])
        .lte('expected_closing_date', nextWeek.toISOString().split('T')[0])
        .order('expected_closing_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    ...FAST_QUERY_OPTIONS,
  });
};

// Revenue target progress
export const useRevenueTarget = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-revenue-target', user?.id],
    queryFn: async () => {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);
      const yearEnd = new Date(now.getFullYear(), 11, 31);
      
      const { data: wonDeals, error } = await supabase
        .from('deals')
        .select('id, total_contract_value, signed_contract_date')
        .or(`created_by.eq.${user?.id},lead_owner.eq.${user?.id}`)
        .eq('stage', 'Won')
        .gte('signed_contract_date', yearStart.toISOString().split('T')[0])
        .lte('signed_contract_date', yearEnd.toISOString().split('T')[0]);
      
      if (error) throw error;
      
      const currentRevenue = (wonDeals || []).reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
      
      // Default target - can be made configurable
      const yearlyTarget = 1000000;
      const monthsElapsed = now.getMonth() + 1;
      const expectedProgress = (monthsElapsed / 12) * yearlyTarget;
      const progressPercentage = yearlyTarget > 0 ? Math.round((currentRevenue / yearlyTarget) * 100) : 0;
      const isOnTrack = currentRevenue >= expectedProgress;
      
      return {
        currentRevenue,
        yearlyTarget,
        progressPercentage: Math.min(progressPercentage, 100),
        isOnTrack,
        remaining: Math.max(0, yearlyTarget - currentRevenue),
      };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};

// Lead response time
export const useLeadResponseTime = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-lead-response-time', user?.id],
    queryFn: async () => {
      const thirtyDaysAgo = subDays(new Date(), 30);
      
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, created_time, last_contacted_at')
        .eq('created_by', user?.id)
        .gte('created_time', thirtyDaysAgo.toISOString());
      
      if (error) throw error;
      
      const contactedLeads = (leads || []).filter(l => l.last_contacted_at && l.created_time);
      
      if (contactedLeads.length === 0) {
        return { avgResponseHours: 0, totalLeads: leads?.length || 0, contactedCount: 0 };
      }
      
      const totalResponseHours = contactedLeads.reduce((sum, lead) => {
        const created = new Date(lead.created_time!);
        const contacted = new Date(lead.last_contacted_at!);
        const diffHours = (contacted.getTime() - created.getTime()) / (1000 * 60 * 60);
        return sum + Math.max(0, diffHours);
      }, 0);
      
      const avgResponseHours = Math.round(totalResponseHours / contactedLeads.length);
      
      return {
        avgResponseHours,
        totalLeads: leads?.length || 0,
        contactedCount: contactedLeads.length,
      };
    },
    enabled: !!user?.id,
    ...QUERY_OPTIONS,
  });
};
