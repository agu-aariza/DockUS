/**
 * @fileoverview Módulo de la interfaz de usuario (PasswordStrengthMeter).
 *
 * @module PasswordStrengthMeter
 */

import { RiCheckLine, RiSubtractLine } from "react-icons/ri";
import {
  PASSWORD_REQUIREMENTS,
  STRENGTH_CONFIG,
  type StrengthLevel,
} from "../authValidation";

interface PasswordStrengthMeterProps {
  strength: StrengthLevel;
  password: string;
}

export function PasswordStrengthMeter({ strength, password }: PasswordStrengthMeterProps): JSX.Element {
  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {([1, 2, 3, 4] as const).map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              strength >= level
                ? `${STRENGTH_CONFIG[level].barColor} strength-bar-segment active`
                : 'bg-app-border strength-bar-segment'
            }`}
          />
        ))}
      </div>
      {strength > 0 && (
        <p className={`text-[11px] font-semibold ${STRENGTH_CONFIG[strength].color} transition-colors duration-300`}>
          {STRENGTH_CONFIG[strength].label}
        </p>
      )}
      {/* En fila, no apilados: tres líneas sueltas empujaban el formulario de
          registro por debajo del pliegue en pantallas de portátil. */}
      <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
        {PASSWORD_REQUIREMENTS.map((req) => {
          const met = req.test(password);
          return (
            <li
              key={req.id}
              className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-medium transition-colors duration-200 ${
                met ? 'text-success' : 'text-app-text-muted'
              }`}
            >
              {met
                ? <RiCheckLine className="text-xs validation-icon-enter" />
                : <RiSubtractLine className="text-xs" />
              }
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
