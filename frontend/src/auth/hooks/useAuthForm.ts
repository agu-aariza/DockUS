/**
 * @fileoverview Módulo de la interfaz de usuario (useAuthForm).
 *
 * @module useAuthForm
 */

import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { authApi } from "../../shared/api/services";
import type { AuthResponse } from "../../features/auth/types";
import { getErrorMessage } from "../../shared/utils/errors";
import {
  EMPTY_VALIDATION,
  type FieldValidation,
  getPasswordStrength,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateRequired,
} from "../authValidation";

export type AuthMode = "LOGIN" | "REGISTER";

type AuthFormFields = {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
};

const EMPTY_FORM: AuthFormFields = {
  email: '',
  password: '',
  confirmPassword: '',
  firstName: '',
  lastName: '',
};

const LOGIN_FIELDS = ['email', 'password'] as const;
const REGISTER_FIELDS = ['firstName', 'lastName', 'email', 'password', 'confirmPassword'] as const;

function runValidation(
  field: string,
  values: AuthFormFields,
  mode: AuthMode,
): Omit<FieldValidation, 'touched'> {
  switch (field) {
    case 'email':
      return validateEmail(values.email);
    case 'password':
      // La complejidad solo se exige al crear cuenta; ver `validatePassword`.
      return validatePassword(values.password, mode === 'REGISTER');
    case 'confirmPassword':
      return validateConfirmPassword(values.password, values.confirmPassword);
    case 'firstName':
      return validateRequired(values.firstName, 'El nombre');
    case 'lastName':
      return validateRequired(values.lastName, 'Los apellidos');
    default:
      return { valid: true, message: '' };
  }
}

/**
 * Todo el estado y los manejadores de AuthPanel: modo login/registro,
 * formulario, validación por campo (en blur y en vivo una vez tocado),
 * envío con pre-validación client-side y animaciones de estado.
 * Mantiene el componente de presentación separado de la lógica de formulario,
 * igual que el resto de paneles de la aplicación.
 */
export function useAuthForm(
  onAuthSuccess: (_response: AuthResponse) => void,
  initialMode: AuthMode = 'LOGIN',
) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState<AuthFormFields>(EMPTY_FORM);
  const [loading, setLoading] = useState<'AUTH' | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageIsError, setMessageIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const [successAnim, setSuccessAnim] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [validation, setValidation] = useState<Record<string, FieldValidation>>(EMPTY_VALIDATION);

  const formRef = useRef<HTMLFormElement>(null);

  // Clear shake animation after it plays
  useEffect(() => {
    if (shakeForm) {
      const timer = setTimeout(() => setShakeForm(false), 600);
      return () => clearTimeout(timer);
    }
  }, [shakeForm]);

  const handleBlur = useCallback((field: string) => {
    setValidation(prev => ({
      ...prev,
      [field]: { touched: true, ...runValidation(field, form, mode) },
    }));
    setCapsLockOn(false);
  }, [form, mode]);

  /**
   * Actualiza un campo y, si ya fue tocado, revalida en vivo para que el
   * error desaparezca en cuanto el usuario lo corrige (sin esperar al blur).
   * Cambiar la contraseña también revalida su confirmación si ya fue tocada.
   */
  const updateField = useCallback((field: string, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    setValidation(prev => {
      const updates: Record<string, FieldValidation> = {};
      if (prev[field]?.touched) {
        updates[field] = { touched: true, ...runValidation(field, next, mode) };
      }
      if (field === 'password' && prev.confirmPassword?.touched) {
        updates.confirmPassword = {
          touched: true,
          ...runValidation('confirmPassword', next, mode),
        };
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [form, mode]);

  const handlePasswordKeyEvent = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Pre-validación client-side: no llamar a la API con campos inválidos.
    const fieldsToCheck = mode === 'REGISTER' ? REGISTER_FIELDS : LOGIN_FIELDS;
    const results = fieldsToCheck.map(
      (field) => [field, runValidation(field, form, mode)] as const,
    );
    const firstInvalid = results.find(([, result]) => !result.valid);
    if (firstInvalid) {
      setValidation(prev => ({
        ...prev,
        ...Object.fromEntries(
          results.map(([field, result]) => [field, { touched: true, ...result }]),
        ),
      }));
      setMessage('Revisa los campos marcados antes de continuar.');
      setMessageIsError(true);
      setShakeForm(true);
      window.setTimeout(() => {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${firstInvalid[0]}"]`)
          ?.focus();
      }, 0);
      return;
    }

    setLoading('AUTH');
    setMessage('');
    setMessageIsError(false);
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
      setMessageIsError(true);
      setShakeForm(true);
    } finally {
      setLoading(null);
    }
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    setMessage('');
    setMessageIsError(false);
    setSuccessAnim(false);
    setCapsLockOn(false);
    // Reset validation when switching modes
    setValidation(EMPTY_VALIDATION);
  };

  const isErrorMessage = messageIsError;
  const passwordStrength = mode === 'REGISTER' ? getPasswordStrength(form.password) : 0;

  /**
   * Las clases de los inputs viven aquí y no en el JSX porque dependen del
   * estado de validación que gestiona este hook. La base es `.input-field`,
   * el campo estándar de la app; aquí solo se sobreescribe el borde y el
   * anillo de foco según el estado.
   *
   * El estado válido no lleva relleno de color: ya lo señala el icono de
   * check, y un lavado verde en cada campo correcto convierte el formulario
   * en un semáforo.
   */
  const getInputClasses = (field: string) => {
    const v = validation[field];
    if (v?.touched && !v.valid) {
      return "input-field border-danger hover:border-danger focus:border-danger focus:ring-danger/30";
    }
    if (v?.touched && v.valid) {
      return "input-field border-success/60 hover:border-success focus:border-success focus:ring-success/30";
    }
    return "input-field";
  };

  return {
    mode,
    form,
    setForm,
    updateField,
    loading,
    message,
    showPassword,
    setShowPassword,
    shakeForm,
    successAnim,
    capsLockOn,
    validation,
    formRef,
    handleBlur,
    handlePasswordKeyEvent,
    handleSubmit,
    handleModeSwitch,
    isErrorMessage,
    passwordStrength,
    getInputClasses,
  };
}
