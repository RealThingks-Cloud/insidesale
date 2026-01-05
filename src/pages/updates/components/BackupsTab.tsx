import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, HardDrive, CheckCircle, XCircle, Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import BackupForm from "./BackupForm";

interface BackupRecord {
  id: string;
  file_name: string;
  backup_type: string;
  status: string;
  created_at: string;
  records_count: number | null;
  size_bytes: number | null;
  created_by: string | null;
}

const BackupsTab = () => {
  const [showForm, setShowForm] = useState(false);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BackupRecord[];
    },
  });

  // Weekly chart data
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeklyData = weekDays.map((day) => {
    const dayBackups = backups.filter((b) =>
      isWithinInterval(new Date(b.created_at), {
        start: new Date(day.setHours(0, 0, 0, 0)),
        end: new Date(day.setHours(23, 59, 59, 999)),
      })
    );
    const successCount = dayBackups.filter((b) => b.status === "completed").length;
    const failedCount = dayBackups.filter((b) => b.status === "failed").length;
    return {
      day: format(day, "EEE"),
      success: successCount,
      failed: failedCount,
    };
  });

  const totalBackups = backups.length;
  const successfulBackups = backups.filter((b) => b.status === "completed").length;
  const successRate = totalBackups > 0 ? Math.round((successfulBackups / totalBackups) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "pending":
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <HardDrive className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Backups</p>
                <p className="text-2xl font-bold">{totalBackups}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{successRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <XCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">{backups.filter((b) => b.status === "failed").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Backup Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-muted-foreground" />
                <YAxis className="text-muted-foreground" />
                <Tooltip />
                <Bar dataKey="success" stackId="a" fill="hsl(var(--primary))" name="Success" />
                <Bar dataKey="failed" stackId="a" fill="hsl(var(--destructive))" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Backup Record
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Backup Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No backup records</TableCell>
                </TableRow>
              ) : (
                backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{backup.file_name}</TableCell>
                    <TableCell>{backup.backup_type}</TableCell>
                    <TableCell>{format(new Date(backup.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell>{formatSize(backup.size_bytes)}</TableCell>
                    <TableCell>{backup.records_count ?? "-"}</TableCell>
                    <TableCell>{getStatusBadge(backup.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {showForm && <BackupForm onClose={() => setShowForm(false)} />}
    </div>
  );
};

export default BackupsTab;
