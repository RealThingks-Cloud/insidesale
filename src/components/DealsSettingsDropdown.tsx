import React from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Upload, Download, Columns, Trash2 } from "lucide-react";
import { Deal } from "@/types/deal";
import { useDealsImportExport } from "@/hooks/useDealsImportExport";

interface DealsSettingsDropdownProps {
  deals: Deal[];
  onRefresh: () => void;
  selectedDeals?: Deal[];
  onColumnCustomize?: () => void;
  showColumns?: boolean;
  onBulkDelete?: () => void;
  selectedCount?: number;
}

export const DealsSettingsDropdown = ({ 
  deals, 
  onRefresh, 
  selectedDeals = [], 
  onColumnCustomize,
  showColumns = false,
  onBulkDelete,
  selectedCount = 0
}: DealsSettingsDropdownProps) => {
  const { handleImport, handleExportAll, handleExportSelected } = useDealsImportExport({
    onRefresh
  });

  const handleExportClick = () => {
    if (selectedDeals.length > 0) {
      const selectedIds = selectedDeals.map(deal => deal.id);
      handleExportSelected(deals, selectedIds);
    } else {
      handleExportAll(deals);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          await handleImport(file);
        } catch (error) {
          console.error('Import failed:', error);
        }
      }
    };
    input.click();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover border z-50 w-48">
        {showColumns && onColumnCustomize && (
          <DropdownMenuItem onClick={onColumnCustomize}>
            <Columns className="w-4 h-4 mr-2" />
            Columns
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleImportClick}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportClick}>
          <Download className="w-4 h-4 mr-2" />
          Export {selectedDeals.length > 0 ? `(${selectedDeals.length})` : 'CSV'}
        </DropdownMenuItem>
        {onBulkDelete && (
          <DropdownMenuItem 
            onClick={onBulkDelete} 
            disabled={selectedCount === 0}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedCount})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
