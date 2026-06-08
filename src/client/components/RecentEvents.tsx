import type { DisplayEventRecord } from "../types";
import { useI18n } from "../i18n";
import { eventLabel, formatEventValue } from "../utils/format";
import { formatTime } from "../utils/time";

interface RecentEventsProps<TEvent extends DisplayEventRecord> {
  events: TEvent[];
  timezone: string;
  limit?: number;
  editable?: boolean;
  onDelete?: (event: TEvent) => void;
  onEdit?: (event: TEvent) => void;
}

export function RecentEvents<TEvent extends DisplayEventRecord>({ events, timezone, limit, editable = true, onDelete, onEdit }: RecentEventsProps<TEvent>) {
  const { text: tx } = useI18n();
  const items = limit == null ? events : events.slice(0, limit);

  if (!items.length) {
    return (
      <section className="panel">
        <h2>{tx({ en: "Recent records", zh: "最近记录" })}</h2>
        <p className="empty">{tx({ en: "No records yet. Start with a feeding or a pee.", zh: "还没有记录。先从一次喂养或一次小便开始。" })}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>{tx({ en: "Recent records", zh: "最近记录" })}</h2>
        <span>{tx({ en: "{count} records", zh: "{count} 条" }, { count: items.length })}</span>
      </div>
      <div className="event-list">
        {items.map((event, index) => (
          <article key={event.id ?? `${event.event_type}-${event.occurred_at}-${index}`} className="event-row">
            <div>
              <strong>{eventLabel(event.event_type)}</strong>
              <p>
                {formatTime(event.occurred_at, timezone)}
                <span>{formatEventValue(event)}</span>
              </p>
              {event.note && event.event_type !== "note" ? <small>{event.note}</small> : null}
            </div>
            {editable ? (
              <div className="row-actions compact">
                {onEdit ? (
                  <button className="secondary small" type="button" onClick={() => onEdit(event)}>
                    {tx({ en: "Edit", zh: "编辑" })}
                  </button>
                ) : null}
                {onDelete ? (
                  <button className="danger small" type="button" onClick={() => onDelete(event)}>
                    {tx({ en: "Delete", zh: "删除" })}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
