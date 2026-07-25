import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const METHODS = [
  { v: "efectivo", l: "Dinheiro" },
  { v: "transferencia", l: "Transferência" },
  { v: "tarjeta", l: "Cartão" },
];

export default function Payments() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ reservation_id: "", amount: 0, method: "efectivo", notes: "" });
  const [filterRes, setFilterRes] = useState("all");

  const loadAll = async () => {
    const [pRes, rRes] = await Promise.all([
      api.get("/payments", { params: filterRes !== "all" ? { reservation_id: filterRes } : {} }),
      api.get("/reservations"),
    ]);
    setPayments(pRes.data);
    setReservations(rRes.data);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [filterRes]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.post("/payments", { ...form, amount: parseFloat(form.amount) || 0 });
      toast.success("Pagamento registado");
      setOpen(false); setForm({ reservation_id: "", amount: 0, method: "efectivo", notes: "" });
      loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminar este pagamento?")) return;
    try { await api.delete(`/payments/${id}`); toast.success("Pagamento eliminado"); loadAll(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const resByID = Object.fromEntries(reservations.map(r => [r.id, r]));

  return (
    <div className="space-y-6 animate-fade-in" data-testid="payments-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Cobranças</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Pagamentos</h1>
          <p className="text-zinc-500 mt-1">Registe e consulte os pagamentos por reserva.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="add-payment-button">
          <Plus size={16} weight="bold" className="mr-1.5" /> Registar pagamento
        </Button>
      </div>

      <div className="app-card p-4 flex flex-wrap gap-3 items-center">
        <Select value={filterRes} onValueChange={setFilterRes}>
          <SelectTrigger className="w-[300px]" data-testid="payments-reservation-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pagamentos</SelectItem>
            {reservations.map(r => <SelectItem key={r.id} value={r.id}>{r.reservation_number} · {r.customer_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="app-card overflow-x-auto">
        <table className="w-full text-sm" data-testid="payments-table">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Data</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Reserva</th>
              <th className="text-left font-bold uppercase tracking-wider text-[11px] py-3 px-4">Cliente</th>
              <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Montante</th>
              <th className="text-center font-bold uppercase tracking-wider text-[11px] py-3 px-4">Método</th>
              <th className="text-right font-bold uppercase tracking-wider text-[11px] py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={6} className="text-center text-zinc-500 py-12">Sem pagamentos registados.</td></tr>}
            {payments.map((p) => {
              const r = resByID[p.reservation_id];
              return (
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="py-3 px-4 text-zinc-600 text-xs">{p.created_at?.slice(0, 10)}</td>
                  <td className="py-3 px-4 font-mono text-xs">{r?.reservation_number || "—"}</td>
                  <td className="py-3 px-4">{r?.customer_name || "—"}</td>
                  <td className="py-3 px-4 text-right font-display font-semibold text-zinc-950">${Number(p.amount).toFixed(2)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex px-2 py-1 rounded-md bg-zinc-100 text-zinc-700 text-[11px] uppercase tracking-wider font-semibold">
                      {METHODS.find(m => m.v === p.method)?.l || p.method}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {user?.role === "admin" && (
                      <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => remove(p.id)} data-testid={`delete-payment-${p.id}`}>
                        <Trash size={16} weight="bold" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Registar pagamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label className="label-uppercase mb-1.5 block">Reserva</Label>
              <Select value={form.reservation_id} onValueChange={(v) => setForm({ ...form, reservation_id: v })}>
                <SelectTrigger data-testid="payment-reservation-select"><SelectValue placeholder="Selecione a reserva" /></SelectTrigger>
                <SelectContent>
                  {reservations.filter(r => r.status !== "cancelada").map(r => {
                    const balance = (Number(r.total_price) - Number(r.paid_amount || 0)).toFixed(2);
                    return <SelectItem key={r.id} value={r.id}>{r.reservation_number} · {r.customer_name} · saldo ${balance}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Montante</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required data-testid="payment-amount-input" />
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Método</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">Notas</Label>
              <Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="save-payment-button">Registar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
