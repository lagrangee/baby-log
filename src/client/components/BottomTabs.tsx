import { useI18n } from "../i18n";

const tabs = [
  { path: "/app", labelKey: "nav.record" },
  { path: "/app/yesterday", labelKey: "nav.yesterday" },
  { path: "/app/timeline", labelKey: "nav.timeline" },
  { path: "/app/checklist", labelKey: "nav.checklist" },
  { path: "/app/more", labelKey: "nav.more" }
] as const;

interface BottomTabsProps {
  activePath: string;
  onNavigate: (path: string) => void;
}

export function BottomTabs({ activePath, onNavigate }: BottomTabsProps) {
  const { t } = useI18n();
  return (
    <nav className="tabs" aria-label="Primary navigation">
      {tabs.map((tab) => (
        <a
          key={tab.path}
          href={tab.path}
          className={activePath === tab.path ? "active" : ""}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(tab.path);
          }}
        >
          {t(tab.labelKey)}
        </a>
      ))}
    </nav>
  );
}
