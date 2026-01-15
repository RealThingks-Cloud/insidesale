import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailStats {
  entityId: string;
  totalEmails: number;
  lastSentAt: string | null;
  latestStatus: 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | null;
  hasReplies: boolean;
  hasBounce: boolean;
  openCount: number;
  replyCount: number;
  lastEmailSubject: string | null;
}

type EntityType = 'contact' | 'lead';

export const useEntityEmailStats = (entityType: EntityType, entityIds: string[]) => {
  return useQuery({
    queryKey: ['entity-email-stats', entityType, entityIds.sort().join(',')],
    queryFn: async () => {
      if (entityIds.length === 0) return {};

      const idField = entityType === 'contact' ? 'contact_id' : 'lead_id';
      
      const { data: emails, error } = await supabase
        .from('email_history')
        .select('id, contact_id, lead_id, status, sent_at, opened_at, replied_at, bounced_at, reply_count, open_count, subject')
        .in(idField, entityIds)
        .order('sent_at', { ascending: false });

      if (error) {
        console.error('Error fetching email stats:', error);
        return {};
      }

      // Aggregate stats per entity
      const statsMap: Record<string, EmailStats> = {};

      for (const entityId of entityIds) {
        const entityEmails = emails?.filter(e => 
          entityType === 'contact' ? e.contact_id === entityId : e.lead_id === entityId
        ) || [];

        if (entityEmails.length === 0) {
          statsMap[entityId] = {
            entityId,
            totalEmails: 0,
            lastSentAt: null,
            latestStatus: null,
            hasReplies: false,
            hasBounce: false,
            openCount: 0,
            replyCount: 0,
            lastEmailSubject: null,
          };
          continue;
        }

        // Calculate aggregates
        const totalEmails = entityEmails.length;
        const lastEmail = entityEmails[0]; // Already sorted by sent_at desc
        const hasReplies = entityEmails.some(e => (e.reply_count || 0) > 0 || e.status === 'replied');
        const hasBounce = entityEmails.some(e => e.status === 'bounced');
        const openCount = entityEmails.reduce((sum, e) => sum + (e.open_count || 0), 0);
        const replyCount = entityEmails.reduce((sum, e) => sum + (e.reply_count || 0), 0);

        // Determine latest status (priority: bounced > replied > opened > delivered > sent)
        let latestStatus: EmailStats['latestStatus'] = 'sent';
        if (hasBounce) {
          latestStatus = 'bounced';
        } else if (hasReplies) {
          latestStatus = 'replied';
        } else if (entityEmails.some(e => e.status === 'opened' || e.opened_at)) {
          latestStatus = 'opened';
        } else if (entityEmails.some(e => e.status === 'delivered')) {
          latestStatus = 'delivered';
        }

        statsMap[entityId] = {
          entityId,
          totalEmails,
          lastSentAt: lastEmail.sent_at,
          latestStatus,
          hasReplies,
          hasBounce,
          openCount,
          replyCount,
          lastEmailSubject: lastEmail.subject,
        };
      }

      return statsMap;
    },
    enabled: entityIds.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
