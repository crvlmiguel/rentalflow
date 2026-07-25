import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@rentcar.com");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      toast.success("Bem-vindo de volta");
      nav("/");
    } else {
      setErr(res.error);
      toast.error(res.error);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left visual panel */}
      <div className="hidden lg:block relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(https://images.pexels.com/photos/16094585/pexels-photo-16094585.jpeg)" }}
        />
        <div className="absolute inset-0 bg-zinc-950/55" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white grid place-items-center">
              <Car size={20} weight="bold" className="text-zinc-900" />
            </div>
            <div>
              <div className="font-display font-bold text-xl">RentaFlow</div>
              <div className="text-[11px] tracking-[0.22em] uppercase text-zinc-300">Rent-a-Car OS</div>
            </div>
          </div>

          <div className="space-y-6 max-w-md">
            <div className="label-uppercase text-zinc-300">Plataforma de gestão</div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight">
              Controle a sua frota,<br/>reservas e pagamentos<br/>num só lugar.
            </h1>
            <p className="text-zinc-300 text-base leading-relaxed">
              Uma plataforma operacional para empresas de aluguer. Reservas, calendário,
              clientes e relatórios — rápidos e precisos.
            </p>
          </div>

          <div className="flex items-center gap-8 text-sm text-zinc-300 border-t border-white/10 pt-6">
            <div><span className="font-display font-bold text-white text-lg">99.9%</span> uptime</div>
            <div><span className="font-display font-bold text-white text-lg">+1k</span> reservas / mês</div>
            <div><span className="font-display font-bold text-white text-lg">24/7</span> operação</div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-lg bg-zinc-900 grid place-items-center">
              <Car size={20} weight="bold" className="text-white" />
            </div>
            <div className="font-display font-bold text-xl text-zinc-950">RentaFlow</div>
          </div>

          <div className="label-uppercase mb-3">Iniciar sessão</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 mb-2">
            Aceda ao seu painel
          </h2>
          <p className="text-zinc-600 mb-8">
            Introduza as suas credenciais para gerir o seu negócio.
          </p>

          <form onSubmit={submit} className="space-y-5" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="label-uppercase mb-2 block">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
                placeholder="admin@rentcar.com"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="password" className="label-uppercase mb-2 block">Palavra-passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>

            {err && (
              <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" data-testid="login-error">
                {err}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-lg group"
              data-testid="login-submit-button"
            >
              {loading ? "A entrar…" : (
                <span className="inline-flex items-center gap-2">
                  Iniciar sessão <ArrowRight size={16} weight="bold" className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 p-4 rounded-lg bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
            <div className="label-uppercase text-zinc-500 mb-2">Contas de teste</div>
            <div><span className="font-mono text-xs">admin@rentcar.com</span> / <span className="font-mono text-xs">admin123</span> (Admin)</div>
            <div><span className="font-mono text-xs">staff@rentcar.com</span> / <span className="font-mono text-xs">staff123</span> (Staff)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
