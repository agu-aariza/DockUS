import type { ReactNode } from "react";
import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiCloseCircleLine,
} from "react-icons/ri";

export type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <RiInformationLine />,
  success: <RiCheckboxCircleLine />,
  warning: <RiErrorWarningLine />,
  danger: <RiCloseCircleLine />,
};

const ICON_COLORS: Record<AlertVariant, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function Alert({
  variant = "info",
  title,
  children,
  icon,
  className = "",
}: AlertProps): JSX.Element {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-app-border bg-white p-4 ${className}`}
      role={variant === "danger" || variant === "warning" ? "alert" : undefined}
    >
      <span className={`mt-0.5 shrink-0 text-lg ${ICON_COLORS[variant]}`}>
        {icon ?? ICONS[variant]}
      </span>
      <div className="min-w-0 flex-1">
        {title ? (
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        ) : null}
        <div className={`text-sm leading-6 text-slate-600 ${title ? "mt-1" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
