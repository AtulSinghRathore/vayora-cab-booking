import type { ReactNode } from "react";

export type StatusTone = "success" | "error" | "warning" | "info";

const symbols: Record<StatusTone, string> = {
  success: "✓",
  error: "!",
  warning: "△",
  info: "i",
};

export default function StatusMessage({ children, tone = "info", className = "" }: { children?: ReactNode; tone?: StatusTone; className?: string }) {
  if (!children) return null;
  return (
    <div className={`status-message status-message-${tone} ${className}`.trim()} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <span className="status-message-icon" aria-hidden="true">{symbols[tone]}</span>
      <span>{children}</span>
    </div>
  );
}
