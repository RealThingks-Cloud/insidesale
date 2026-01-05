import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SystemUpdateForm from "./SystemUpdateForm";

interface SystemUpdate {
  id: string;
  device_name: string;
  os_version: string | null;
  update_version: string | null;
  patch_id: string | null;
  update_type: string | null;
  status: string | null;
  last_checked: string | null;
  installed_on: string | null;
  remarks: string | null;
  created_at: string;
}

const SystemUpdatesTab = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<SystemUpdate | null>(null);
  const queryClient = useQueryClient();

  const { data: updates = [], isLoading } = useQuery({
    queryKey: ["system_updates"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("system_updates" as any)
        .select("*") as any)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SystemUpdate[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: Record<string, string | null> = { status };
      if (status === "Installed") {
        updateData.installed_on = new Date().toISOString();
      }
      const { error } = await supabase
        .from("system_updates" as any)
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system_updates"] });
      toast.success("Status updated successfully");
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const filteredUpdates = updates.filter((update) => {
    const matchesSearch =
      update.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (update.patch_id?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || update.status === statusFilter;
    const matchesType = typeFilter === "all" || update.update_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalUpdates = updates.length;
  const installedCount = updates.filter((u) => u.status === "Installed").length;
  const compliancePercent = totalUpdates > 0 ? Math.round((installedCount / totalUpdates) * 100) : 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Installed":
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Installed</Badge>;
      case "Failed":
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "Pending":
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const getNextStatus = (currentStatus: string | null) => {
    switch (currentStatus) {
      case "Pending": return "Installed";
      case "Installed": return "Verified";
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Compliance Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Update Compliance</p>
              <p className="text-4xl font-bold text-primary">{compliancePercent}%</p>
              <p className="text-sm text-muted-foreground">{installedCount} of {totalUpdates} updates installed</p>
            </div>
            <div className="h-20 w-20 rounded-full border-4 border-primary flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{compliancePercent}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Device Name or Patch ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Installed">Installed</SelectItem>
            <SelectItem value="Failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Security">Security</SelectItem>
            <SelectItem value="Feature">Feature</SelectItem>
            <SelectItem value="Driver">Driver</SelectItem>
            <SelectItem value="Cumulative">Cumulative</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingUpdate(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Update
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>OS Version</TableHead>
                <TableHead>Update Version</TableHead>
                <TableHead>Patch ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead>Installed On</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredUpdates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No updates found</TableCell>
                </TableRow>
              ) : (
                filteredUpdates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell className="font-medium">{update.device_name}</TableCell>
                    <TableCell>{update.os_version || "-"}</TableCell>
                    <TableCell>{update.update_version || "-"}</TableCell>
                    <TableCell>{update.patch_id || "-"}</TableCell>
                    <TableCell>{update.update_type || "-"}</TableCell>
                    <TableCell>{getStatusBadge(update.status)}</TableCell>
                    <TableCell>{update.last_checked ? format(new Date(update.last_checked), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>{update.installed_on ? format(new Date(update.installed_on), "MMM d, yyyy") : "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {getNextStatus(update.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatusMutation.mutate({ id: update.id, status: getNextStatus(update.status)! })}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Mark {getNextStatus(update.status)}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditingUpdate(update); setShowForm(true); }}>
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <SystemUpdateForm
          update={editingUpdate}
          onClose={() => { setShowForm(false); setEditingUpdate(null); }}
        />
      )}
    </div>
  );
};

export default SystemUpdatesTab;
