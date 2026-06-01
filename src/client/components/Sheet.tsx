import type { ReactNode } from "react";
import { useI18n } from "../i18n";

interface SheetProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Sheet({ title, children, onClose }: SheetProps) {
  const { text: tx } = useI18n();
  return (
    <div className="sheet-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sheet-head">
          <h2 id="sheet-title">{title}</h2>
          <button className="ghost small" type="button" onClick={onClose}>
            {tx({ en: "Close", zh: "关闭" })}
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
