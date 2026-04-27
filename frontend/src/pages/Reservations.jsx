import { useEffect, useState, useMemo } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { Plus, MagnifyingGlass, PencilSimple, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const RES_STATUSES = [
  { v: "pendiente", l: "Pendiente" },
  { v: "confirmada", l: "Confirmada" },
  { v: "en_curso", l: "En curso" },
  { v: "completada", l: "Completada" },
  { v: "cancelada", l: "Cancelada" },
];
const PAY_STATUSES = [
  { v: "pendiente", l: "Pendiente" },
  { v: "parcial", l: "Parcial" },
  { v: "pagado", l: "Pagado" },
];

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const emptyForm = {
  customer_id: "",
  vehicle_id: "",
  pickup_date: today,
  return_date: tomorrow,
  total_price: 0,
  payment_status: "pendiente",
  status: "pendiente",
  notes: "",
};

export default function Reservations() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [filter, setFilter] = useState({ q: "", status: "all" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const params = { q: filter.q || undefined };
    if (filter.status !== "all") params.status = filter.status;
    const { data } = await api.get("/reservations", { params });
    setItems(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  useEffect(() => {
    api.get("/customers").then(({ data }) => setCustomers(data));
    api.get("/vehicles").then(({ data }) => setVehicles(data));
  }, [open]);

  const selectedVeh = useMemo(() => vehicles.find(v => v.id === form.vehicle_id), [vehicles, form.vehicle_id]);

  // Auto-calc total when dates or vehicle change
  useEffect(() => {
    if (selectedVeh && form.pickup_date && form.return_date) {
      const d1 = new Date(form.pickup_date);
      const d2 = new Date(form.return_date);
      const days = Math.max(1, Math.round((d2 - d1) / 86400000));
      setForm((f) => ({ ...f, total_price: +(days * Number(selectedVeh.daily_price)).toFixed(2) }));
    }
    // eslint-disable-next-line
  }, [form.pickup_date, form.return_date, form.vehicle_id]);

  const openNew = () => { setForm(emptyForm); setEditing(null); setOpen(true); };
  const openEdit = (r) => {
    setForm({
      customer_id: r.customer_id, vehicle_id: r.vehicle_id,
      pickup_date: r.pickup_date, return_date: r.return_date,
      total_price: r.total_price, payment_status: r.payment_status,
      status: r.status, notes: r.notes || "",
    });
    setEditing(r.id); setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, total_price: parseFloat(form.total_price) || 0 };
      if (editing) await api.put(`/reservations/${editing}`, payload);
      else await api.post("/reservations", payload);
      toast.success(editing ? "Reserva actualizada" : "Reserva creada");
      setOpen(false); load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar reserva?")) return;
    try { await api.delete(`/reservations/${id}`); toast.success("Reserva eliminada"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reservations-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Operación</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Reservas</h1>
          <p className="text-zinc-500 mt-1">Gestiona reservas y disponibilidad de vehículos.</p>
        </div>
        <Button onClick={openNew} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="add-reservation-button">
          <Plus size={16} weight="bold" className="mr-1.5" /> Nueva reserva
        </Button>
      </div>

      <div className="app-card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input placeholder="Buscar por número de reserva…" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className="pl-9" data-testid="reservations-search" />
        </div>
        <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
          <SelectTrigger className="w-[180px]" data-testid="reservations-status-filter"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {RES_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="app-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="reservations-table">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">N°</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Cliente</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Vehículo</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Fechas</th>
              <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Total</th>
              <th className="text-center font-bold uppercase tracking-wider text-[11px] py-3 px-4">Pago</th>
              <th className="text-center font-bold uppercase tracking-wider text-[11px] py-3 px-4">Estado</th>
              <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={8} className="text-center text-zinc-500 py-12">Sin reservas.</td></tr>}
            {items.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50/60" data-testid={`reservation-row-${r.id}`}>
                <td className="py-3 px-4 font-mono text-xs text-zinc-700">{r.reservation_number}</td>
                <td className="py-3 px-4 text-zinc-900">{r.customer_name}</td>
                <td className="py-3 px-4 text-zinc-700 text-xs">{r.vehicle_name}</td>
                <td className="py-3 px-4 text-zinc-600 text-xs">
                  {r.pickup_date} <span className="text-zinc-400">→</span> {r.return_date}
                </td>
                <td className="py-3 px-4 text-right font-display font-semibold text-zinc-950">${Number(r.total_price).toFixed(2)}</td>
                <td className="py-3 px-4 text-center"><StatusBadge status={r.payment_status} kind="payment" /></td>
                <td className="py-3 px-4 text-center"><StatusBadge status={r.status} kind="reservation" /></td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)} data-testid={`edit-reservation-${r.id}`}>
                      <PencilSimple size={16} weight="bold" />
                    </Button>
                    {user?.role === "admin" && (
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => remove(r.id)} data-testid={`delete-reservation-${r.id}`}>
                        <Trash size={16} weight="bold" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar reserva" : "Nueva reserva"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Cliente</Label>
                <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                  <SelectTrigger data-testid="reservation-customer-select"><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Vehículo</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger data-testid="reservation-vehicle-select"><SelectValue placeholder="Selecciona vehículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} · {v.license_plate} · ${v.daily_price}/d</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Fecha recogida</Label>
                <Input type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} required data-testid="reservation-pickup-input" />
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Fecha devolución</Label>
                <Input type="date" value={form.return_date} onChange={(e) => setForm({ ...form, return_date: e.target.value })} required data-testid="reservation-return-input" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Total</Label>
                <Input type="number" step="0.01" value={form.total_price} onChange={(e) => setForm({ ...form, total_price: e.target.value })} data-testid="reservation-total-input" />
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Estado pago</Label>
                <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                  <SelectTrigger data-testid="reservation-payment-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAY_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Estado reserva</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="reservation-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{RES_STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">Notas</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="save-reservation-button">
                {loading ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
