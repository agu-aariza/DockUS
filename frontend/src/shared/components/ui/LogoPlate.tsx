/**
 * @fileoverview Módulo de la interfaz de usuario (LogoPlate).
 *
 * @module LogoPlate
 */

interface LogoPlateProps {
  src: string;
  /** Vacío cuando el nombre ya aparece como texto al lado del logo. */
  alt?: string;
  className?: string;
}

/**
 * Placa para logos de terceros (universidad, departamento, lenguajes,
 * proveedores de modelo).
 *
 * Los ficheros son heterogéneos y no se pueden tratar igual sin más:
 * - `logo_c/py/cpp/bash.webp` y `aws/gemini.webp` **no tienen canal alfa**
 *   llevan el fondo blanco quemado dentro del propio fichero.
 * - `logo_java/js/dit.png`, `anthropic.png` y `uni_sev.jpeg` (que pese a la
 *   extensión es un PNG) **sí son transparentes**, y algunos tienen tinta
 *   oscura — `logo_js.png` lleva el texto "JavaScript" en negro.
 *
 * Sobre superficie clara los opacos se funden solos con la tarjeta blanca y
 * los transparentes se leen bien, así que ahí no hace falta placa ninguna.
 * Sobre fondo oscuro pasa lo contrario: los transparentes con tinta oscura
 * desaparecerían. De ahí que el blanco se aplique **solo en modo oscuro**.
 *
 * Si algún día se reexportan los `.webp` con transparencia, esto no hay que
 * tocarlo: seguiría siendo correcto.
 */
export function LogoPlate({ src, alt = "", className = "" }: LogoPlateProps): JSX.Element {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded p-1 dark:bg-white ${className}`}
    >
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    </span>
  );
}
