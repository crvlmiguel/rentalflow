import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, MagnifyingGlass, PencilSimple, Trash, User, ClockCounterClockwise } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";

const empty = { full_name: "", phone: "", email: "", identification: "", notes: "" };

export default function Customers() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [historyOf, setHistoryOf] = useState(null);

  const load = async () => {
    const { data } = await api.get("/customers", { params: { q: q || undefined } });
    setItems(data);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) await api.put(`/customers/${editing}`, form);
      else await api.post("/customers", form);
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("¿Eliminar cliente?")) return;
    try { await api.delete(`/customers/${id}`); toast.success("Cliente eliminado"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const showHistory = async (c) => {
    const { data } = await api.get(`/customers/${c.id}`);
    setHistoryOf(data);
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="customers-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Cartera</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Clientes</h1>
          <p className="text-zinc-500 mt-1">Perfiles, contactos e historial de alquileres.</p>
        </div>
        <Button onClick={() => { setForm(empty); setEditing(null); setOpen(true); }} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="add-customer-button">
          <Plus size={16} weight="bold" className="mr-1.5" /> Nuevo cliente
        </Button>
      </div>

      <div className="app-card p-4">
        <div className="relative max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input placeholder="Buscar por nombre, teléfono, correo…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="customers-search" />
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <table className="w-full text-sm" data-testid="customers-table">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Nombre</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Contacto</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Identificación</th>
              <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} className="text-center text-zinc-500 py-12">Sin clientes.</td></tr>
            )}
            {items.map((c) => (
              <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50/60" data-testid={`customer-row-${c.id}`}>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-zinc-100 grid place-items-center font-semibold text-zinc-700">{c.full_name[0]?.toUpperCase()}</div>
                    <div>
                      <div className="font-medium text-zinc-900">{c.full_name}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 text-zinc-700">
                  <div>{c.phone || "—"}</div>
                  <div className="text-xs text-zinc-500">{c.email || ""}</div>
                </td>
                <td className="py-3.5 px-4 text-zinc-600 font-mono text-xs">{c.identification || "—"}</td>
                <td className="py-3.5 px-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => showHistory(c)} data-testid={`history-customer-${c.id}`}>
                      <ClockCounterClockwise size={16} weight="bold" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setForm(c); setEditing(c.id); setOpen(true); }} data-testid={`edit-customer-${c.id}`}>
                      <PencilSimple size={16} weight="bold" />
                    </Button>
                    {user?.role === "admin" && (
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => remove(c.id)} data-testid={`delete-customer-${c.id}`}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label className="label-uppercase mb-1.5 block">Nombre completo</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required data-testid="customer-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Teléfono</Label>
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="customer-phone-input" />
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Correo</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="customer-email-input" />
              </div>
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">Identificación</Label>
              <Input value={form.identification || ""} onChange={(e) => setForm({ ...form, identification: e.target.value })} data-testid="customer-id-input" />
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">Notas</Label>
              <Textarea rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="save-customer-button">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyOf} onOpenChange={(o) => !o && setHistoryOf(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Historial · {historyOf?.customer?.full_name}</DialogTitle>
          </DialogHeader>
          {historyOf && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {historyOf.history.length === 0 && <div className="text-zinc-500 text-center py-8">Sin alquileres.</div>}
              {historyOf.history.map((r) => (
                <div key={r.id} className="border border-zinc-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs text-zinc-500">{r.reservation_number}</div>
                    <div className="text-sm text-zinc-700">{r.pickup_date} → {r.return_date}</div>
                    <div className="text-xs text-zinc-500">${Number(r.total_price).toFixed(2)}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
