const RES_LABEL = {
  pendiente: { label: "Pendiente", cls: "badge-warning" },
  confirmada: { label: "Confirmada", cls: "badge-info" },
  en_curso: { label: "En curso", cls: "badge-info" },
  completada: { label: "Completada", cls: "badge-success" },
  cancelada: { label: "Cancelada", cls: "badge-error" },
};

const PAY_LABEL = {
  pendiente: { label: "Pendiente", cls: "badge-warning" },
  parcial: { label: "Parcial", cls: "badge-info" },
  pagado: { label: "Pagado", cls: "badge-success" },
};

const VEH_LABEL = {
  disponible: { label: "Disponible", cls: "badge-success" },
  alquilado: { label: "Alquilado", cls: "badge-info" },
  mantenimiento: { label: "Mantenimiento", cls: "badge-warning" },
};

export default function StatusBadge({ status, kind = "reservation" }) {
  const map = kind === "payment" ? PAY_LABEL : kind === "vehicle" ? VEH_LABEL : RES_LABEL;
  const it = map[status] || { label: status, cls: "badge-neutral" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider ${it.cls}`}>
      {it.label}
    </span>
  );
}
