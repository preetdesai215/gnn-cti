import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, Brain, Clock, FileText, Menu, Network, Radar, Search, ShieldHalf, Siren, X,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/analysis", label: "Threat Analysis", icon: Radar },
  { to: "/gnn", label: "GNN Model", icon: Brain },
  { to: "/alerts", label: "Alerts", icon: Siren },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/about", label: "About", icon: BookOpen },
];

function currentTitle(pathname) {
  return NAV.find((n) => pathname.startsWith(n.to))?.label || "Dashboard";
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "bg-gradient-to-r from-accent/20 to-accent-light/10 text-white shadow-[inset_2px_0_0_0_#e11d2e]"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
            }`
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function useUtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now.toISOString().slice(11, 19) + " UTC";
}

function TopBar({ title }) {
  const clock = useUtcClock();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function lookup(e) {
    e.preventDefault();
    const value = q.trim();
    if (!value) return;
    navigate(`/analysis?q=${encodeURIComponent(value)}`);
    setQ("");
  }

  return (
    <div className="sticky top-0 z-20 -mx-8 mb-6 hidden items-center gap-4 border-b border-red-500/10 bg-navy-950/85 px-8 py-3 backdrop-blur md:flex">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="text-[11px] uppercase tracking-wider text-amber-300/80">Simulated data</p>
      </div>
      <form onSubmit={lookup} className="relative w-full max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          className="input py-2 pl-9 text-sm"
          placeholder="Look up an IP, domain, URL or hash, then press Enter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Quick indicator lookup"
        />
      </form>
      <div className="hidden items-center gap-2 text-xs text-slate-400 xl:flex">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-mono">{clock}</span>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const title = currentTitle(pathname);

  useEffect(() => {
    document.title = `${title} · GNN-CTI`;
  }, [title]);

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 rounded-none border-y-0 border-l-0 p-5 md:flex">
        <Brand />
        <NavItems />
        <Footer />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-red-400/10 bg-navy-950/90 px-4 py-3 backdrop-blur md:hidden">
        <Brand compact />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-slate-200 hover:bg-white/5">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="glass absolute left-0 top-0 flex h-full w-72 flex-col gap-6 rounded-none p-5">
            <div className="flex items-center justify-between">
              <Brand compact />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-white/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={() => setOpen(false)} />
            <Footer />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
        <TopBar title={title} />
        <Outlet />
      </main>
    </div>
  );
}

function Brand({ compact }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-dark shadow-[0_0_20px_-4px_#e11d2e]">
        <ShieldHalf className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold leading-tight text-white">{compact ? "GNN-CTI" : "GNN-Based CTI"}</p>
        {!compact && <p className="text-xs text-slate-500">Threat Intelligence Platform</p>}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200/90">
      Demo mode. All data is simulated.
    </div>
  );
}
