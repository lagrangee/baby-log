import type { DisplayEventRecord } from "../types";
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

export function RecentEvents<TEvent extends DisplayEventRecord>({ events, timezone, limit = 10, editable = true, onDelete, onEdit }: RecentEventsProps<TEvent>) {
  const items = events.slice(0, limit);

  if (!items.length) {
    return (
      <section className="panel">
        <h2>最近记录</h2>
        <p className="empty">还没有记录。先从一次喂养或一次小便开始。</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-head">
        <h2>最近记录</h2>
        <span>{items.length} 条</span>
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
                    编辑
                  </button>
                ) : null}
                {onDelete ? (
                  <button className="danger small" type="button" onClick={() => onDelete(event)}>
                    删除
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
