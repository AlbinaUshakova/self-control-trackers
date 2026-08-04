import type { GoalsState } from "../types";

export const LANG_KEY = "eatlog_lang";
export const STORAGE_KEY_MEALS = "meal_tracker_meals_v1";
export const STORAGE_KEY_GOALS = "meal_tracker_goals_v1";
export const STORAGE_KEY_WELCOME_NOTICE_SEEN = "meal_tracker_welcome_notice_seen_v1";
export const STORAGE_KEY_UPDATE_NOTICE_VERSION = "meal_tracker_update_notice_version_v1";
export const CURRENT_UPDATE_NOTICE_VERSION = "2026-08-04";
export const RETENTION_DAYS = 21;
export const MEAL_NOTE_MAX_LENGTH = 220;

export const DEFAULT_GOALS: GoalsState = {
  minMealsPerDay: 2,
  maxMealsPerDay: 3,
  maxSnacksPerDay: 1,
  minSleepHours: 14,
  maxSleepHours: 16,
  minDayIntervalMinutes: 240,
  maxDayIntervalMinutes: 300
};
