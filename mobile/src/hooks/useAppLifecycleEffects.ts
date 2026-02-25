import { useEffect } from "react";
import { Screen, User } from "../types/workout";

type UseAppLifecycleEffectsParams = {
  user: User | null;
  screen: Screen;
  calendarMonth: Date;
  refreshHomeHistory: () => Promise<void>;
  loadCalendarHistory: (monthCursor: Date) => Promise<void>;
};

export function useAppLifecycleEffects({
  user,
  screen,
  calendarMonth,
  refreshHomeHistory,
  loadCalendarHistory
}: UseAppLifecycleEffectsParams): void {
  useEffect(() => {
    if (user) {
      refreshHomeHistory().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (screen !== "calendar" || !user) {
      return;
    }
    loadCalendarHistory(calendarMonth).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, user, calendarMonth]);
}
