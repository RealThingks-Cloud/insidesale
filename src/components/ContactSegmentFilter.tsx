import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ContactSegmentFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const segments = [
  { value: "all", label: "All Segments" },
  { value: "prospect", label: "Prospect" },
  { value: "customer", label: "Customer" },
  { value: "partner", label: "Partner" },
  { value: "vendor", label: "Vendor" },
];

export const ContactSegmentFilter = ({ value, onValueChange }: ContactSegmentFilterProps) => {
  const isFiltered = value && value !== "all";
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-40 relative", isFiltered && "border-primary")}>
        <SelectValue placeholder="Filter by segment" />
        {isFiltered && (
          <Badge 
            variant="default" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
          >
            1
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent>
        {segments.map((segment) => (
          <SelectItem key={segment.value} value={segment.value}>
            {segment.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
