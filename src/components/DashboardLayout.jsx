import React, { useState } from "react";
import { Home, Flame, ClipboardList, Settings, Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Inicio", icon: Home },
  { label: "Mapa Térmico", icon: Flame },
  { label: "Reportes", icon: ClipboardList },
  { label: "Configuración", icon: Settings },
];

/**
 * DashboardLayout
 * Layout principal del panel administrativo de PotholeVision.
 * Sidebar fijo en desktop (w-72), off-canvas con overlay en mobile.
 *
 * Props:
 * - children: contenido principal a renderizar
 * - activeItem: string con el label del ítem de navegación activo
 * - onNavigate: callback(label) al hacer click en un ítem del sidebar
 */
export default function DashboardLayout({
  children,
  activeItem = "Reportes",
  onNavigate = () => {},
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex">
      {/* Overlay para cerrar el sidebar en mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 md:w-72 bg-[#1A2C4D] text-white
          flex flex-col transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/10">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-white/45 uppercase">
              Expediente Vial
            </p>
            <h1 className="text-lg font-semibold tracking-tight leading-tight">
              PotholeVision
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-white/70 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon }) => {
            const isActive = label === activeItem;
            return (
              <button
                type="button"
                key={label}
                onClick={() => {
                  onNavigate(label);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium
                  transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40
                  ${
                    isActive
                      ? "bg-white/10 text-white border-l-2 border-[#CC1E1E] pl-[10px]"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-white/10">
          <p className="font-mono text-[10px] text-white/40">
            v0.1 · Panel Municipal
          </p>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 flex items-center gap-3 bg-white border-b border-slate-200 px-4 md:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-[#1A2C4D]"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
          <h2 className="text-[#1A2C4D] font-semibold tracking-tight text-base md:text-lg">
            {activeItem}
          </h2>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
