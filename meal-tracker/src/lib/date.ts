import type { DailyStats, Lang, MealEntry } from "../types";
import { RETENTION_DAYS } from "./constants";

export function isSameDay(ts: number, refDate: Date) {
  const d1 = new Date(ts);
  return d1.getFullYear() === refDate.getFullYear() &&
    d1.getMonth() === refDate.getMonth() &&
    d1.getDate() === refDate.getDate();
}

export function getDay