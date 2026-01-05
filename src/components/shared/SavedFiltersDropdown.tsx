import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Bookmark, Plus, Trash2, Check } from 'lucide-react';
import { useSavedFilters, SavedFilter } from '@/hooks/useSavedFilters';
import { useToast } from '@/hooks/use-toast';

interface SavedFiltersDropdownProps {
  filterType: string;
  currentFilters: Record<string, any>;
  onApplyFilter: (filters: Record<string, any>) => void;
  hasActiveFilters: boolean;
}

export const SavedFiltersDropdown = ({
  filterType,
  currentFilters,
  onApplyFilter,
  hasActiveFilters,
}: SavedFiltersDropdownProps) => {
  const { savedFilters, saveFilter, deleteFilter, loading } = useSavedFilters(filterType);
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a filter name',
        variant: 'destructive',
      });
      return;
    }

    const success = await saveFilter(filterName, currentFilters);
    if (success) {
      setFilterName('');
      setSaveDialogOpen(false);
    }
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    onApplyFilter(filter.filters);
    toast({
      title: 'Filter applied',
      description: `Applied "${filter.name}" filter`,
    });
  };

  const handleDeleteFilter = async (e: React.MouseEvent, filterId: string) => {
    e.stopPropagation();
    await deleteFilter(filterId);
    if (activeFilterId === filterId) {
      setActiveFilterId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved Filters</span>
            {savedFilters.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {savedFilters.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {hasActiveFilters && (
            <>
              <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Save Current Filter
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          {savedFilters.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved filters yet
            </div>
          ) : (
            savedFilters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                onClick={() => handleApplyFilter(filter)}
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  {activeFilterId === filter.id && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                  <span className={activeFilterId === filter.id ? 'font-medium' : ''}>
                    {filter.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDeleteFilter(e, filter.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., High Priority Leads"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFilter()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFilter}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
