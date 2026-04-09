import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { GuidesPage } from "./pages/GuidesPage";
import { GuideCreatePage } from "./pages/GuideCreatePage";
import { GuideDetailPage } from "./pages/GuideDetailPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { SearchPage } from "./pages/SearchPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/guides/new" element={<GuideCreatePage />} />
          <Route path="/guides/:id" element={<GuideDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
