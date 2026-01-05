import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export interface ContactColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

interface ContactColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ContactColumnConfig[];
  onColumnsChange: (columns: ContactColumnConfig[]) => void;
  onSave?: (columns: ContactColumnConfig[]) => Promise<unknown>;
  isSaving?: boolean;
}

// Updated default columns with all available fields
export const defaultContactColumns: ContactColumnConfig[] = [
  { field: 'contact_name', label: 'Contact Name', visible: true, order: 0 },
  { field: 'account_company_name', label: 'Company Name', visible: true, order: 1 },
  { field: 'position', label: 'Position', visible: true, order: 2 },
  { field: 'email', label: 'Email', visible: true, order: 3 },
  { field: 'phone_no', label: 'Phone', visible: true, order: 4 },
  { field: 'region', label: 'Region', visible: true, order: 5 },
  { field: 'contact_owner', label: 'Contact Owner', visible: true, order: 6 },
  { field: 'industry', label: 'Industry', visible: false, order: 7 },
  { field: 'contact_source', label: 'Source', visible: true, order: 8 },
  { field: 'linkedin', label: 'LinkedIn', visible: false, order: 9 },
  { field: 'website', label: 'Website', visible: false, order: 10 },
  { field: 'segment', label: 'Segment', visible: false, order: 11 },
  { field: 'score', label: 'Score', visible: false, order: 12 },
  { field: 'tags', label: 'Tags', visible: false, order: 13 },
  { field: 'engagement_score', label: 'Engagement Score', visible: false, order: 14 },
  { field: 'email_opens', label: 'Email Opens', visible: false, order: 15 },
  { field: 'email_clicks', label: 'Email Clicks', visible: false, order: 16 },
  { field: 'last_contacted_at', label: 'Last Contacted', visible: false, order: 17 },
  { field: 'created_time', label: 'Created Date', visible: false, order: 18 },
];

export const ContactColumnCustomizer = ({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
  onSave,
  isSaving = false,
}: ContactColumnCustomizerProps) => {
  const [localColumns, setLocalColumns] = useState<ContactColumnConfig[]>(columns);

  // Sync local columns when props change, merging new columns if they don't exist
  useEffect(() => {
    const existingFields = new Set(columns.map(c => c.field));
    const missingColumns = defaultContactColumns.filter(dc => !existingFields.has(dc.field));
    
    // Filter out invalid columns that are not in the default columns list
    const validColumns = columns.filter(c => 
      defaultContactColumns.some(dc => dc.field === c.field)
    );
    
    if (missingColumns.length > 0 || validColumns.length !== columns.length) {
      setLocalColumns([...validColumns, ...missingColumns]);
    } else {
      setLocalColumns(columns);
    }
  }, [columns]);

  const handleVisibilityChange = (field: string, visible: boolean) => {
    const updatedColumns = localColumns.map(col =>
      col.field === field ? { ...col, visible } : col
    );
    setLocalColumns(updatedColumns);
  };

  const handleSave = async () => {
    onColumnsChange(localColumns);
    if (onSave) {
      await onSave(localColumns);
    }
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalColumns(defaultContactColumns);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Tip:</strong> Check/uncheck to show/hide columns in the contact table.
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto p-1">
            {localColumns.map((column) => (
              <div
                key={column.field}
                className="flex items-center space-x-3 p-3 border rounded-lg bg-card hover:bg-muted/30"
              >
                <Checkbox
                  id={column.field}
                  checked={column.visible}
                  onCheckedChange={(checked) =>
                    handleVisibilityChange(column.field, Boolean(checked))
                  }
                />

                <Label
                  htmlFor={column.field}
                  className="flex-1 cursor-pointer"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
