import { type FormEvent, useState } from 'react';
import { authApi } from '../shared/api/services';
import type { AuthResponse } from "../features/auth/types";
import { getErrorMessage } from '../shared/utils/errors';

interface AuthPanelProps {
  onAuthSuccess: (response: AuthResponse, label?: string) => void;
}

export function AuthPanel({ onAuthSuccess }: AuthPanelProps): JSX.Element {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    sessionLabel: '',
  });
  const [loading, setLoading] = useState<'AUTH' | null>(null);
  const [message, setMessage] = useState<string>('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading('AUTH');
    setMessage('');
    try {
      if (mode === 'LOGIN') {
        const response = await authApi.login({
          email: form.email,
          password: form.password,
        });
        onAuthSuccess(response, form.sessionLabel);
        setMessage(`Sesión iniciada para ${response.user.email}.`);
      } else {
        const response = await authApi.register({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        });
        onAuthSuccess(response, form.sessionLabel);
        setMessage(`Cuenta creada e inicio de sesión automático para ${response.user.email}.`);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-academic-surface">
      <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-5 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-md rounded-[2rem] border border-academic-outline/25 bg-white p-8 shadow-academic-lg sm:p-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-academic-outline-variant bg-academic-surface-container">
              <img
                src="/logos/Logo01.png"
                alt="DockUS"
                className="h-9 w-9 rounded-xl shadow-sm"
              />
            </div>
            <div className="flex justify-center space-x-1 mb-6 p-1 bg-academic-surface-container rounded-2xl border border-academic-outline-variant/30 w-fit mx-auto shadow-inner">
              <button
                type="button"
                onClick={() => { setMode('LOGIN'); setMessage(''); }}
                className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  mode === 'LOGIN' ? 'bg-white text-academic-primary shadow-sm border border-academic-outline-variant/20' : 'text-academic-on-surface-variant hover:text-academic-on-surface'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => { setMode('REGISTER'); setMessage(''); }}
                className={`px-4 py-1.5 text-sm font-bold rounded-xl transition-all ${
                  mode === 'REGISTER' ? 'bg-white text-academic-primary shadow-sm border border-academic-outline-variant/20' : 'text-academic-on-surface-variant hover:text-academic-on-surface'
                }`}
              >
                Registro
              </button>
            </div>
            <p className="eyebrow">{mode === 'LOGIN' ? 'Acceso' : 'Bienvenida'}</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-academic-on-surface font-display">
              {mode === 'LOGIN' ? 'Inicia sesión en DockUS' : 'Crea tu cuenta'}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-academic-on-surface-variant">
              {mode === 'LOGIN' 
                ? 'Acceso a la consola de proyectos, entregas y runtime.' 
                : 'Únete a la plataforma para gestionar tus entregas y proyectos académicos.'}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'REGISTER' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Nombre</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ana"
                    className="input-field"
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label-text">Apellidos</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. García"
                    className="input-field"
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="label-text">Correo institucional</label>
              <input
                type="email"
                required
                placeholder="nombre@universidad.edu"
                className="input-field"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-text">Contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Mín. 8 chars, Mayús, Núm"
                className="input-field"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-text">Etiqueta de sesión opcional</label>
              <input
                type="text"
                placeholder="Ej. Alumno · Lab 1"
                className="input-field"
                value={form.sessionLabel}
                onChange={(e) => setForm((prev) => ({ ...prev, sessionLabel: e.target.value }))}
              />
            </div>

            <button className="btn-primary w-full shadow-lg hover:shadow-brand-maroon/20" type="submit" disabled={loading === 'AUTH'}>
              {loading === 'AUTH' 
                ? (mode === 'LOGIN' ? 'Validando acceso...' : 'Creando cuenta...') 
                : (mode === 'LOGIN' ? 'Entrar' : 'Registrarse')}
            </button>
          </form>

          {message && (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                message.toLowerCase().includes('error') || message.toLowerCase().includes('inválid') || message.toLowerCase().includes('incorrect')
                  ? 'border-rose-600/10 bg-rose-50 text-rose-700'
                  : 'border-emerald-600/10 bg-emerald-50 text-emerald-700'
              }`}
            >
              {message}
            </div>
          )}

          <div className="mt-8 border-t border-academic-outline/10 pt-5 text-center text-xs text-academic-on-surface-variant/70">
            {mode === 'LOGIN' 
              ? 'Uso interno. Accede con una cuenta autorizada.' 
              : 'Al registrarte, aceptas las políticas de uso académico de DockUS.'}
          </div>
        </div>
      </div>
    </div>
  );
}
