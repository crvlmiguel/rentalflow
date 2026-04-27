import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Reservations from "@/pages/Reservations";
import Customers from "@/pages/Customers";
import Vehicles from "@/pages/Vehicles";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import CalendarView from "@/pages/CalendarView";

function Loader() {
  return (
    <div className="min-h-screen grid place-items-center bg-zinc-50">
      <div className="font-display text-zinc-400 text-sm tracking-widest uppercase animate-pulse">
        Cargando RentaFlow…
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="/reservas" element={<Reservations />} />
            <Route path="/calendario" element={<CalendarView />} />
            <Route path="/clientes" element={<Customers />} />
            <Route path="/vehiculos" element={<Vehicles />} />
            <Route path="/pagos" element={<Payments />} />
            <Route path="/reportes" element={<Reports />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
