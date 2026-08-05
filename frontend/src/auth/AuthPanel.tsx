/**
 * @fileoverview Módulo de la interfaz de usuario (AuthPanel).
 *
 * @module AuthPanel
 */

import { Link } from "react-router";
import type { AuthResponse } from "../features/auth/types";
import {
  RiLoader4Line,
  RiErrorWarningLine,
  RiCheckboxCircleLine,
  RiEyeLine,
  RiEyeOffLine,
  RiCheckLine,
  RiAlertLine,
  RiArrowLeftLine,
} from 'react-icons/ri';
import "./authPanel.css";
import { UniversityCrest } from "../landing/components/UniversityCrest";
import { AuthAsidePanel } from "./components/AuthAsidePanel";
import { PasswordStrengthMeter } from "./components/PasswordStrengthMeter";
import { type AuthMode, useAuthForm } from "./hooks/useAuthForm";

interface AuthPanelProps {
  onAuthSuccess: (response: AuthResponse) => void;
  /** Pestaña inicial. La landing enlaza aquí con `?modo=crear`. */
  initialMode?: AuthMode;
}

/** Aviso de Bloq Mayús compartido por los campos de contraseña. */
function CapsLockWarning(): JSX.Element {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-warning auth-slide-up">
      <RiAlertLine className="text-xs" />
      Bloq Mayús está activado
    </p>
  );
}

/** Etiqueta de campo: versalita mono, el registro documental del membrete. */
const FIELD_LABEL = "institutional-line mb-1.5 block text-app-text-muted";

