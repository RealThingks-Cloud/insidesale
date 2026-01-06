// RT-CRM Application
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import SecurityEnhancedApp from "@/components/SecurityEnhancedApp";
import { AppSidebar } from "@/components/AppSidebar";
import PageAccessGuard from "@/components/PageAccessGuard";
import { useState, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load all page components for code-splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Leads = lazy(() => import("./pages/Leads"));
const Meetings = lazy(() => import("./pages/Meetings"));
const DealsPage = lazy(() => import("./pages/DealsPage"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Tasks = lazy(() => import("./pages/Tasks"));
const StickyHeaderTest = lazy(() => import("./pages/StickyHeaderTest"));

// QueryClient with optimized defaults to reduce refetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - data stays fresh, no refetch on mount
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnWindowFocus: false, // Don't refetch when user switches tabs
      retry: 1, // Reduce retries to avoid long waits
    },
  },
});

// Loading fallback for auth page (full screen)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Lightweight content loader - shows skeleton in content area only
const ContentLoader = () => (
  <div className="h-screen flex flex-col bg-background p-6">
    <Skeleton className="h-8 w-48 mb-6" />
    <div className="space-y-4 flex-1">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

// Layout Component for all pages with fixed sidebar
const FixedSidebarLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start collapsed
  
  return (
    <div className="min-h-screen flex w-full">
      <div className="fixed top-0 left-0 z-50 h-full">
        <AppSidebar isFixed={true} isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      </div>
      <main 
        className="flex-1 bg-background min-h-screen"
        style={{ 
          marginLeft: sidebarOpen ? '12.5rem' : '4rem',
          transition: 'margin-left 300ms ease-in-out',
          width: `calc(100vw - ${sidebarOpen ? '12.5rem' : '4rem'})`
        }}
      >
        <div className="w-full h-full overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

// Protected Route Component with Page Access Control
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Use FixedSidebarLayout for all protected routes with Page Access Guard
  // Suspense is inside layout so sidebar stays visible while content loads
  return (
    <FixedSidebarLayout>
      <PageAccessGuard>
        <Suspense fallback={<ContentLoader />}>
          {children}
        </Suspense>
      </PageAccessGuard>
    </FixedSidebarLayout>
  );
};

// Auth Route Component (redirects if already authenticated)
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// App Router Component - Suspense moved inside ProtectedRoute for instant sidebar
const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      {/* Public test route for sticky header verification */}
      <Route path="/sticky-header-test" element={
        <Suspense fallback={<PageLoader />}>
          <StickyHeaderTest />
        </Suspense>
      } />
      <Route path="/auth" element={
        <Suspense fallback={<PageLoader />}>
          <AuthRoute>
            <Auth />
          </AuthRoute>
        </Suspense>
      } />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/accounts" element={
        <ProtectedRoute>
          <Accounts />
        </ProtectedRoute>
      } />
      <Route path="/contacts" element={
        <ProtectedRoute>
          <Contacts />
        </ProtectedRoute>
      } />
      <Route path="/leads" element={
        <ProtectedRoute>
          <Leads />
        </ProtectedRoute>
      } />
      <Route path="/meetings" element={
        <ProtectedRoute>
          <Meetings />
        </ProtectedRoute>
      } />
      <Route path="/deals" element={
        <ProtectedRoute>
          <DealsPage />
        </ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute>
          <Notifications />
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <Tasks />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="*" element={
        <ProtectedRoute>
          <NotFound />
        </ProtectedRoute>
      } />
    </Routes>
  </BrowserRouter>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SecurityEnhancedApp>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRouter />
      </TooltipProvider>
    </SecurityEnhancedApp>
  </QueryClientProvider>
);

export default App;
