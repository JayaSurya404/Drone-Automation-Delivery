import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SystemHealthProvider } from './context/SystemHealthContext';
import { ToastProvider } from './context/ToastContext';
import { OperationsModalProvider } from './context/OperationsModalContext';

import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { SystemHealthDrawer } from './components/common/SystemHealthDrawer';
import { ToastContainer } from './components/common/ToastContainer';

// Pages
import { LoginScreen } from './pages/Auth/LoginScreen';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { LiveOperations } from './pages/Operations/LiveOperations';
import { OrdersPage } from './pages/Orders/OrdersPage';
import { ProductsPage } from './pages/Products/ProductsPage';
import { MissionsPage } from './pages/Missions/MissionsPage';
import { PackagesPage } from './pages/Packages/PackagesPage';
import { RoutesPage } from './pages/Routes/RoutesPage';
import { FleetPage } from './pages/Fleet/FleetPage';
import { BatteryHealthPage } from './pages/BatteryHealth/BatteryHealthPage';
import { MaintenancePage } from './pages/Maintenance/MaintenancePage';
import { CustomersPage } from './pages/Customers/CustomersPage';
import { MerchantsPage } from './pages/Merchants/MerchantsPage';
import { GeofencingPage } from './pages/Safety/GeofencingPage';
import { EmergencyPage } from './pages/Safety/EmergencyPage';
import { PaymentsPage } from './pages/Business/PaymentsPage';
import { AnalyticsPage } from './pages/Business/AnalyticsPage';
import { ReportsPage } from './pages/Business/ReportsPage';
import { NotificationsPage } from './pages/System/NotificationsPage';
import { SupportPage } from './pages/Support/SupportPage';
import { AuditLogsPage } from './pages/System/AuditLogsPage';
import { AdminManagementPage } from './pages/System/AdminManagementPage';
import { SettingsPage } from './pages/System/SettingsPage';
import { SimulationCenter } from './pages/Simulation/SimulationCenter';

// Main Layout Wrapper Component
const MainLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-white transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Top Navigation Header */}
      <TopNav
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
      />

      {/* Main Content Area */}
      <main
        className={`pt-20 px-3 sm:px-6 pb-12 transition-all duration-300 pl-3 ${
          sidebarCollapsed ? 'md:pl-24' : 'md:pl-72'
        }`}
      >
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* System Health Breakdown Drawer */}
      <SystemHealthDrawer />

      {/* Toast Notification Container */}
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SystemHealthProvider>
          <ToastProvider>
            <BrowserRouter>
              <OperationsModalProvider>
                <Routes>
                  <Route path="/login" element={<LoginScreen />} />

                  <Route element={<MainLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/simulation" element={<SimulationCenter />} />
                    <Route path="/operations" element={<LiveOperations />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/products" element={<ProductsPage />} />
                    <Route path="/missions" element={<MissionsPage />} />
                    <Route path="/packages" element={<PackagesPage />} />
                    <Route path="/routes" element={<RoutesPage />} />
                    <Route path="/fleet" element={<FleetPage />} />
                    <Route path="/battery-health" element={<BatteryHealthPage />} />
                    <Route path="/maintenance" element={<MaintenancePage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/merchants" element={<MerchantsPage />} />
                    <Route path="/geofencing" element={<GeofencingPage />} />
                    <Route path="/emergency" element={<EmergencyPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/support" element={<SupportPage />} />
                    <Route path="/audit-logs" element={<AuditLogsPage />} />
                    <Route path="/admins" element={<AdminManagementPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Route>
                </Routes>
              </OperationsModalProvider>
            </BrowserRouter>
          </ToastProvider>
        </SystemHealthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
