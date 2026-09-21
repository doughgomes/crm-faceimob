import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import Equipes from "@/pages/Equipes";
import AdminPermissions from "@/pages/AdminPermissions";
import DailyReport from "@/pages/DailyReport";
import Checkpoint from "@/pages/Checkpoint";
import MeusCheckpoints from "@/pages/MeusCheckpoints";
import AdminDailyTeams from "@/pages/AdminDailyTeams";
import AdminAllowedIps from "@/pages/AdminAllowedIps";
import PublicDirectorCheckpoint from "@/pages/PublicDirectorCheckpoint";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RequireAuth() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Carregando...</div>;
  }

  return session ? <AppLayout /> : <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateNotifier />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/daily/:teamId/:slug" element={<DailyReport />} />
            <Route path="/daily/:slug" element={<DailyReport />} />
            <Route path="/diretor/:slug" element={<PublicDirectorCheckpoint />} />
            <Route path="/" element={<Navigate to="/checkpoint" replace />} />
            <Route element={<RequireAuth />}>
              {/* App focado em Checkpoint */}
              <Route path="/checkpoint" element={<Checkpoint />} />
              <Route path="/meus-checkpoints" element={<MeusCheckpoints />} />
              <Route path="/equipes" element={<Equipes />} />
              <Route path="/admin/permissions" element={<AdminPermissions />} />
              <Route path="/admin/daily-teams" element={<AdminDailyTeams />} />
              <Route path="/admin/allowed-ips" element={<AdminAllowedIps />} />

              {/* Rotas antigas — redirecionam para o checkpoint */}
              <Route path="/dashboard" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/pipeline" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/cca" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/leads" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/resultados" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/marketing" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/links" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/data" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/settings" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/team" element={<Navigate to="/equipes" replace />} />
              <Route path="/profile" element={<Navigate to="/equipes" replace />} />
              <Route path="/admin/teams" element={<Navigate to="/equipes" replace />} />
              <Route path="/admin/developers" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/admin/meta-ads" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/admin/lead-automation" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/admin/daily-bi" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/checkin" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/gamification" element={<Navigate to="/checkpoint" replace />} />
              <Route path="/sdr" element={<Navigate to="/checkpoint" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
