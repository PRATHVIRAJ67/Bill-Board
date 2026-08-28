import { useEffect, useState } from "react";

// Fictional live activity events — cycles through a small pool so the feed
// feels alive without pretending real users exist yet.
const EVENTS = [
  { user: "@pixel_wave",     action: "claimed",     spot: 2  },
  { user: "@strata_app",     action: "joined",      spot: 4  },
  { user: "@neon_foundry",   action: "claimed",     spot: 5  },
  { user: "@lunar_craft",    action: "claimed",     spot: 10 },
  { user: "@apex_realm",     action: "claimed",     spot: 16 },
  { user: "@hyperion_ai",    action: "upgraded",    spot: 7  },
  { user: "@syntax_labs",    action: "claimed",     spot: 8  },
  { user: "@glitch_subculture", action: "claimed",  spot: 22 },
  { user: "@prism_design",   action: "joined",      spot: 23 },
  { user: "@alt_future",     action: "claimed",     spot: 30 },
];

const AGES = ["23s ago", "1m ago", "2m ago", "4m ago", "6m ago", "11m ago"];

export default function LiveActivity({ onFocusSpot }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 4200);
    return () => clearInterval(t);
  }, []);

  const visible = Array.from({ length: 5 }, (_, i) => {
    const ev = EVENTS[(tick + i) % EVENTS.length];
    return { ...ev, age: AGES[i] };
  });

  return (
    <aside className="live-activity" data-testid="live-activity">
      <header className="la-head">
        <span className="la-dot" /> LIVE ACTIVITY
      </header>
      <ul>
        {visible.map((ev, i) => (
          <li
            key={`${ev.user}-${tick}-${i}`}
            className="la-item"
            style={{ animationDelay: `${i * 0.05}s` }}
            data-testid={`activity-${i}`}
            onClick={() => onFocusSpot?.(ev.spot)}
          >
            <span className="la-pin" />
            <span className="la-body">
              <strong>{ev.user}</strong> {ev.action} <em>Spot #{String(ev.spot).padStart(2, "0")}</em>
            </span>
            <span className="la-age">{ev.age}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
