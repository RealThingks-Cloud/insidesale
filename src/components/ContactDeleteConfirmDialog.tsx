import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ContactDeleteConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isMultiple?: boolean;
  count?: number;
}

export const ContactDeleteConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  isMultiple = false,
  count = 1
}: ContactDeleteConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isMultiple ? `Delete ${count} Contacts?` : "Delete Contact?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isMultiple
              ? `Are you sure you want to delete ${count} contacts? This action cannot be undone.`
              : "Are you sure you want to delete this contact? This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
