import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getLatestSummary } from "../api/client";

// Checks the exported summary every few minutes. `version` changes only when the export has
// been regenerated, so pages reload their data only when there is something new to show.
const CHECK_EVERY_MS = 5 * 60 * 1000;

const FreshnessContext = createContext({ version: 0, generated: null });

export function FreshnessProvider({ children }) {
  const [version, setVersion] = useState(0);
  const [generated, setGenerated] = useState(null);
  const lastSeen = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const summary = await getLatestSummary();
      if (cancelled) return;
      const stamp = summary?.generated_utc ?? null;
      if (stamp && stamp !== lastSeen.current) {
        lastSeen.current = stamp;
        setVersion((v) => v + 1);
      }
      setGenerated(stamp);
    }

    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <FreshnessContext.Provider value={{ version, generated }}>
      {children}
    </FreshnessContext.Provider>
  );
}

export function useFreshness() {
  return useContext(FreshnessContext);
}

// "just now", "12 min ago", "3 h ago", "2 d ago"
export function timeAgo(iso, now = new Date()) {
  if (!iso) return "unknown";
  const seconds = Math.max(0, Math.round((now - new Date(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
