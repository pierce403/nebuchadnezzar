import { cn } from "@/lib/utils";
import { PropsWithChildren, ReactNode } from "react";

interface CardProps extends PropsWithChildren {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Card({
  title,
  description,
  actions,
  className,
  children,
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-sm backdrop-blur",
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-slate-400">{description}</p>
            )}
          </div>
          {actions && <div className="text-sm text-slate-300">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
