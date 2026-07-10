import { type FormEvent, useState, useRef, useEffect, useCallback } from 'react';
import { authApi } from '../shared/api/services';
import type { AuthResponse } from "../features/auth/types";
import { getErrorMessage } from '../shared/utils/errors';
import {
  RiCommandLine,
  RiUploadCloud2Line,
  RiDashboardLine,
  RiLoader4Line,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCheckLine,
  RiAlertLine,
} from 'react-icons/ri';

/* ─── Password Strength ─── */
type StrengthLevel = 0 | 1 | 2 | 3 | 4;

function getPasswordStrength(password: string): StrengthLevel {
  if (!password || password.length < 8) return 0;
  let score = 1; // meets minimum length
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password) && password.length >= 12) score++;
  return Math.min(score, 4) as StrengthLevel;
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; barColor: string }> = {
  0: { label: '', color: '', barColor: '' },
  1: { label: 'Débil', color: 'text-red-500', barColor: 'bg-red-500' },
  2: { label: 'Regular', color: 'text-orange-500', barColor: 'bg-orange-500' },
  3: { label: 'Buena', color: 'text-yellow-500', barColor: 'bg-yellow-500' },
  4: { label: 'Fuerte', color: 'text-emerald-500', barColor: 'bg-emerald-500' },
};

/* ─── Validation ─── */
interface FieldValidation {
  touched: boolean;
  valid: boolean;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): Omit<FieldValidation, 'touched'> {
  if (!value.trim()) return { valid: false, message: 'El correo es obligatorio' };
  if (!EMAIL_RE.test(value)) return { valid: false, message: 'Formato de correo inválido' };
  return { valid: true, message: '' };
}

function validateRequired(value: string, label: string): Omit<FieldValidation, 'touched'> {
  if (!value.trim()) return { valid: false, message: `${label} es obligatorio` };
  return { valid: true, message: '' };
}

function validatePassword(value: string): Omit<FieldValidation, 'touched'> {
  if (!value) return { valid: false, message: 'La contraseña es obligatoria' };
  if (value.length < 8) return { valid: false, message: 'Mínimo 8 caracteres' };
  return { valid: true, message: '' };
}

/* ─── Particles Data ─── */
const PARTICLES = [
  { size: 3, left: '12%', top: '18%', anim: 'auth-particle-1', dur: '14s', delay: '0s' },
  { size: 4, left: '75%', top: '25%', anim: 'auth-particle-2', dur: '18s', delay: '2s' },
  { size: 2, left: '35%', top: '65%', anim: 'auth-particle-3', dur: '16s', delay: '4s' },
  { size: 5, left: '85%', top: '70%', anim: 'auth-particle-1', dur: '20s', delay: '1s' },
  { size: 3, left: '55%', top: '40%', anim: 'auth-particle-2', dur: '15s', delay: '3s' },
  { size: 2, left: '20%', top: '80%', anim: 'auth-particle-3', dur: '22s', delay: '5s' },
  { size: 4, left: '65%', top: '10%', anim: 'auth-particle-1', dur: '17s', delay: '6s' },
  { size: 3, left: '40%', top: '90%', anim: 'auth-particle-2', dur: '19s', delay: '2.5s' },
  { size: 2, left: '90%', top: '50%', anim: 'auth-particle-3', dur: '13s', delay: '4.5s' },
  { size: 5, left: '8%', top: '45%', anim: 'auth-particle-1', dur: '21s', delay: '1.5s' },
];

/* ─── Main Component ─── */

interface AuthPanelProps {
  onAuthSuccess: (response: AuthResponse) => void;
}

