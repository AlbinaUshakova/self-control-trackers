export type Lang = "ru" | "en";
export type ViewKey = "today" | "stats" | "goals";
export type PeriodKey = "today" | "7" | "14" | "21";

export type MealEntry = {
  id: string;
  ts: number;
  note: string;
  isSnack: boolean;
};

export type GoalsState = {
  mealsPerDay: null | number;
  maxSnacksPerDay: null | number;
};

export type DailyStats = {
  key: string;
  ts: number;
  count: number;
  snacksCount: number;
  sleepInterval: null | number;
  avgInterval: null | number;
};

export type ConfirmState = {
  title?: string;
  body?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
};

export type ToastState = {
  title: string;
  text?: string;
};
