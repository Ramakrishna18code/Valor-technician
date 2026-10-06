import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { greetingForHour } from "../utils/greeting";

/** Refresh at local time boundaries and when the app returns to the foreground. */
export function useGreeting() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30_000);
    const subscription = AppState?.addEventListener?.("change", state => { if (state === "active") update(); });
    return () => { clearInterval(timer); subscription?.remove(); };
  }, []);
  return greetingForHour(now.getHours());
}
