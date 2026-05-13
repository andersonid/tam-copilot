import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AccountProvider } from "./context/AccountContext";
import { AppLayout } from "./components/AppLayout";
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
import { EngagementPage } from "./pages/EngagementPage";
import { ManagerPage } from "./pages/ManagerPage";
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

function AuthenticatedApp() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AccountProvider>
      <AppLayout>
        <Routes>
          {/* Dashboard */}
          <Route path="/" element={<DashboardPage />} />

          {/* Account management */}
          <Route path="/accounts" element={<AccountsPage />} />

          {/* Contextual pages (filtered by account context switcher) */}
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/clusters" element={<ClustersPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/action-plan" element={<ActionPlanPage />} />
          <Route path="/entitlements" element={<EntitlementsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/lifecycle" element={<LifecyclePage />} />
          <Route path="/touchpoints" element={<TouchpointsPage />} />
          <Route path="/risks" element={<RisksPage />} />
          <Route path="/engagement" element={<EngagementPage />} />

          {/* Manager dashboard */}
          <Route path="/manager" element={<ManagerPage />} />

          {/* Content generation (evolved from Guides) */}
          <Route path="/content" element={<GuidesPage />} />
          <Route path="/content/report" element={<TamReportPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/guides/new" element={<GuideCreatePage />} />
          <Route path="/guides/import" element={<GuideImportPage />} />
          <Route path="/guides/:id" element={<GuideDetailPage />} />

          {/* Administration */}
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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
