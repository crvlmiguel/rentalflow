import { useEffect, useState } from "react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { Plus, MagnifyingGlass, PencilSimple, Trash, Car } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const CATS = [
  { v: "economico", l: "Económico" },
  { v: "compacto", l: "Compacto" },
  { v: "suv", l: "SUV" },
  { v: "lujo", l: "Luxo" },
  { v: "van", l: "Van" },
  { v: "deportivo", l: "Desportivo" },
];

const STATUSES = [
  { v: "disponible", l: "Disponível" },
  { v: "alquilado", l: "Alugado" },
  { v: "mantenimiento", l: "Manutenção" },
];

const empty = { name: "", license_plate: "", category: "economico", daily_price: 0, status: "disponible", image_url: "", notes: "" };

export default function Vehicles() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await api.get("/vehicles", { params: { q: q || undefined } });
    setItems(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);

  const openNew = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (v) => { setForm({ ...v }); setEditing(v.id); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, daily_price: parseFloat(form.daily_price) || 0 };
      if (editing) {
        await api.put(`/vehicles/${editing}`, payload);
        toast.success("Veículo atualizado");
      } else {
        await api.post("/vehicles", payload);
        toast.success("Veículo criado");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminar este veículo?")) return;
    try {
      await api.delete(`/vehicles/${id}`);
      toast.success("Veículo eliminado");
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="vehicles-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="label-uppercase mb-2">Frota</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">Veículos</h1>
          <p className="text-zinc-500 mt-1">Gira o seu inventário de veículos.</p>
        </div>
        <Button onClick={openNew} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="add-vehicle-button">
          <Plus size={16} weight="bold" className="mr-1.5" /> Novo veículo
        </Button>
      </div>

      <div className="app-card p-4">
        <div className="relative max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <Input placeholder="Pesquisar por nome ou matrícula…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="vehicles-search" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="vehicles-list">
        {items.length === 0 && <div className="text-zinc-500 col-span-full text-center py-12">Não há veículos. Adicione o primeiro.</div>}
        {items.map((v) => (
          <div key={v.id} className="app-card overflow-hidden" data-testid={`vehicle-card-${v.id}`}>
            <div className="aspect-video bg-zinc-100 grid place-items-center overflow-hidden">
              {v.image_url ? (
                <img src={v.image_url} alt={v.name} className="w-full h-full object-cover" />
              ) : (
                <Car size={48} weight="thin" className="text-zinc-400" />
              )}
            </div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display font-semibold text-zinc-950 truncate">{v.name}</div>
                  <div className="font-mono text-xs text-zinc-500 mt-0.5">{v.license_plate}</div>
                </div>
                <StatusBadge status={v.status} kind="vehicle" />
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Por dia</div>
                  <div className="font-display font-bold text-lg text-zinc-950">${Number(v.daily_price).toFixed(2)}</div>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 rounded-md px-2 py-1">
                  {CATS.find(c => c.v === v.category)?.l || v.category}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(v)} data-testid={`edit-vehicle-${v.id}`}>
                  <PencilSimple size={14} weight="bold" className="mr-1" /> Editar
                </Button>
                {user?.role === "admin" && (
                  <Button variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => remove(v.id)} data-testid={`delete-vehicle-${v.id}`}>
                    <Trash size={14} weight="bold" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="vehicle-dialog">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar veículo" : "Novo veículo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label className="label-uppercase mb-1.5 block">Nome / Modelo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required data-testid="vehicle-name-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Matrícula</Label>
                <Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} required data-testid="vehicle-plate-input" />
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Preço diário</Label>
                <Input type="number" step="0.01" min="0" value={form.daily_price} onChange={(e) => setForm({ ...form, daily_price: e.target.value })} required data-testid="vehicle-price-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="label-uppercase mb-1.5 block">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="vehicle-category-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map(c => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="label-uppercase mb-1.5 block">Estado</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="vehicle-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">URL da imagem (opcional)</Label>
              <Input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" data-testid="vehicle-image-input" />
            </div>
            <div>
              <Label className="label-uppercase mb-1.5 block">Notas</Label>
              <Textarea rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="vehicle-notes-input" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-zinc-900 hover:bg-zinc-800 text-white" data-testid="save-vehicle-button">
                {loading ? "A guardar…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
