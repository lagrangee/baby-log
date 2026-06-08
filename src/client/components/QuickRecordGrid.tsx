import type { EventType, PrimaryEventType } from "../types";
import { getCurrentLanguage, localizedText } from "../i18n";
import { PRIMARY_ACTIONS, eventLabel } from "../utils/format";

export type QuickRecordType = PrimaryEventType | Extract<EventType, "growth_measurement">;

export interface QuickRecordAction {
  type: QuickRecordType;
  label: string;
  category: string;
  mark: string;
}

interface QuickRecordGridProps {
  hasOpenSleep: boolean;
  hasOpenBreast: boolean;
  busyType: QuickRecordType | null;
  actions?: ReadonlyArray<QuickRecordAction>;
  hideBreastfeeding?: boolean;
  onAction: (type: QuickRecordType) => void;
}

export const DEFAULT_QUICK_ACTIONS: ReadonlyArray<QuickRecordAction> = [
  ...PRIMARY_ACTIONS,
  localizedAction("growth_measurement", { en: "Growth", zh: "生长" }, { en: "G", zh: "长" })
];

export const FAMILY_QUICK_ACTIONS: ReadonlyArray<QuickRecordAction> = [
  localizedAction("feed_bottle", { en: "Feeding", zh: "喂养" }, { en: "BT", zh: "奶" }),
  localizedAction("diaper_pee", { en: "Diaper", zh: "尿布" }, { en: "P", zh: "尿" }),
  localizedAction("diaper_poop", { en: "Diaper", zh: "尿布" }, { en: "BM", zh: "便" }),
  localizedAction("temperature", { en: "Health", zh: "健康" }, { en: "T", zh: "温" }, { en: "Forehead temp", zh: "额温" }),
  localizedAction("sleep_session", { en: "Sleep", zh: "睡眠" }, { en: "SL", zh: "睡" }, { en: "Start sleep", zh: "开始睡觉" })
];

export function QuickRecordGrid({ hasOpenSleep, hasOpenBreast, busyType, actions = DEFAULT_QUICK_ACTIONS, hideBreastfeeding = false, onAction }: QuickRecordGridProps) {
  const visibleActions = hideBreastfeeding ? actions.filter((action) => action.type !== "feed_breast") : actions;
  return (
    <section className="quick-grid" aria-label={localizedText({ en: "Quick record", zh: "快捷记录" })}>
      {visibleActions.map((action) => {
        let label = action.type === "sleep_session" ? (hasOpenSleep ? localizedText({ en: "Wake up", zh: "睡醒" }) : action.label) : action.label;
        if (action.type === "feed_breast") label = hasOpenBreast ? localizedText({ en: "End breastfeed", zh: "结束亲喂" }) : eventLabel("feed_breast");
        return (
          <button
            key={action.type}
            type="button"
            className={`quick quick-${action.type}`}
            disabled={busyType !== null}
            onClick={() => onAction(action.type)}
          >
            <span className="quick-mark" aria-hidden="true">
              {action.mark}
            </span>
            <span className="quick-label">{label}</span>
            <span className="quick-kind">{action.category}</span>
          </button>
        );
      })}
    </section>
  );
}

function localizedAction(
  type: QuickRecordType,
  category: Record<"en" | "zh", string>,
  mark: Record<"en" | "zh", string>,
  label?: Record<"en" | "zh", string>
): QuickRecordAction {
  return {
    type,
    get label() {
      return label ? label[getCurrentLanguage()] : eventLabel(type);
    },
    get category() {
      return category[getCurrentLanguage()];
    },
    get mark() {
      return mark[getCurrentLanguage()];
    }
  };
}
