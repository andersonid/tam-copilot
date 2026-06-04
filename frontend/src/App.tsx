import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AccountProvider } from "./context/AccountContext";
import { AppLayout } from "./components/AppLayout";
import { hasManagerPortfolio } from "./navigation/rbac";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { CasesPage } from "./pages/CasesPage";
import { ClustersPage } from "./pages/ClustersPage";
import { IssuesPage } from "./pages/IssuesPage";
import { ActionPlanPage } from "./pages/ActionPlanPage";
import { EntitlementsPage } from "./pages/EntitlementsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { LifecyclePage } from "./pages/LifecyclePage";
import { TouchpointsPage } from "./pages/TouchpointsPage";
import { RisksPage } from "./pages/RisksPage";
import { EngagementRoutePage } from "./pages/EngagementRoutePage";
import { TeamPage } from "./pages/TeamPage";
import { ManagerActionPlansPage } from "./pages/ManagerActionPlansPage";
import { ManagerReportsPage } from "./pages/ManagerReportsPage";
import { GuidesPage } from "./pages/GuidesPage";
import { GuideCreatePage } from "./pages/GuideCreatePage";
import { GuideDetailPage } from "./pages/GuideDetailPage";
import { GuideImportPage } from "./pages/GuideImportPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PublicGuidePage } from "./pages/PublicGuidePage";
import { TamReportPage } from "./pages/TamReportPage";
import { KcsArticlePage } from "./pages/KcsArticlePage";
import { AssessmentPage } from "./pages/AssessmentPage";
import { SchedulePage } from "./pages/SchedulePage";
import { AdminUsersPage } from "./pages/AdminUsersPage";

function AuthenticatedApp() {
  const { isAuthenticated, role } = useAuth();
  const mgmt = hasManagerPortfolio(role);
  const isAdmin = role === "admin";

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AccountProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/accounts" element={<AccountsPage />} />

          <Route path="/cases" element={<CasesPage />} />
          <Route path="/clusters" element={<ClustersPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/action-plan" element={<ActionPlanPage />} />
          <Route path="/entitlements" element={<EntitlementsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/touchpoints" element={<TouchpointsPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/engagement" element={<EngagementRoutePage />} />

          {mgmt && (
            <>
              <Route path="/team" element={<TeamPage />} />
              <Route path="/action-plans" element={<ManagerActionPlansPage />} />
              <Route path="/reports" element={<ManagerReportsPage />} />
            </>
          )}

          <Route path="/manager" element={<Navigate to={mgmt ? "/team" : "/"} replace />} />
          <Route
            path="/manager/action-plans"
            element={<Navigate to={mgmt ? "/action-plans" : "/"} replace />}
          />
          <Route path="/manager/engagement" element={<Navigate to="/engagement" replace />} />
          <Route
            path="/manager/reports"
            element={<Navigate to={mgmt ? "/reports" : "/"} replace />}
          />

          <Route path="/content" element={<GuidesPage />} />
          <Route path="/content/report" element={<TamReportPage />} />
          <Route path="/content/kcs" element={<KcsArticlePage />} />
          <Route path="/content/assessment" element={<AssessmentPage />} />
          <Route path="/content/schedule" element={<SchedulePage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/guides/new" element={<GuideCreatePage />} />
          <Route path="/guides/import" element={<GuideImportPage />} />
          <Route path="/guides/:id" element={<GuideDetailPage />} />

          {isAdmin && (
            <>
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </>
          )}

          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </AccountProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/public/guides/:id" element={<PublicGuidePage />} />
            <Route path="/*" element={<AuthenticatedApp />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
