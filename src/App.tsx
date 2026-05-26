import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BudgetEntry from "./pages/BudgetEntry";
import DailyActuals from "./pages/DailyActuals";
import DailyOperations from "./pages/DailyOperations";
import OperationsSummary from "./pages/OperationsSummary";
import Reports from "./pages/Reports";
import KPISummary from "./pages/KPISummary";
import ProgramRankings from "./pages/ProgramRankings";
import Admin from "./pages/Admin";
import Facilities from "./pages/Facilities";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/budget" element={<BudgetEntry />} />
              <Route path="/actuals" element={<DailyActuals />} />
              <Route path="/operations" element={<DailyOperations />} />
              <Route path="/operations/summary" element={<OperationsSummary />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/kpi-summary" element={<KPISummary />} />
               <Route path="/reports/program-rankings" element={<ProgramRankings />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/facilities" element={<Facilities />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
