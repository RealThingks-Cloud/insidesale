import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";
import MaintenanceForm from "./MaintenanceForm";

interface MaintenanceRecord {
  id: string;
  asset_name: string;
  maintenance_type: string | null;
  scheduled_date: string;
  performed_by: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

const MaintenanceTab = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const { data: maintenance = [], isLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("maintenance" as any)
        .select("*") as any)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return (data || []) as MaintenanceRecord[];
    },
  });

  const upcomingMaintenance = maintenance.filter(
    (m) => m.status === "Scheduled" && !isPast(new Date(m.scheduled_date))
  );
  const overdueCount = maintenance.filter(
    (m) => m.status === "Scheduled" && isPast(new Date(m.scheduled_date)) && !isToday(new Date(m.scheduled_date))
  ).length;

  const getStatusBadge = (status: string | null, scheduledDate: string) => {
    const date = new Date(scheduledDate);
    if (status === "Completed") {
      return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
    }
    if (isPast(date) && !isToday(date)) {
      return <Badge className="bg-red-500/20 text-red-700 border-red-500/30"><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</Badge>;
    }
    if (isBefore(date, addDays(new Date(), 1))) {
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Due Soon</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30"><Calendar className="h-3 w-3 mr-1" /> Scheduled</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-2xl font-bold">{upcomingMaintenance.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{maintenance.filter((m) => m.status === "Completed").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => { setEditingRecord(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Schedule Maintenance
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : maintenance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No maintenance records</TableCell>
                </TableRow>
              ) : (
                maintenance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.asset_name}</TableCell>
                    <TableCell>{record.maintenance_type || "-"}</TableCell>
                    <TableCell>{format(new Date(record.scheduled_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{record.performed_by || "-"}</TableCell>
                    <TableCell>{getStatusBadge(record.status, record.scheduled_date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.notes || "-"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingRecord(record); setShowForm(true); }}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && (
        <MaintenanceForm
          record={editingRecord}
          onClose={() => { setShowForm(false); setEditingRecord(null); }}
        />
      )}
    </div>
  );
};

export default MaintenanceTab;
