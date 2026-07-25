import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CalendarBlank, Car, CurrencyDollar, Clock, Plus, ArrowUpRight } from "@phosphor-icons/react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import StatusBadge from "@/components/StatusBadge";

const fmt = (n) => `$${Number(n || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function MetricCard({ label, value, sub, icon: Icon, accent, testid }) {
  return (
    <div className="app-card p-6" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className="label-uppercase">{label}</div>
        <div className={`h-9 w-9 rounded-lg grid place-items-center ${accent}`}>
          <Icon size={18} weight="bold" />
        </div>
      </div>
      <div className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 mt-4" data-testid={`${testid}-value`}>
        {value}
      </div>
      {sub && <div className="text-sm text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  if (!stats) {
    return <div className="text-zinc-500" data-testid="dashboard-loading">A carregar…</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Painel</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
            Resumo operacional
          </h1>
          <p className="text-zinc-500 mt-1">Estado atual da sua frota e reservas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/vehiculos">
            <Button variant="outline" data-testid="quick-add-vehicle">
              <Car size={16} weight="bold" className="mr-1.5" /> Veículo
            </Button>
          </Link>
          <Link to="/reservas">
            <Button className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="quick-add-reservation">
              <Plus size={16} weight="bold" className="mr-1.5" /> Nova reserva
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          label="Alugueres ativos"
          value={stats.active_rentals}
          sub="Reservas em curso ou confirmadas"
          icon={CalendarBlank}
          accent="bg-blue-50 text-blue-700"
          testid="metric-active-rentals"
        />
        <MetricCard
          label="Veículos disponíveis"
          value={`${stats.available_vehicles}/${stats.total_vehicles}`}
          sub="Prontos para alugar"
          icon={Car}
          accent="bg-emerald-50 text-emerald-700"
          testid="metric-available-vehicles"
        />
        <MetricCard
          label="Receita total"
          value={fmt(stats.total_revenue)}
          sub="Pagamentos cobrados acumulados"
          icon={CurrencyDollar}
          accent="bg-zinc-900 text-white"
          testid="metric-total-revenue"
        />
        <MetricCard
          label="Pagamentos pendentes"
          value={fmt(stats.pending_payments)}
          sub="Saldo a receber"
          icon={Clock}
          accent="bg-amber-50 text-amber-700"
          testid="metric-pending-payments"
        />
      </div>

      {/* Chart + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="app-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-uppercase">Receita · 7 dias</div>
              <div className="font-display text-xl font-semibold text-zinc-950 mt-1">Tendência recente</div>
            </div>
          </div>
          <div className="h-64" data-testid="revenue-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.revenue_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: 0, borderRadius: 8, color: "white", fontSize: 12 }}
                  formatter={(v) => [fmt(v), "Receita"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: "#2563eb" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="app-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-uppercase">Reservas recentes</div>
              <div className="font-display text-xl font-semibold text-zinc-950 mt-1">Últimas 5</div>
            </div>
            <Link to="/reservas" className="text-sm font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1" data-testid="view-all-reservations">
              Ver tudo <ArrowUpRight size={14} weight="bold" />
            </Link>
          </div>
          <div className="space-y-3" data-testid="recent-reservations-list">
            {stats.recent_reservations.length === 0 && (
              <div className="text-sm text-zinc-500 py-8 text-center">Ainda sem reservas.</div>
            )}
            {stats.recent_reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-zinc-100 last:border-0">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-zinc-500">{r.reservation_number}</div>
                  <div className="font-medium text-zinc-900 text-sm truncate">{r.customer_name}</div>
                  <div className="text-xs text-zinc-500 truncate">{r.vehicle_name}</div>
                </div>
                <StatusBadge status={r.status} kind="reservation" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
