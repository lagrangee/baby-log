import { useEffect, useState } from "react";
import type { EventType } from "../types";
import { formatDuration, formatTime, minutesSince } from "../utils/time";

interface ActiveSessionPreview {
  event_type: EventType;
  occurred_at: string;
}

interface ActiveSessionCardProps {
  session: ActiveSessionPreview | null;
  timezone: string;
  busy?: boolean;
  title?: string;
  actionLabel?: string;
  elapsedLabel?: string;
  onWake?: () => void;
}

export function ActiveSessionCard({ session, timezone, busy, title = "睡眠中", actionLabel = "睡醒", elapsedLabel = "已睡", onWake }: ActiveSessionCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!session) return undefined;
    const interval = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(interval);
  }, [session]);

  if (!session) return null;

  return (
    <section className="active-session">
      <div>
        <p className="eyebrow">当前状态</p>
        <h2>{title}</h2>
        <p>
          开始 {formatTime(session.occurred_at, timezone)} · {elapsedLabel} {formatDuration(minutesSince(session.occurred_at))}
        </p>
      </div>
      {onWake ? (
        <button className="primary wake-button" type="button" disabled={busy} onClick={onWake}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
