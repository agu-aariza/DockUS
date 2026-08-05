/**
 * @fileoverview Módulo de la interfaz de usuario (UniversityCrest).
 *
 * @module UniversityCrest
 */

import { LogoPlate } from "../../shared/components/ui/LogoPlate";

interface UniversityCrestProps {
  className?: string;
}

/**
 * Escudo oficial de la Universidad de Sevilla (`public/uni_sev.jpeg` — pese a
 * la extensión es un PNG con canal alfa). Va sobre `LogoPlate`, que resuelve
 * el fondo según el tema.
 */
export function UniversityCrest({ className = "" }: UniversityCrestProps): JSX.Element {
  return (
    <LogoPlate src="/uni_sev.jpeg" alt="Universidad de Sevilla" className={className} />
  );
}
