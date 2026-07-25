import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  House, CalendarBlank, Users, Car, CreditCard, ChartBar,
  SignOut, List, X, CalendarDots
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Painel", icon: House, end: true, testid: "nav-dashboard" },
  { to: "/reservas", label: "Reservas", icon: CalendarBlank, testid: "nav-reservations" },
  { to: "/calendario", label: "Calendário", icon: CalendarDots, testid: "nav-calendar" },
  { to: "/clientes", label: "Clientes", icon: Users, testid: "nav-customers" },
  { to: "/vehiculos", label: "Veículos", icon: Car, testid: "nav-vehicles" },
  { to: "/pagos", label: "Pagamentos", icon: CreditCard, testid: "nav-payments" },
  { to: "/reportes", label: "Relatórios", icon: ChartBar, testid: "nav-reports" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  const Sidebar = (
    <aside
      className="w-64 bg-white border-r border-zinc-200 flex flex-col shrink-0 h-screen sticky top-0"
      data-testid="sidebar"
    >
      <div className="px-6 py-6 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 grid place-items-center">
            <Car size={18} weight="bold" className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-lg text-zinc-950">RentaFlow</div>
            <div className="text-[10px] tracking-[0.22em] uppercase text-zinc-400">Rent-a-Car OS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            data-testid={n.testid}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <n.icon size={18} weight="bold" />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-zinc-100 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full bg-zinc-100 grid place-items-center font-display font-bold text-zinc-700">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-900 truncate" data-testid="current-user-name">{user?.name}</div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500" data-testid="current-user-role">{user?.role}</div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="logout-button"
        >
          <SignOut size={16} weight="bold" />
          Terminar sessão
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">{Sidebar}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 animate-in slide-in-from-left duration-200">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-white">
          <button
            onClick={() => setOpen(true)}
            className="p-2 rounded-md hover:bg-zinc-100"
            data-testid="open-sidebar-button"
            aria-label="Abrir menu"
          >
            <List size={20} weight="bold" />
          </button>
          <div className="font-display font-bold text-zinc-950">RentaFlow</div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-zinc-100"
            data-testid="mobile-logout-button"
            aria-label="Terminar sessão"
          >
            <SignOut size={18} weight="bold" />
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[1500px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
