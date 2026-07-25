import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import StatusBadge from "@/components/StatusBadge";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad(n) { return n.toString().padStart(2, "0"); }
function iso(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function CalendarView() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);

  const { gridStart, gridEnd, daysInGrid } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const startWeekday = (first.getDay() + 6) % 7; // Monday=0
    const gridStart = new Date(first); gridStart.setDate(1 - startWeekday);
    const totalCells = Math.ceil((startWeekday + last.getDate()) / 7) * 7;
    const gridEnd = new Date(gridStart); gridEnd.setDate(gridStart.getDate() + totalCells - 1);
    const days = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    return { gridStart, gridEnd, daysInGrid: days };
  }, [cursor]);

  useEffect(() => {
    api.get("/reservations/calendar", { params: { start: iso(gridStart), end: iso(gridEnd) } })
      .then(({ data }) => setItems(data));
  }, [gridStart, gridEnd]);

  const eventsByDay = useMemo(() => {
    const map = {};
    daysInGrid.forEach(d => { map[iso(d)] = []; });
    items.forEach((r) => {
      const start = new Date(r.pickup_date);
      const end = new Date(r.return_date);
      for (const d of daysInGrid) {
        const di = iso(d);
        if (d >= start && d <= end) (map[di] = map[di] || []).push(r);
      }
    });
    return map;
  }, [items, daysInGrid]);

  const today = iso(new Date());

  return (
    <div className="space-y-6 animate-fade-in" data-testid="calendar-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Vista mensal</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Calendário</h1>
          <p className="text-zinc-500 mt-1">Disponibilidade e reservas ativas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} data-testid="calendar-prev">
            <CaretLeft size={16} weight="bold" />
          </Button>
          <div className="font-display text-xl font-semibold w-44 text-center" data-testid="calendar-current-month">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} data-testid="calendar-next">
            <CaretRight size={16} weight="bold" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} data-testid="calendar-today">
            Hoje
          </Button>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
          {DAYS.map(d => (
            <div key={d} className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 py-3 px-3 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" data-testid="calendar-grid">
          {daysInGrid.map((d, i) => {
            const di = iso(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = di === today;
            const evts = eventsByDay[di] || [];
            return (
              <div
                key={i}
                className={`min-h-[110px] border-r border-b border-zinc-100 p-2 ${inMonth ? "bg-white" : "bg-zinc-50/40"} hover:bg-zinc-50 cursor-pointer transition-colors`}
                onClick={() => evts.length > 0 && setSelected({ day: di, events: evts })}
                data-testid={`calendar-day-${di}`}
              >
                <div className={`text-xs font-semibold mb-2 ${inMonth ? "text-zinc-900" : "text-zinc-400"} ${isToday ? "bg-zinc-900 text-white rounded-md w-6 h-6 grid place-items-center" : ""}`}>
                  {d.getDate()}
                </div>
                <div className="space-y-1">
                  {evts.slice(0, 3).map((e, idx) => (
                    <div key={idx} className="text-[10px] bg-blue-50 text-blue-900 border border-blue-100 rounded px-1.5 py-0.5 truncate">
                      {e.vehicle_name?.split(" ")[0] || "—"} · {e.customer_name?.split(" ")[0] || ""}
                    </div>
                  ))}
                  {evts.length > 3 && <div className="text-[10px] text-zinc-500">+{evts.length - 3} mais</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-zinc-900/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="label-uppercase mb-2">Reservas do dia</div>
            <h3 className="font-display text-2xl font-bold mb-4">{selected.day}</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {selected.events.map((r) => (
                <div key={r.id} className="border border-zinc-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-zinc-500">{r.reservation_number}</div>
                    <div className="font-medium text-zinc-900">{r.customer_name}</div>
                    <div className="text-xs text-zinc-500">{r.vehicle_name}</div>
                    <div className="text-xs text-zinc-500 mt-1">{r.pickup_date} → {r.return_date}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
