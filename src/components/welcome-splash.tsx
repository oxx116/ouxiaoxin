import { useEffect, useRef } from "react";

export function WelcomeSplash({ onDone, line = "歡迎" }: { onDone: () => void; line?: string }) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), 4200);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="welcome-splash" role="status" aria-live="polite">
      <p className="welcome-word">{line}</p>
      <p className="welcome-name">MetricTrader</p>
    </div>
  );
}
