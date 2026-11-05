import React, { useState } from "react";
import {
  Building2,
  Mail,
  LockKeyhole,
  Loader2,
  AlertCircle,
} from "lucide-react";

import logo from "../assets/logo_bache0_azul_hd.png";

export default function LoginMunicipal({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err.message || "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        <div className="px-8 pt-10 pb-6 text-center">
          <img
            src={logo}
            alt="Bache0"
            className="h-16 w-auto mx-auto object-contain mb-5"
          />

          <div className="flex justify-center mb-3">
            <div className="bg-blue-50 p-3 rounded-xl">
              <Building2 size={25} className="text-blue-900" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Panel Municipal
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            Ingresa con tus credenciales institucionales para acceder a Bache0.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-9 space-y-5">

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-slate-700 mb-2"
            >
              Correo electrónico
            </label>

            <div className="relative">
              <Mail
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@municipalidad.cl"
                autoComplete="username"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-slate-700 mb-2"
            >
              Contraseña
            </label>

            <div className="relative">
              <LockKeyhole
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-400 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            Bache0 · Plataforma de gestión municipal
          </p>

        </form>
      </div>
    </div>
  );
}