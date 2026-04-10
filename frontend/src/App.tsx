import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuidesPage } from "./pages/GuidesPage";
import { GuideCreatePage } from "./pages/GuideCreatePage";
import { GuideDetailPage } from "./pages/GuideDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PublicGuidePage } from "./pages/PublicGuidePage";

function AuthenticatedApp() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/guides" element={<GuidesPage />} />
        <Route path="/guides/new" element={<GuideCreatePage />} />
        <Route path="/guides/:id" element={<GuideDetailPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
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
