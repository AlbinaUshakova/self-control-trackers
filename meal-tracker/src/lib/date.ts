import type { DailyStats, Lang, MealEntry } from "../types";
import { RETENTION_DAYS } from "./constants";

export function isSameDay(ts: number, refDate: Date) {
  const d1 = new Date(ts);
  return d1.getFullYear() === refDate.getFullYear() &&
    d1.getMonth() === refDate.getMonth() &&
    d1.getDate() === refDate.getDate();
}

export function getDayKey(dateOrTs: Date | number) {
  const d = dateOrTs instanceof Date ? dateOrTs : new Date(dateOrTs);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function formatTimeHM(ts: number, lang: Lang) {
  return new Date(ts).toLocaleTimeString(lang === "ru" ? "ru-RU" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function formatDateDMY(ts: number, lang: Lang) {
  return new Date(ts).toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "2-digit"
  });
}

export function formatTodayFeedTitle(lang: Lang) {
  return lang === "ru" ? "Сегодня" : "Today's log";
}

export function formatInterval(ms: null | number, lang: Lang) {
  if (ms == null || Number.isNaN(ms)) return "–";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (lang === "ru") {
    if (h > 0 && m > 0) return `${h} ч ${m} м`;
    if (h > 0) return `${h} ч`;
    return `${m} м`;
  }
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function formatMealIntervalStat(ms: null | number, lang: Lang) {
  if (ms == null || !Number.isFinite(ms) || ms < 60000) return lang === "ru" ? "Недостаточно данных" : "Not enough data";
  return formatInterval(ms, lang);
}

export function formatNumberPerDay(value: number) {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function roundToHalfHour(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 2) / 2;
}

export function getAllMealsSorted(meals: MealEntry[]) {
  return [...meals].sort((a, b) => a.ts - b.ts);
}

export function pruneOldMeals(meals: MealEntry[]) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return meals.filter((meal) => meal.ts >= cutoff);
}

export function getTodayMeals(meals: MealEntry[]) {
  const now = new Date();
  return meals.filter((meal) => isSameDay(meal.ts, now)).sort((a, b) => a.ts - b.ts);
}

export function getSleepIntervalForDay(dayMeals: MealEntry[], allMeals: MealEntry[]) {
  const first = dayMeals[0];
  let prev: MealEntry | null = null;
  for (const meal of allMeals) {
    if (meal.ts < first.ts && (!prev || meal.ts > prev.ts)) prev = meal;
  }
  return prev ? first.ts - prev.ts : null;
}

export function computeDailyStats(meals: MealEntry[]): DailyStats[] {
  if (meals.length === 0) return [];
  const byDayKey: Record<string, MealEntry[]> = {};
  for (const meal of meals) {
    const key = getDayKey(meal.ts);
    byDayKey[key] ??= [];
    byDayKey[key].push(meal);
  }
  const allSorted = getAllMealsSorted(meals);
  return Object.entries(byDayKey)
    .map(([key, dayMeals]) => {
      const sorted = [...dayMeals].sort((a, b) => a.ts - b.ts);
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) intervals.push(sorted[i].ts - sorted[i - 1].ts);
      const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : null;
      return {
        key,
        ts: sorted[0].ts,
        count: sorted.length,
        snacksCount: sorted.filter((item) => item.isSnack).length,
        sleepInterval: getSleepIntervalForDay(sorted, allSorted),
        avgInterval
      };
    })
    .sort((a, b) => b.ts - a.ts);
}
