import type { AuthResponse } from "../features/auth/types";
import {
  RiLoader4Line,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCheckLine,
  RiAlertLine,
} from 'react-icons/ri';
import "./authPanel.css";
import { AuthBrandingPanel } from "./components/AuthBrandingPanel";
import { PasswordStrengthMeter } from "./components/PasswordStrengthMeter";
import { useAuthForm } from "./hooks/useAuthForm";

interface AuthPanelProps {
  onAuthSuccess: (response: AuthResponse) => void;
}

/** Aviso de Bloq Mayús compartido por los campos de contraseña. */
function CapsLockWarning(): JSX.Element {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-warning-600 auth-slide-up">
      <RiAlertLine className="text-xs" />
      Bloq Mayús está activado
    </p>
  );
}

export function AuthPanel({ onAuthSuccess }: AuthPanelProps): JSX.Element {
  const auth = useAuthForm(onAuthSuccess);
  const { mode, form, validation, handleBlur, getInputClasses } = auth;

  const fieldErrorId = (field: string) =>
    validation[field]?.touched && !validation[field]?.valid
      ? `auth-${field}-error`
      : undefined;

  const fieldAriaInvalid = (field: string) =>
    validation[field]?.touched && !validation[field]?.valid ? true : undefined;

  return (
    <div className="flex min-h-screen font-sans antialiased">
      <AuthBrandingPanel />

      {/* Columna Derecha: Formulario de Acceso */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 mobile-gradient-bg">
        <div
          className={`w-full max-w-md bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl sm:p-10 transition-all duration-300 auth-slide-up ${auth.shakeForm ? 'auth-shake' : ''}`}
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
                onClick={() => auth.handleModeSwitch('LOGIN')}
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
                onClick={() => auth.handleModeSwitch('REGISTER')}
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

          {/* Formulario — noValidate: la validación la gestiona useAuthForm
              con mensajes propios y focus al primer campo inválido */}
          <form
            ref={auth.formRef}
            id={mode === 'LOGIN' ? 'auth-login-panel' : 'auth-register-panel'}
            role="tabpanel"
            aria-labelledby={mode === 'LOGIN' ? 'auth-login-tab' : 'auth-register-tab'}
            aria-describedby={auth.message ? 'auth-status-message' : undefined}
            noValidate
            className="space-y-4 auth-slide-up"
            style={{ animationDelay: '0.4s' }}
            onSubmit={(event) => void auth.handleSubmit(event)}
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
                      aria-invalid={fieldAriaInvalid('firstName')}
                      aria-describedby={fieldErrorId('firstName')}
                      className={getInputClasses('firstName')}
                      value={form.firstName}
                      onChange={(e) => auth.updateField('firstName', e.target.value)}
                      onBlur={() => mode === 'REGISTER' && handleBlur('firstName')}
                    />
                    {validation.firstName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.firstName.valid
                          ? <RiCheckLine className="text-success-500 text-sm" />
                          : <RiAlertLine className="text-danger-400 text-sm" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.firstName.touched && !validation.firstName.valid && (
                    <p id="auth-firstName-error" className="mt-1 text-[10px] text-danger-500 font-medium">{validation.firstName.message}</p>
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
                      aria-invalid={fieldAriaInvalid('lastName')}
                      aria-describedby={fieldErrorId('lastName')}
                      className={getInputClasses('lastName')}
                      value={form.lastName}
                      onChange={(e) => auth.updateField('lastName', e.target.value)}
                      onBlur={() => mode === 'REGISTER' && handleBlur('lastName')}
                    />
                    {validation.lastName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.lastName.valid
                          ? <RiCheckLine className="text-success-500 text-sm" />
                          : <RiAlertLine className="text-danger-400 text-sm" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.lastName.touched && !validation.lastName.valid && (
                    <p id="auth-lastName-error" className="mt-1 text-[10px] text-danger-500 font-medium">{validation.lastName.message}</p>
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
                  aria-invalid={fieldAriaInvalid('email')}
                  aria-describedby={fieldErrorId('email')}
                  className={`${getInputClasses('email')} pr-10`}
                  value={form.email}
                  onChange={(e) => auth.updateField('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                />
                {validation.email.touched && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                    {validation.email.valid
                      ? <RiCheckLine className="text-success-500 text-sm" />
                      : <RiAlertLine className="text-danger-400 text-sm" />
                    }
                  </span>
                )}
              </div>
              {validation.email.touched && !validation.email.valid && (
                <p id="auth-email-error" className="mt-1 text-[10px] text-danger-500 font-medium">{validation.email.message}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="auth-password" className="text-xs font-bold text-slate-600 block mb-1">Contraseña</label>
              <div className="relative">
                <input
                  id="auth-password"
                  name="password"
                  type={auth.showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
                  placeholder="Mín. 8 caracteres"
                  aria-invalid={fieldAriaInvalid('password')}
                  aria-describedby={fieldErrorId('password')}
                  className={`${getInputClasses('password')} pr-10`}
                  value={form.password}
                  onChange={(e) => auth.updateField('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  onKeyDown={auth.handlePasswordKeyEvent}
                  onKeyUp={auth.handlePasswordKeyEvent}
                />
                <button
                  type="button"
                  aria-label={auth.showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={auth.showPassword}
                  onClick={() => auth.setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-150 p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {auth.showPassword
                    ? <RiEyeOffLine className="text-base" />
                    : <RiEyeLine className="text-base" />
                  }
                </button>
              </div>
              {validation.password.touched && !validation.password.valid && (
                <p id="auth-password-error" className="mt-1 text-[10px] text-danger-500 font-medium">{validation.password.message}</p>
              )}
              {auth.capsLockOn && <CapsLockWarning />}

              {/* Indicador de fuerza + checklist — solo Registro */}
              {mode === 'REGISTER' && form.password.length > 0 && (
                <PasswordStrengthMeter strength={auth.passwordStrength} password={form.password} />
              )}
            </div>

            {/* Confirmar Contraseña — solo Registro, con transición animada */}
            <div className={`register-fields-enter ${mode === 'REGISTER' ? 'show' : ''}`}>
              <div>
                <label htmlFor="auth-confirm-password" className="text-xs font-bold text-slate-600 block mb-1">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    id="auth-confirm-password"
                    name="confirmPassword"
                    type={auth.showPassword ? 'text' : 'password'}
                    required={mode === 'REGISTER'}
                    autoComplete="new-password"
                    placeholder="Repite tu contraseña"
                    aria-invalid={fieldAriaInvalid('confirmPassword')}
                    aria-describedby={fieldErrorId('confirmPassword')}
                    className={`${getInputClasses('confirmPassword')} pr-10`}
                    value={form.confirmPassword}
                    onChange={(e) => auth.updateField('confirmPassword', e.target.value)}
                    onBlur={() => mode === 'REGISTER' && handleBlur('confirmPassword')}
                    onKeyDown={auth.handlePasswordKeyEvent}
                    onKeyUp={auth.handlePasswordKeyEvent}
                  />
                  {validation.confirmPassword.touched && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                      {validation.confirmPassword.valid
                        ? <RiCheckLine className="text-success-500 text-sm" />
                        : <RiAlertLine className="text-danger-400 text-sm" />
                      }
                    </span>
                  )}
                </div>
                {validation.confirmPassword.touched && !validation.confirmPassword.valid && (
                  <p id="auth-confirmPassword-error" className="mt-1 text-[10px] text-danger-500 font-medium">{validation.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Botón CTA plano */}
            <button
              className="w-full mt-2 py-3.5 px-5 text-sm font-bold text-white rounded-xl transition-all duration-200 bg-gradient-to-r from-primary to-primary-700 hover:from-primary-hover hover:to-primary-800 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              type="submit"
              disabled={auth.loading === 'AUTH'}
              aria-busy={auth.loading === 'AUTH'}
            >
              {auth.loading === 'AUTH' ? (
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
          {auth.message && (
            <div
              id="auth-status-message"
              role={auth.isErrorMessage ? 'alert' : 'status'}
              aria-live={auth.isErrorMessage ? 'assertive' : 'polite'}
              className={`mt-6 flex items-start space-x-3 rounded-2xl border p-4 text-xs font-semibold transition-all duration-300 auth-slide-up ${
                auth.isErrorMessage
                  ? 'border-danger-100 bg-danger-50 text-danger-800'
                  : 'border-success-100 bg-success-50 text-success-800'
              }`}
            >
              {auth.isErrorMessage ? (
                <RiErrorWarningLine className="h-5 w-5 shrink-0 text-danger-600" />
              ) : (
                <span className={auth.successAnim ? 'validation-icon-enter' : ''}>
                  <RiCheckboxCircleLine className="h-5 w-5 shrink-0 text-success-600" />
                </span>
              )}
              <div className="flex-1 leading-relaxed">{auth.message}</div>
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
