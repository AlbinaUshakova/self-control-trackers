import { DEFAULT_GOALS, LANG_KEY, STORAGE_KEY_GOALS, STORAGE_KEY_MEALS, STORAGE_KEY_UPDATE_NOTICE_VERSION, STORAGE_KEY_WELCOME_NOTICE_SEEN } from "./constants";
import type { GoalsState, Lang, MealEntry } from "../types";

function safeParse<T>(value: null | string, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadMeals() {
  return safeParse<MealEntry[]>(localStorage.getItem(STORAGE_KEY_MEALS), []);
}

export function saveMeals(meals: MealEntry[]) {
  localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify(meals));
}

export function loadGoals() {
  const raw = safeParse<Partial<GoalsState>>(localStorage.getItem(STORAGE_KEY_GOALS), DEFAULT_GOALS);
  return {
    minMealsPerDay: raw.minMealsPerDay ?? DEFAULT_GOALS.minMealsPerDay,
    maxMealsPerDay: raw.maxMealsPerDay ?? DEFAULT_GOALS.maxMealsPerDay,
    maxSnacksPerDay: raw.maxSnacksPerDay ?? DEFAULT_GOALS.maxSnacksPerDay,
    minSleepHours: raw.minSleepHours ?? DEFAULT_GOALS.minSleepHours,
    maxSleepHours: raw.maxSleepHours ?? DEFAULT_GOALS.maxSleepHours,
    minDayIntervalMinutes: raw.minDayIntervalMinutes ?? DEFAULT_GOALS.minDayIntervalMinutes,
    maxDayIntervalMinutes: raw.maxDayIntervalMinutes ?? DEFAULT_GOALS.maxDayIntervalMinutes
  };
}

export function saveGoals(goals: GoalsState) {
  localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
}

export function detectBrowserLang(): Lang {
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return candidates.some((item) => item.toLowerCase().startsWith("ru")) ? "ru" : "en";
}

export function loadLang(): Lang {
  const raw = localStorage.getItem(LANG_KEY);
  return raw === "ru" || raw === "en" ? raw : detectBrowserLang();
}

export function saveLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
}

export function isWelcomeSeen() {
  return localStorage.getItem(STORAGE_KEY_WELCOME_NOTICE_SEEN) === "1";
}

export function markWelcomeSeen() {
  localStorage.setItem(STORAGE_KEY_WELCOME_NOTICE_SEEN, "1");
}

export function shouldShowUpdateNotice(currentVersion: string) {
  return localStorage.getItem(STORAGE_KEY_UPDATE_NOTICE_VERSION) !== currentVersion;
}

export function markUpdateNoticeSeen(version: string) {
  localStorage.setItem(STORAGE_KEY_UPDATE_NOTICE_VERSION, version);
}