export function AuthPanel({ onAuthSuccess }: AuthPanelProps): JSX.Element {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState<'AUTH' | null>(null);
  const [message, setMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);

  // Validation state
  const [validation, setValidation] = useState<Record<string, FieldValidation>>({
    email: { touched: false, valid: true, message: '' },
    password: { touched: false, valid: true, message: '' },
    firstName: { touched: false, valid: true, message: '' },
    lastName: { touched: false, valid: true, message: '' },
  });

  const formRef = useRef<HTMLFormElement>(null);

  // Clear shake animation after it plays
  useEffect(() => {
    if (shakeForm) {
      const timer = setTimeout(() => setShakeForm(false), 600);
      return () => clearTimeout(timer);
    }
  }, [shakeForm]);

  const handleBlur = useCallback((field: string) => {
    let result: Omit<FieldValidation, 'touched'>;
    switch (field) {
      case 'email':
        result = validateEmail(form.email);
        break;
      case 'password':
        result = validatePassword(form.password);
        break;
      case 'firstName':
        result = validateRequired(form.firstName, 'El nombre');
        break;
      case 'lastName':
        result = validateRequired(form.lastName, 'Los apellidos');
        break;
      default:
        return;
    }
    setValidation(prev => ({
      ...prev,
      [field]: { touched: true, ...result },
    }));
  }, [form]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading('AUTH');
    setMessage('');
    setSuccessAnim(false);
    try {
      if (mode === 'LOGIN') {
        const response = await authApi.login({
          email: form.email,
          password: form.password,
        });
        setSuccessAnim(true);
        onAuthSuccess(response);
        setMessage('Sesión iniciada para ' + response.user.email + '.');
      } else {
        const response = await authApi.register({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        });
        setSuccessAnim(true);
        onAuthSuccess(response);
        setMessage('Cuenta creada e inicio de sesión automático para ' + response.user.email + '.');
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      setMessage(errorMsg);
      setShakeForm(true);
    } finally {
      setLoading(null);
    }
  };

  const handleModeSwitch = (newMode: 'LOGIN' | 'REGISTER') => {
    setMode(newMode);
    setMessage('');
    setSuccessAnim(false);
    // Reset validation when switching modes
    setValidation({
      email: { touched: false, valid: true, message: '' },
      password: { touched: false, valid: true, message: '' },
      firstName: { touched: false, valid: true, message: '' },
      lastName: { touched: false, valid: true, message: '' },
    });
  };

  const isErrorMessage = message.toLowerCase().includes('error') || message.toLowerCase().includes('inválid') || message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('falló');
  const passwordStrength = mode === 'REGISTER' ? getPasswordStrength(form.password) : 0;

  const inputBase = "block w-full px-4 py-3 rounded-xl border text-sm text-slate-900 transition-all duration-200 placeholder:text-slate-400 focus:outline-none disabled:bg-slate-100";

  const getInputClasses = (field: string) => {
    const v = validation[field];
    if (v?.touched && !v.valid) {
      return `${inputBase} border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-4 focus:ring-red-100`;
    }
    if (v?.touched && v.valid) {
      return `${inputBase} border-emerald-300 bg-emerald-50/20 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`;
    }
    return `${inputBase} border-slate-200 bg-slate-50/50 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 hover:border-slate-300`;
  };

  return (
    <div className="flex min-h-screen font-sans antialiased">
      {/* Estilos locales para animaciones del panel izquierdo */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .glow-overlay-1 {
          background: radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(37,99,235,0) 70%);
          animation: auth-glow-pulse 4s ease-in-out infinite;
        }
        .glow-overlay-2 {
          background: radial-gradient(circle, rgba(91,4,13,0.2) 0%, rgba(91,4,13,0) 70%);
          animation: auth-glow-pulse 5s ease-in-out infinite 1s;
        }
        .gradient-orb {
          background: conic-gradient(from 0deg, rgba(37,99,235,0.08), rgba(91,4,13,0.06), rgba(37,99,235,0.04), rgba(91,4,13,0.08), rgba(37,99,235,0.08));
          animation: auth-gradient-spin 25s linear infinite;
        }
        .register-fields-enter {
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition: max-height 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease, margin 0.3s ease;
          margin-bottom: 0;
        }
        .register-fields-enter.show {
          max-height: 200px;
          opacity: 1;
          margin-bottom: 16px;
        }
        .strength-bar-segment {
          transition: background-color 0.3s ease, transform 0.2s ease;
        }
        .strength-bar-segment.active {
          transform: scaleY(1.15);
        }
        .validation-icon-enter {
          animation: auth-check-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .mobile-gradient-bg {
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 30%, #f8fafc 60%, #f8fafc 100%);
        }
        @media (min-width: 1024px) {
          .mobile-gradient-bg {
            background: #f8fafc;
          }
        }
      `}</style>

      {/* Columna Izquierda: Branding e Información (Oculta en móvil) */}
      <div className="relative hidden lg:flex lg:w-[48%] flex-col justify-between overflow-hidden bg-slate-950 p-16 text-white select-none">
        {/* Orbe de gradiente animado (fondo) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full gradient-orb pointer-events-none" />

        {/* Luces de fondo (Glow effects) */}
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full glow-overlay-1 pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full glow-overlay-2 pointer-events-none" />
        
        {/* Patrón de cuadrícula de fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Partículas flotantes */}
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              left: p.left,
              top: p.top,
              animation: `${p.anim} ${p.dur} ease-in-out ${p.delay} infinite`,
            }}
          />
        ))}

        {/* Cabecera — staggered animation */}
        <div className="relative z-10 flex items-center space-x-4 auth-slide-right" style={{ animationDelay: '0.1s' }}>
          <img
            src="/logos/Logo01.png"
            alt="EduCode AI"
            className="h-12 w-12 rounded-full shadow-lg shadow-black/20"
          />
          <span className="text-2xl font-bold tracking-wider text-white">EduCode AI</span>
        </div>

        {/* Tarjeta Visual Destacada (Glassmorphism) — staggered */}
        <div className="relative z-10 my-auto max-w-lg auth-slide-right" style={{ animationDelay: '0.3s' }}>
          <div className="animate-float rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
            <div className="mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Consola Académica
              </span>
              <h3 className="mt-3 text-2xl font-bold text-white">
                Despliegues y Runtime Bajo Control
              </h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                Una plataforma unificada para administrar tus entregas de programación, entornos y ejecución de contenedores.
              </p>
            </div>

            <div className="space-y-5 border-t border-white/10 pt-6">
              <div
                className="flex items-start space-x-3.5 auth-slide-right"
                style={{ animationDelay: '0.5s' }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/20">
                  <RiCommandLine className="text-lg" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Runtime Integrado</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Ejecuta comandos, levanta contenedores y depura fallas directamente.</p>
                </div>
              </div>

              <div
                className="flex items-start space-x-3.5 auth-slide-right"
                style={{ animationDelay: '0.65s' }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300 border border-red-500/20">
                  <RiUploadCloud2Line className="text-lg" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Gestión de Entregas</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Envía tus prácticas y obtén evaluación automática y retroalimentación inmediata.</p>
                </div>
              </div>

              <div
                className="flex items-start space-x-3.5 auth-slide-right"
                style={{ animationDelay: '0.8s' }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                  <RiDashboardLine className="text-lg" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Workspace Dinámico</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Toda la información académica de tu curso, laboratorios y grupos al alcance.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página Izquierdo — staggered */}
        <div className="relative z-10 flex justify-between text-[11px] text-slate-500 auth-slide-right" style={{ animationDelay: '0.9s' }}>
          <span>© 2026 Universidad de Sevilla · Departamento de Telemática</span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* Columna Derecha: Formulario de Acceso */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 mobile-gradient-bg">
        <div
          className={`w-full max-w-md bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl sm:p-10 transition-all duration-300 auth-slide-up ${shakeForm ? 'auth-shake' : ''}`}
          style={{ animationDelay: '0.15s' }}
        >
          
          {/* Logo en Móvil */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="lg:hidden relative mb-5 auth-slide-up" style={{ animationDelay: '0.05s' }}>
              <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl scale-150 pointer-events-none" />
              <img
                src="/logos/Logo01.png"
                alt="EduCode AI"
                className="relative h-14 w-14 rounded-full shadow-md"
              />
            </div>

            {/* Switcher de Modo — Tab con indicador deslizante */}
            <div
              className="relative flex p-1 bg-slate-100 rounded-2xl border border-slate-200/50 shadow-inner w-fit auth-slide-up"
              style={{ animationDelay: '0.2s' }}
              role="tablist"
              aria-label="Modo de acceso"
            >
              {/* Sliding indicator */}
              <div
                className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition-all duration-300 ease-out"
                style={{
                  width: 'calc(50% - 4px)',
                  left: mode === 'LOGIN' ? '4px' : 'calc(50% + 0px)',
                }}
              />
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'LOGIN'}
                aria-controls="auth-login-panel"
                id="auth-login-tab"
                onClick={() => handleModeSwitch('LOGIN')}
                className={`relative z-10 px-5 py-2 text-xs font-bold rounded-xl transition-colors duration-200 ${
                  mode === 'LOGIN'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'REGISTER'}
                aria-controls="auth-register-panel"
                id="auth-register-tab"
                onClick={() => handleModeSwitch('REGISTER')}
                className={`relative z-10 px-5 py-2 text-xs font-bold rounded-xl transition-colors duration-200 ${
                  mode === 'REGISTER'
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Registro
              </button>
            </div>

            <h1
              className="mt-6 text-2xl font-bold tracking-tight text-slate-900 auth-slide-up"
              style={{ animationDelay: '0.3s' }}
            >
              {mode === 'LOGIN' ? 'Inicia sesión en EduCode AI' : 'Crea tu cuenta'}
            </h1>
            <p
              className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed auth-slide-up"
              style={{ animationDelay: '0.35s' }}
            >
              {mode === 'LOGIN' 
                ? 'Acceso a la consola de proyectos, entregas y runtime.' 
                : 'Únete a la plataforma para gestionar tus entregas y proyectos académicos.'}
            </p>
          </div>

          {/* Formulario */}
          <form
            ref={formRef}
            id={mode === 'LOGIN' ? 'auth-login-panel' : 'auth-register-panel'}
            role="tabpanel"
            aria-labelledby={mode === 'LOGIN' ? 'auth-login-tab' : 'auth-register-tab'}
            aria-describedby={message ? 'auth-status-message' : undefined}
            className="space-y-4 auth-slide-up"
            style={{ animationDelay: '0.4s' }}
            onSubmit={handleSubmit}
          >
            {/* Campos de Registro (Nombre / Apellidos) — con transición animada */}
            <div className={`register-fields-enter ${mode === 'REGISTER' ? 'show' : ''}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="auth-first-name" className="text-xs font-bold text-slate-600 block mb-1">Nombre</label>
                  <div className="relative">
                    <input
                      id="auth-first-name"
                      name="firstName"
                      type="text"
                      required={mode === 'REGISTER'}
                      autoComplete="given-name"
                      placeholder="Ej. Ana"
                      className={getInputClasses('firstName')}
                      value={form.firstName}
                      onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      onBlur={() => mode === 'REGISTER' && handleBlur('firstName')}
                    />
                    {validation.firstName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.firstName.valid
                          ? <RiCheckLine className="text-emerald-500 text-sm" />
                          : <RiAlertLine className="text-red-400 text-sm" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.firstName.touched && !validation.firstName.valid && (
                    <p className="mt-1 text-[10px] text-red-500 font-medium">{validation.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="auth-last-name" className="text-xs font-bold text-slate-600 block mb-1">Apellidos</label>
                  <div className="relative">
                    <input
                      id="auth-last-name"
                      name="lastName"
                      type="text"
                      required={mode === 'REGISTER'}
                      autoComplete="family-name"
                      placeholder="Ej. García"
                      className={getInputClasses('lastName')}
                      value={form.lastName}
                      onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      onBlur={() => mode === 'REGISTER' && handleBlur('lastName')}
                    />
                    {validation.lastName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.lastName.valid
                          ? <RiCheckLine className="text-emerald-500 text-sm" />
                          : <RiAlertLine className="text-red-400 text-sm" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.lastName.touched && !validation.lastName.valid && (
                    <p className="mt-1 text-[10px] text-red-500 font-medium">{validation.lastName.message}</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Email */}
            <div>
              <label htmlFor="auth-email" className="text-xs font-bold text-slate-600 block mb-1">Correo institucional</label>
              <div className="relative">
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nombre@universidad.edu"
                  className={`${getInputClasses('email')} pr-10`}
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  onBlur={() => handleBlur('email')}
                />
                {validation.email.touched && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                    {validation.email.valid
                      ? <RiCheckLine className="text-emerald-500 text-sm" />
                      : <RiAlertLine className="text-red-400 text-sm" />
                    }
                  </span>
                )}
              </div>
              {validation.email.touched && !validation.email.valid && (
                <p className="mt-1 text-[10px] text-red-500 font-medium">{validation.email.message}</p>
              )}
            </div>
            
            {/* Contraseña */}
            <div>
              <label htmlFor="auth-password" className="text-xs font-bold text-slate-600 block mb-1">Contraseña</label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                  placeholder="Mín. 8 caracteres"
                  className={`${getInputClasses('password')} pr-10`}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  onBlur={() => handleBlur('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-150 p-0.5"
                >
                  {showPassword
                    ? <RiEyeOffLine className="text-base" />
                    : <RiEyeLine className="text-base" />
                  }
                </button>
              </div>
              {validation.password.touched && !validation.password.valid && (
                <p className="mt-1 text-[10px] text-red-500 font-medium">{validation.password.message}</p>
              )}

              {/* Indicador de fuerza de contraseña — solo Registro */}
              {mode === 'REGISTER' && form.password.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex gap-1">
                    {([1, 2, 3, 4] as const).map(level => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength >= level
                            ? `${STRENGTH_CONFIG[level].barColor} strength-bar-segment active`
                            : 'bg-slate-200 strength-bar-segment'
                        }`}
                      />
                    ))}
                  </div>
                  {passwordStrength > 0 && (
                    <p className={`text-[10px] font-semibold ${STRENGTH_CONFIG[passwordStrength].color} transition-colors duration-300`}>
                      {STRENGTH_CONFIG[passwordStrength].label}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Botón CTA plano */}
            <button 
              className="w-full mt-2 py-3.5 px-5 text-sm font-bold text-white rounded-xl transition-all duration-200 bg-gradient-to-r from-primary to-blue-700 hover:from-primary-hover hover:to-blue-800 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              type="submit" 
              disabled={loading === 'AUTH'} 
              aria-busy={loading === 'AUTH'}
            >
              {loading === 'AUTH' ? (
                <>
                  <RiLoader4Line className="h-4 w-4 animate-spin" />
                  <span>{mode === 'LOGIN' ? 'Validando acceso...' : 'Creando cuenta...'}</span>
                </>
              ) : (
                <span>{mode === 'LOGIN' ? 'Entrar a la consola' : 'Registrarse'}</span>
              )}
            </button>
          </form>

          {/* Mensajes de Alerta */}
          {message && (
            <div
              id="auth-status-message"
              role={isErrorMessage ? 'alert' : 'status'}
              aria-live={isErrorMessage ? 'assertive' : 'polite'}
              className={`mt-6 flex items-start space-x-3 rounded-2xl border p-4 text-xs font-semibold transition-all duration-300 auth-slide-up ${
                isErrorMessage
                  ? 'border-red-100 bg-red-50 text-red-800'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-800'
              }`}
            >
              {isErrorMessage ? (
                <RiErrorWarningLine className="h-5 w-5 shrink-0 text-red-600" />
              ) : (
                <span className={successAnim ? 'validation-icon-enter' : ''}>
                  <RiCheckboxCircleLine className="h-5 w-5 shrink-0 text-emerald-600" />
                </span>
              )}
              <div className="flex-1 leading-relaxed">{message}</div>
            </div>
          )}

          <div
            className="mt-8 border-t border-slate-100 pt-5 text-center text-[10px] text-slate-400 auth-slide-up"
            style={{ animationDelay: '0.5s' }}
          >
            {mode === 'LOGIN' 
              ? 'Uso interno institucional. Accede con tus credenciales asignadas.' 
              : 'Al registrarte, aceptas las políticas de uso académico de EduCode AI.'}
          </div>
        </div>
      </div>
    </div>
  );
}
