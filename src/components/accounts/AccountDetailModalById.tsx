import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccountDetailModal } from "./AccountDetailModal";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Account {
  id: string;
  company_name: string;
  email?: string | null;
  website?: string | null;
  phone?: string | null;
  industry?: string | null;
  region?: string | null;
  country?: string | null;
  status?: string | null;
  notes?: string | null;
  company_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AccountDetailModalByIdProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string | null;
  onUpdate?: () => void;
}

export const AccountDetailModalById = ({ 
  open, 
  onOpenChange, 
  accountId,
  onUpdate 
}: AccountDetailModalByIdProps) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && accountId) {
      fetchAccount();
    } else if (!open) {
      setAccount(null);
    }
  }, [open, accountId]);

  const fetchAccount = async () => {
    if (!accountId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .maybeSingle();

      if (error) throw error;
      setAccount(data);
    } catch (error) {
      console.error('Error fetching account:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AccountDetailModal
      open={open}
      onOpenChange={onOpenChange}
      account={account}
      onUpdate={() => {
        fetchAccount();
        onUpdate?.();
      }}
    />
  );
};
