import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadSimple, ChartBar } from "@phosphor-icons/react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { API } from "@/lib/api";

const fmt = (n) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Reports() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/reports/summary", { params: { period } }).then(({ data }) => setData(data));
  }, [period]);

  const exportCSV = async () => {
    const res = await fetch(`${API}/reports/export?period=${period}`, { credentials: "include" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `reporte_${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="text-zinc-500" data-testid="reports-loading">Cargando…</div>;

  return (
    <div className="space-y-8 animate-fade-in" data-testid="reports-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Analítica</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Reportes</h1>
          <p className="text-zinc-500 mt-1">Métricas e insights de tu operación.</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="week" data-testid="report-period-week">Semana</TabsTrigger>
              <TabsTrigger value="month" data-testid="report-period-month">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={exportCSV} data-testid="export-csv-button">
            <DownloadSimple size={16} weight="bold" className="mr-1.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="app-card p-6" data-testid="report-rentals-card">
          <div className="label-uppercase">Total alquileres</div>
          <div className="font-display text-4xl font-bold text-zinc-950 mt-3">{data.total_rentals}</div>
        </div>
        <div className="app-card p-6" data-testid="report-revenue-card">
          <div className="label-uppercase">Ingresos</div>
          <div className="font-display text-4xl font-bold text-zinc-950 mt-3">{fmt(data.revenue)}</div>
        </div>
        <div className="app-card p-6" data-testid="report-pending-card">
          <div className="label-uppercase">Saldo pendiente</div>
          <div className="font-display text-4xl font-bold text-zinc-950 mt-3">{fmt(data.pending_payments)}</div>
        </div>
      </div>

      <div className="app-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <ChartBar size={18} weight="bold" />
          <div className="label-uppercase">Top vehículos</div>
        </div>
        <div className="font-display text-xl font-semibold text-zinc-950 mb-5">Más alquilados</div>

        {data.top_vehicles.length === 0 ? (
          <div className="text-zinc-500 text-center py-12">Sin datos en este período.</div>
        ) : (
          <>
            <div className="h-64 mb-6" data-testid="top-vehicles-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top_vehicles} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#71717a" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
                  <Tooltip contentStyle={{ background: "#09090b", border: 0, borderRadius: 8, color: "white", fontSize: 12 }} />
                  <Bar dataKey="rentals" fill="#2563eb" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="top-vehicles-table">
                <thead className="bg-zinc-50 text-zinc-500">
                  <tr>
                    <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Vehículo</th>
                    <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Placa</th>
                    <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Alquileres</th>
                    <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_vehicles.map(v => (
                    <tr key={v.vehicle_id} className="border-t border-zinc-100">
                      <td className="py-3 px-4">{v.name}</td>
                      <td className="py-3 px-4 font-mono text-xs">{v.license_plate}</td>
                      <td className="py-3 px-4 text-right font-semibold">{v.rentals}</td>
                      <td className="py-3 px-4 text-right font-display font-semibold">{fmt(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
