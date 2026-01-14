import { useEffect, useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Generate mock data
const mockData = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Company ${i + 1}`,
  email: `contact${i + 1}@company${i + 1}.com`,
  status: i % 3 === 0 ? "Active" : i % 3 === 1 ? "Pending" : "Inactive",
  revenue: Math.floor(Math.random() * 1000000),
}));

const StickyHeaderTest = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on mount to demonstrate sticky behavior
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 300;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Sticky Header Test</h1>
        <p className="text-muted-foreground">
          This page auto-scrolls on load. If the header stays visible at the top while
          content is scrolled, sticky headers are working correctly.
        </p>
      </div>

      {/* Fixed height container with overflow - simulates the module table layout */}
      <div className="border rounded-lg bg-card" style={{ height: "calc(100vh - 200px)" }}>
        <div
          ref={scrollContainerRef}
          className="relative overflow-auto h-full"
        >
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-20 bg-muted">
                <TableHead>ID</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.id}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>${row.revenue.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-4 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Expected behavior:</strong> The header row (ID, Company Name, Email, Status, Revenue) 
          should remain fixed at the top of the table area while the data rows scroll beneath it.
        </p>
      </div>
    </div>
  );
};

export default StickyHeaderTest;
