import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LandingPage } from "./pages/Landing";
import { LoginPage } from "./pages/Login";
import { RegisterPage } from "./pages/Register";
import { DashboardPage } from "./pages/Dashboard";
import { OnboardingPage } from "./pages/onboarding/OnboardingPage";
import { CodesPage } from "./pages/CodesPage";
import { EngagementsPage } from "./pages/EngagementsPage";
import { CrsTestPage } from "./pages/CrsTestPage";
import { TrackingPage } from "./pages/TrackingPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app/onboarding" element={<OnboardingPage />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="tracking" element={<TrackingPage />} />
          <Route path="crs/test" element={<CrsTestPage />} />
          <Route path="engagements" element={<EngagementsPage />} />
          <Route path="athletes" element={<Navigate to="/app/engagements" replace />} />
          <Route path="codes" element={<CodesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
