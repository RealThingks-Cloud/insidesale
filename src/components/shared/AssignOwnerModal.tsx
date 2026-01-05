import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, UserCheck } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string | null;
}

interface AssignOwnerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'accounts' | 'contacts' | 'leads' | 'deals';
  selectedIds: string[];
  ownerField: string;
  onSuccess: () => void;
}

export const AssignOwnerModal = ({
  open,
  onOpenChange,
  entityType,
  selectedIds,
  ownerField,
  onSuccess,
}: AssignOwnerModalProps) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setFetching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from(entityType)
        .update({ [ownerField]: selectedUserId })
        .in('id', selectedIds);

      if (error) throw error;

      const selectedUser = users.find(u => u.id === selectedUserId);
      toast({
        title: 'Success',
        description: `Assigned ${selectedIds.length} ${entityType} to ${selectedUser?.full_name || 'user'}`,
      });

      onSuccess();
      onOpenChange(false);
      setSelectedUserId('');
    } catch (error) {
      console.error('Error assigning owner:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign owner. You may not have permission to update some records.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
      'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500'
    ];
    const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Assign Owner
          </DialogTitle>
          <DialogDescription>
            Assign {selectedIds.length} {entityType} to a new owner
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Owner</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={fetching ? 'Loading...' : 'Select a user'} />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className={`h-6 w-6 ${getAvatarColor(user.id)}`}>
                        <AvatarFallback className="text-xs text-white">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.full_name || 'Unknown User'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={loading || !selectedUserId}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign to {selectedIds.length} {entityType}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