export function AuthPanel({ onAuthSuccess, initialMode }: AuthPanelProps): JSX.Element {
  const auth = useAuthForm(onAuthSuccess, initialMode);
  const { mode, form, validation, handleBlur, getInputClasses } = auth;

  const fieldErrorId = (field: string) =>
    validation[field]?.touched && !validation[field]?.valid
      ? `auth-${field}-error`
      : undefined;

  const fieldAriaInvalid = (field: string) =>
    validation[field]?.touched && !validation[field]?.valid ? true : undefined;

  const tabClasses = (tab: AuthMode) =>
    `-mb-px border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
      mode === tab
        ? 'border-accent text-app-text'
        : 'border-transparent text-app-text-muted hover:text-app-text-secondary'
    }`;

  return (
    <div className="flex min-h-screen bg-app-bg text-app-text">
      <AuthAsidePanel />

      {/* Columna del formulario: centrada en el espacio que deja el panel. */}
      <div className="mx-auto flex w-full max-w-md flex-col px-6 lg:max-w-lg lg:px-10">
        <div className="py-4">
          <Link
            to="/"
            className="institutional-line inline-flex items-center gap-1.5 rounded text-app-text-muted transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-4 focus-visible:ring-offset-app-bg"
          >
            <RiArrowLeftLine className="text-sm" aria-hidden="true" />
            Volver
          </Link>
        </div>

        <main
          className={`flex flex-1 flex-col justify-center pb-8 ${auth.shakeForm ? 'auth-shake' : ''}`}
        >
          {/* Membrete: solo por debajo de `lg`. En escritorio la marca ya está
              en el panel de la izquierda y repetirla robaba alto al formulario.
              Lockup horizontal para que el registro entre en un portátil. */}
          <div className="lg:hidden">
            <div className="flex items-center gap-3">
              <img
                src="/logos/Logo01.png"
                alt=""
                className="h-11 w-11 shrink-0 rounded-full"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-wide">EduCode AI</div>
                <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-app-text-muted">
                  Containerizing Academic Excellence
                </div>
                <p className="institutional-line mt-1 text-accent">
                  Universidad de Sevilla · Telemática
                </p>
              </div>
            </div>
            <div className="accent-rule mt-4" />
          </div>

          {/* Switcher de modo */}
          <div
            className="mt-7 flex gap-7 border-b border-app-border"
            role="tablist"
            aria-label="Modo de acceso"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'LOGIN'}
              aria-controls="auth-login-panel"
              id="auth-login-tab"
              onClick={() => auth.handleModeSwitch('LOGIN')}
              className={tabClasses('LOGIN')}
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
              className={tabClasses('REGISTER')}
            >
              Crear cuenta
            </button>
          </div>

          <h1 className="mt-6 font-display text-3xl leading-tight">
            {mode === 'LOGIN' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-app-text-secondary">
            {mode === 'LOGIN'
              ? 'Accede a tus proyectos, entregas y evaluaciones.'
              : 'Se te dará acceso como estudiante. El profesorado te asignará los proyectos.'}
          </p>

          {/* Formulario — noValidate: la validación la gestiona useAuthForm
              con mensajes propios y focus al primer campo inválido */}
          <form
            ref={auth.formRef}
            id={mode === 'LOGIN' ? 'auth-login-panel' : 'auth-register-panel'}
            role="tabpanel"
            aria-labelledby={mode === 'LOGIN' ? 'auth-login-tab' : 'auth-register-tab'}
            aria-describedby={auth.message ? 'auth-status-message' : undefined}
            noValidate
            className="mt-6 space-y-4"
            onSubmit={(event) => void auth.handleSubmit(event)}
          >
            {/* Campos de Registro (Nombre / Apellidos) — con transición animada */}
            <div className={`register-fields-enter ${mode === 'REGISTER' ? 'show' : ''}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="auth-first-name" className={FIELD_LABEL}>Nombre</label>
                  <div className="relative">
                    <input
                      id="auth-first-name"
                      name="firstName"
                      type="text"
                      required={mode === 'REGISTER'}
                      autoComplete="given-name"
                      placeholder="Ana"
                      aria-invalid={fieldAriaInvalid('firstName')}
                      aria-describedby={fieldErrorId('firstName')}
                      className={`${getInputClasses('firstName')} pr-9`}
                      value={form.firstName}
                      onChange={(e) => auth.updateField('firstName', e.target.value)}
                      onBlur={() => mode === 'REGISTER' && handleBlur('firstName')}
                    />
                    {validation.firstName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.firstName.valid
                          ? <RiCheckLine className="text-sm text-success" />
                          : <RiAlertLine className="text-sm text-danger" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.firstName.touched && !validation.firstName.valid && (
                    <p id="auth-firstName-error" className="mt-1.5 text-[11px] font-medium text-danger">{validation.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="auth-last-name" className={FIELD_LABEL}>Apellidos</label>
                  <div className="relative">
                    <input
                      id="auth-last-name"
                      name="lastName"
                      type="text"
                      required={mode === 'REGISTER'}
                      autoComplete="family-name"
                      placeholder="García"
                      aria-invalid={fieldAriaInvalid('lastName')}
                      aria-describedby={fieldErrorId('lastName')}
                      className={`${getInputClasses('lastName')} pr-9`}
                      value={form.lastName}
                      onChange={(e) => auth.updateField('lastName', e.target.value)}
                      onBlur={() => mode === 'REGISTER' && handleBlur('lastName')}
                    />
                    {validation.lastName.touched && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                        {validation.lastName.valid
                          ? <RiCheckLine className="text-sm text-success" />
                          : <RiAlertLine className="text-sm text-danger" />
                        }
                      </span>
                    )}
                  </div>
                  {validation.lastName.touched && !validation.lastName.valid && (
                    <p id="auth-lastName-error" className="mt-1.5 text-[11px] font-medium text-danger">{validation.lastName.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="auth-email" className={FIELD_LABEL}>Correo institucional</label>
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
                  className={`${getInputClasses('email')} pr-9`}
                  value={form.email}
                  onChange={(e) => auth.updateField('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                />
                {validation.email.touched && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                    {validation.email.valid
                      ? <RiCheckLine className="text-sm text-success" />
                      : <RiAlertLine className="text-sm text-danger" />
                    }
                  </span>
                )}
              </div>
              {validation.email.touched && !validation.email.valid && (
                <p id="auth-email-error" className="mt-1.5 text-[11px] font-medium text-danger">{validation.email.message}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="auth-password" className={FIELD_LABEL}>Contraseña</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-app-text-muted transition-colors hover:text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {auth.showPassword
                    ? <RiEyeOffLine className="text-base" />
                    : <RiEyeLine className="text-base" />
                  }
                </button>
              </div>
              {validation.password.touched && !validation.password.valid && (
                <p id="auth-password-error" className="mt-1.5 text-[11px] font-medium text-danger">{validation.password.message}</p>
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
                <label htmlFor="auth-confirm-password" className={FIELD_LABEL}>Confirmar contraseña</label>
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
                    className={`${getInputClasses('confirmPassword')} pr-9`}
                    value={form.confirmPassword}
                    onChange={(e) => auth.updateField('confirmPassword', e.target.value)}
                    onBlur={() => mode === 'REGISTER' && handleBlur('confirmPassword')}
                    onKeyDown={auth.handlePasswordKeyEvent}
                    onKeyUp={auth.handlePasswordKeyEvent}
                  />
                  {validation.confirmPassword.touched && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 validation-icon-enter">
                      {validation.confirmPassword.valid
                        ? <RiCheckLine className="text-sm text-success" />
                        : <RiAlertLine className="text-sm text-danger" />
                      }
                    </span>
                  )}
                </div>
                {validation.confirmPassword.touched && !validation.confirmPassword.valid && (
                  <p id="auth-confirmPassword-error" className="mt-1.5 text-[11px] font-medium text-danger">{validation.confirmPassword.message}</p>
                )}
              </div>
            </div>

            <button
              className="cta-primary w-full"
              type="submit"
              disabled={auth.loading === 'AUTH'}
              aria-busy={auth.loading === 'AUTH'}
            >
              {auth.loading === 'AUTH' ? (
                <>
                  <RiLoader4Line className="h-4 w-4 animate-spin" />
                  <span>{mode === 'LOGIN' ? 'Entrando…' : 'Creando cuenta…'}</span>
                </>
              ) : (
                <span>{mode === 'LOGIN' ? 'Entrar' : 'Crear cuenta'}</span>
              )}
            </button>
          </form>

          {/* Mensajes de estado */}
          {auth.message && (
            <div
              id="auth-status-message"
              role={auth.isErrorMessage ? 'alert' : 'status'}
              aria-live={auth.isErrorMessage ? 'assertive' : 'polite'}
              className={`mt-4 flex items-start gap-3 rounded-md border p-3.5 text-xs font-medium leading-relaxed auth-slide-up ${
                auth.isErrorMessage
                  ? 'border-danger/30 bg-danger/[0.06] text-danger'
                  : 'border-success/30 bg-success/[0.06] text-success'
              }`}
            >
              {auth.isErrorMessage ? (
                <RiErrorWarningLine className="mt-px h-4 w-4 shrink-0" />
              ) : (
                <span className={auth.successAnim ? 'validation-icon-enter' : ''}>
                  <RiCheckboxCircleLine className="mt-px h-4 w-4 shrink-0" />
                </span>
              )}
              <div className="flex-1">{auth.message}</div>
            </div>
          )}
        </main>

        <footer className="flex items-center gap-3 border-t border-app-border py-4">
          {/* El escudo ya está en el panel izquierdo en escritorio. */}
          <UniversityCrest className="h-11 w-11 lg:hidden" />
          <span className="font-mono text-[11px] leading-relaxed text-app-text-muted">
            {mode === 'LOGIN'
              ? 'Acceso para miembros de la Universidad de Sevilla.'
              : 'Al crear una cuenta aceptas las políticas de uso académico de EduCode AI.'}
          </span>
        </footer>
      </div>
    </div>
  );
}
