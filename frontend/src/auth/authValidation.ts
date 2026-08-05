/**
 * @fileoverview Módulo de la interfaz de usuario (authValidation).
 *
 * @module authValidation
 */

/* ─── Password Strength ─── */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export function getPasswordStrength(password: string): StrengthLevel {
  if (!password || password.length < 8) return 0;
  let score = 1; // meets minimum length
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password) && password.length >= 12) score++;
  return Math.min(score, 4) as StrengthLevel;
}

// Escala de 4 tonos (rojo→naranja→amarillo→verde) deliberadamente fuera del
// sistema de tokens danger/warning/success: son 3 estados
// semánticos, no 4 puntos de un degradado ordenado, y colapsar naranja+amarillo
// en un único "warning" perdería el nivel intermedio que este medidor existe
// para mostrar. Único uso de `orange`/`yellow` en todo el frontend.
export const STRENGTH_CONFIG: Record<
  StrengthLevel,
  { label: string; color: string; barColor: string }
> = {
  0: { label: '', color: '', barColor: '' },
  1: { label: 'Débil', color: 'text-red-500', barColor: 'bg-red-500' },
  2: { label: 'Regular', color: 'text-orange-500', barColor: 'bg-orange-500' },
  3: { label: 'Buena', color: 'text-yellow-500', barColor: 'bg-yellow-500' },
  4: { label: 'Fuerte', color: 'text-emerald-500', barColor: 'bg-emerald-500' },
};

/* ─── Validation ─── */
export interface FieldValidation {
  touched: boolean;
  valid: boolean;
  message: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): Omit<FieldValidation, 'touched'> {
  if (!value.trim()) return { valid: false, message: 'El correo es obligatorio' };
  if (!EMAIL_RE.test(value)) return { valid: false, message: 'Formato de correo inválido' };
  return { valid: true, message: '' };
}

export function validateRequired(value: string, label: string): Omit<FieldValidation, 'touched'> {
  if (!value.trim()) return { valid: false, message: `${label} es obligatorio` };
  return { valid: true, message: '' };
}

/*
 * Contrato de `RegisterDto` en el backend: 8+ caracteres, una mayúscula, una
 * minúscula y un dígito O un carácter especial. Estos tres literales existen
 * para no repetir la regla entre el validador y el checklist de abajo.
 *
 * `\W` no incluye el guion bajo, igual que en la expresión del backend.
 */
const HAS_UPPER = /[A-Z]/;
const HAS_LOWER = /[a-z]/;
const HAS_DIGIT_OR_SPECIAL = /[\d\W]/;

/**
 * @param requireStrong Aplica la complejidad que exige el backend. Solo se
 *   activa al crear cuenta: `LoginDto` no tiene regla de complejidad, y
 *   exigirla al entrar bloquearía cuentas creadas antes de que existiera.
 */
export function validatePassword(
  value: string,
  requireStrong = false,
): Omit<FieldValidation, 'touched'> {
  if (!value) return { valid: false, message: 'La contraseña es obligatoria' };
  if (value.length < 8) return { valid: false, message: 'Mínimo 8 caracteres' };
  if (!requireStrong) return { valid: true, message: '' };
  if (!HAS_UPPER.test(value) || !HAS_LOWER.test(value)) {
    return { valid: false, message: 'Combina mayúsculas y minúsculas' };
  }
  if (!HAS_DIGIT_OR_SPECIAL.test(value)) {
    return { valid: false, message: 'Añade un número o un carácter especial' };
  }
  return { valid: true, message: '' };
}

export function validateConfirmPassword(
  password: string,
  confirm: string,
): Omit<FieldValidation, 'touched'> {
  if (!confirm) return { valid: false, message: 'Confirma tu contraseña' };
  if (confirm !== password) return { valid: false, message: 'Las contraseñas no coinciden' };
  return { valid: true, message: '' };
}

/* ─── Checklist de requisitos (registro) ─── */
export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * El checklist enumera exactamente lo que `validatePassword` exige en modo
 * registro. Si cambia una regla, cambian las dos: antes el checklist pedía
 * "al menos un número" mientras el backend aceptaba también un carácter
 * especial, y el formulario dejaba pasar contraseñas que el servidor
 * rechazaba con un 400.
 */
export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { id: 'length', label: 'Mínimo 8 caracteres', test: (pw) => pw.length >= 8 },
  {
    id: 'case',
    label: 'Mayúsculas y minúsculas',
    test: (pw) => HAS_LOWER.test(pw) && HAS_UPPER.test(pw),
  },
  {
    id: 'digit',
    label: 'Un número o carácter especial',
    test: (pw) => HAS_DIGIT_OR_SPECIAL.test(pw),
  },
];

export const EMPTY_VALIDATION: Record<string, FieldValidation> = {
  email: { touched: false, valid: true, message: '' },
  password: { touched: false, valid: true, message: '' },
  confirmPassword: { touched: false, valid: true, message: '' },
  firstName: { touched: false, valid: true, message: '' },
  lastName: { touched: false, valid: true, message: '' },
};
