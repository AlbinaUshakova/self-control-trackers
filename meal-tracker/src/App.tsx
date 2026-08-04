import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  Clock3,
  Cookie,
  Globe,
  MoonStar,
  Pencil,
  Plus,
  Salad,
  Trash2
} from "lucide-react";
import { CURRENT_UPDATE_NOTICE_VERSION, MEAL_NOTE_MAX_LENGTH } from "./lib/constants";
import { computeDailyStats, formatDateDMY, formatInterval, formatMealIntervalStat, formatNumberPerDay, formatTimeHM, formatTodayFeedTitle, getAllMealsSorted, getDayKey, getTodayMeals, pruneOldMeals, roundToHalfHour } from "./lib/date";
import { t } from "./lib/i18n";
import { isWelcomeSeen, loadGoals, loadLang, loadMeals, markUpdateNoticeSeen, markWelcomeSeen, saveGoals, saveLang, saveMeals, shouldShowUpdateNotice } from "./lib/storage";
import type { ConfirmState, DailyStats, GoalsState, Lang, MealEntry, PeriodKey, ToastState, ViewKey } from "./types";

function normalizeNumberish(value: null | number | string) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

function computeSleepRange(values: { minMeals: null | number; maxMeals: null | number; minDayIntHours: null | number; maxDayIntHours: null | number; }) {
  const minSleepHours = values.maxMeals != null && values.maxDayIntHours != null
    ? roundToHalfHour(24 - Math.max(0, values.maxMeals - 1) * values.maxDayIntHours)
    : null;
  const maxSleepHours = values.minMeals != null && values.minDayIntHours != null
    ? roundToHalfHour(24 - Math.max(0, values.minMeals - 1) * values.minDayIntHours)
    : null;
  return { minSleepHours, maxSleepHours };
}

function App() {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [meals, setMeals] = useState<MealEntry[]>(() => pruneOldMeals(loadMeals()));
  const [goals, setGoals] = useState<GoalsState>(() => loadGoals());
  const [view, setView] = useState<ViewKey>("today");
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [mealNote, setMealNote] = useState("");
  const [toast, setToast] = useState<null | ToastState>(null);
  const [confirmState, setConfirmState] = useState<null | ConfirmState>(null);
  const [detailDay, setDetailDay] = useState<null | DailyStats>(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [showUpdateNotice, setShowUpdateNotice] = useState(() => shouldShowUpdateNotice(CURRENT_UPDATE_NOTICE_VERSION));
  const [goalDraft, setGoalDraft] = useState({
    minMeals: goals.minMealsPerDay == null ? "" : String(goals.minMealsPerDay),
    maxMeals: goals.maxMealsPerDay == null ? "" : String(goals.maxMealsPerDay),
    maxSnacks: goals.maxSnacksPerDay == null ? "" : String(goals.maxSnacksPerDay),
    minDayIntHours: goals.minDayIntervalMinutes == null ? "" : String(goals.minDayIntervalMinutes / 60),
    maxDayIntHours: goals.maxDayIntervalMinutes == null ? "" : String(goals.maxDayIntervalMinutes / 60)
  });

  useEffect(() => {
    saveLang(lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    saveMeals(meals);
  }, [meals]);

  useEffect(() => {
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const todayMeals = useMemo(() => getTodayMeals(meals), [meals]);
  const allSorted = useMemo(() => getAllMealsSorted(meals), [meals]);
  const dailyStats = useMemo(() => computeDailyStats(meals), [meals]);
  const filteredStats = useMemo(() => {
    if (period === "today") {
      const todayKey = getDayKey(new Date());
      return dailyStats.filter((day) => day.key === todayKey);
    }
    const days = Number(period);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return dailyStats.filter((day) => day.ts >= cutoff);
  }, [dailyStats, period]);

  const noteValid = mealNote.length <= MEAL_NOTE_MAX_LENGTH;
  const currentGoalValues = {
    minMeals: normalizeNumberish(goalDraft.minMeals),
    maxMeals: normalizeNumberish(goalDraft.maxMeals),
    maxSnacks: normalizeNumberish(goalDraft.maxSnacks),
    minDayIntHours: normalizeNumberish(goalDraft.minDayIntHours),
    maxDayIntHours: normalizeNumberish(goalDraft.maxDayIntHours)
  };
  const sleepRange = computeSleepRange(currentGoalValues);

  const goalDirty = useMemo(() => {
    return (
      currentGoalValues.minMeals !== goals.minMealsPerDay ||
      currentGoalValues.maxMeals !== goals.maxMealsPerDay ||
      currentGoalValues.maxSnacks !== goals.maxSnacksPerDay ||
      (currentGoalValues.minDayIntHours == null ? null : currentGoalValues.minDayIntHours * 60) !== goals.minDayIntervalMinutes ||
      (currentGoalValues.maxDayIntHours == null ? null : currentGoalValues.maxDayIntHours * 60) !== goals.maxDayIntervalMinutes
    );
  }, [currentGoalValues.maxDayIntHours, currentGoalValues.maxMeals, currentGoalValues.maxSnacks, currentGoalValues.minDayIntHours, currentGoalValues.minMeals, goals]);

  const periodSummary = useMemo(() => {
    const daysCount = filteredStats.length;
    if (!daysCount) {
      return { meals: "0", snacks: "0", sleep: t(lang, "stats.notEnoughData"), interval: t(lang, "stats.notEnoughData") };
    }
    const totalMeals = filteredStats.reduce((sum, day) => sum + day.count, 0);
    const totalSnacks = filteredStats.reduce((sum, day) => sum + day.snacksCount, 0);
    const sleepIntervals = filteredStats.flatMap((day) => day.sleepInterval == null ? [] : [day.sleepInterval]);
    const avgIntervals = filteredStats.flatMap((day) => day.avgInterval == null ? [] : [day.avgInterval]);
    return {
      meals: formatNumberPerDay(totalMeals / daysCount),
      snacks: formatNumberPerDay(totalSnacks / daysCount),
      sleep: sleepIntervals.length ? formatInterval(sleepIntervals.reduce((a, b) => a + b, 0) / sleepIntervals.length, lang) : t(lang, "stats.notEnoughData"),
      interval: avgIntervals.length ? formatInterval(avgIntervals.reduce((a, b) => a + b, 0) / avgIntervals.length, lang) : t(lang, "stats.notEnoughData")
    };
  }, [filteredStats, lang]);

  const sinceLast = useMemo(() => {
    if (!allSorted.length) return "–";
    return formatInterval(Date.now() - allSorted[allSorted.length - 1].ts, lang);
  }, [allSorted, lang]);

  useEffect(() => {
    if (!isWelcomeSeen()) setShowInstallHelp(true);
  }, []);

  function persistGoals(next: GoalsState) {
    setGoals(next);
    saveGoals(next);
    setGoalDraft({
      minMeals: next.minMealsPerDay == null ? "" : String(next.minMealsPerDay),
      maxMeals: next.maxMealsPerDay == null ? "" : String(next.maxMealsPerDay),
      maxSnacks: next.maxSnacksPerDay == null ? "" : String(next.maxSnacksPerDay),
      minDayIntHours: next.minDayIntervalMinutes == null ? "" : String(next.minDayIntervalMinutes / 60),
      maxDayIntHours: next.maxDayIntervalMinutes == null ? "" : String(next.maxDayIntervalMinutes / 60)
    });
  }

  function handleAddMeal() {
    if (!noteValid) return;
    const newMeal: MealEntry = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      note: mealNote.trim(),
      isSnack: false
    };
    setMeals((current) => pruneOldMeals([...current, newMeal]));
    setMealNote("");
  }

  function toggleSnack(id: string) {
    setMeals((current) => current.map((meal) => meal.id === id ? { ...meal, isSnack: !meal.isSnack } : meal));
  }

  function deleteMeal(id: string) {
    setConfirmState({
      title: t(lang, "confirm.deleteTitle"),
      body: t(lang, "confirm.delete"),
      confirmText: t(lang, "confirm.ok"),
      danger: true,
      onConfirm: () => {
        setMeals((current) => current.filter((meal) => meal.id !== id));
        setConfirmState(null);
      }
    });
  }

  function editMealNote(id: string) {
    const next = window.prompt(t(lang, "textarea.label"), meals.find((meal) => meal.id === id)?.note ?? "");
    if (next == null) return;
    setMeals((current) => current.map((meal) => meal.id === id ? { ...meal, note: next.trim() } : meal));
  }

  function editMealTime(id: string) {
    const currentMeal = meals.find((meal) => meal.id === id);
    if (!currentMeal) return;
    const current = formatTimeHM(currentMeal.ts, "en").replace(/\s/g, "");
    const input = window.prompt(t(lang, "alert.invalidTime"), current);
    if (!input) return;
    const match = /^([0-9]{2}):([0-9]{2})$/.exec(input.trim());
    if (!match) {
      window.alert(t(lang, "alert.invalidTime"));
      return;
    }
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh > 23 || mm > 59) {
      window.alert(t(lang, "alert.invalidTimeRange"));
      return;
    }
    setMeals((currentList) => currentList.map((meal) => {
      if (meal.id !== id) return meal;
      const nextDate = new Date(meal.ts);
      nextDate.setHours(hh, mm, 0, 0);
      return { ...meal, ts: nextDate.getTime() };
    }));
  }

  function exportMeals() {
    if (!allSorted.length) {
      window.alert(t(lang, "export.noData"));
      return;
    }
    const header = ["day_key", "date", "time", "type", "note"];
    const rows = allSorted.map((meal) => {
      const dayKey = getDayKey(meal.ts);
      const d = new Date(meal.ts);
      const date = d.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
      const time = formatTimeHM(meal.ts, lang);
      return [dayKey, date, time, meal.isSnack ? "snack" : "meal", meal.note.split(";").join(",")];
    });
    const blob = new Blob([[header, ...rows].map((row) => row.join(";")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eatlog_meals_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetHistory() {
    if (!meals.length) {
      window.alert(t(lang, "reset.empty"));
      return;
    }
    setConfirmState({
      title: t(lang, "reset.confirmTitle"),
      body: t(lang, "reset.confirm"),
      confirmText: t(lang, "reset.confirmOk"),
      danger: true,
      onConfirm: () => {
        setMeals([]);
        setConfirmState(null);
      }
    });
  }

  function stepGoal(target: keyof typeof goalDraft, delta: number, min: number, max: number) {
    setGoalDraft((current) => {
      const currentValue = normalizeNumberish(current[target]) ?? 0;
      const next = Math.min(max, Math.max(min, currentValue + delta));
      return { ...current, [target]: String(Number.isInteger(delta) ? Math.round(next) : roundToHalfHour(next)) };
    });
  }

  function saveGoalChanges() {
    if (!goalDirty) return;
    if (currentGoalValues.minMeals != null && currentGoalValues.maxMeals != null && currentGoalValues.minMeals > currentGoalValues.maxMeals) return;
    if (currentGoalValues.minDayIntHours != null && currentGoalValues.maxDayIntHours != null && currentGoalValues.minDayIntHours > currentGoalValues.maxDayIntHours) return;
    if (currentGoalValues.maxSnacks != null && currentGoalValues.maxMeals != null && currentGoalValues.maxSnacks > currentGoalValues.maxMeals) return;

    const next: GoalsState = {
      minMealsPerDay: currentGoalValues.minMeals,
      maxMealsPerDay: currentGoalValues.maxMeals,
      maxSnacksPerDay: currentGoalValues.maxSnacks,
      minSleepHours: sleepRange.minSleepHours,
      maxSleepHours: sleepRange.maxSleepHours,
      minDayIntervalMinutes: currentGoalValues.minDayIntHours == null ? null : currentGoalValues.minDayIntHours * 60,
      maxDayIntervalMinutes: currentGoalValues.maxDayIntHours == null ? null : currentGoalValues.maxDayIntHours * 60
    };
    persistGoals(next);
    setToast({ title: t(lang, "goals.saved") });
  }

  function sendToChatGpt() {
    if (!todayMeals.length) {
      window.alert(t(lang, "chatgpt.noData"));
      return;
    }
    const lines = todayMeals.map((meal, index) => `${index + 1}. ${formatTimeHM(meal.ts, lang)} | ${meal.isSnack ? t(lang, "meal.badgeSnack") : "Meal"} | ${meal.note || t(lang, "no.description")}`);
    const prompt = lines.join("\n");
    navigator.clipboard?.writeText(prompt).then(() => {
      setToast({ title: t(lang, "chatgpt.toastTitle"), text: t(lang, "chatgpt.toastText") });
      window.open("https://chatgpt.com/", "_blank", "noopener");
    }).catch(() => {
      window.alert(t(lang, "chatgpt.copyError"));
    });
  }

  function closeInstallHelp() {
    markWelcomeSeen();
    setShowInstallHelp(false);
  }

  return (
    <div className="min-h-screen px-[max(12px,var(--safe-left))] pt-[max(16px,var(--safe-top))] pb-[max(16px,var(--safe-bottom))]">
      <div className="mx-auto flex w-full max-w-[480px] flex-col bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,15,31,0.98))] px-3.5 pb-5 sm:min-h-[calc(100vh-32px)] sm:rounded-app sm:border sm:border-white/10 sm:shadow-shell">
        <header className="sticky top-0 z-20 -mx-3.5 flex items-center justify-between gap-3 bg-[linear-gradient(180deg,rgba(12,19,36,0.98),rgba(12,19,36,0.88)_82%,rgba(12,19,36,0))] px-3.5 pb-3 pt-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-accent/20 bg-[linear-gradient(180deg,rgba(27,44,72,0.98),rgba(14,24,43,0.98))] text-[#9ff3c8] shadow-panel">
              <Salad size={18} />
            </div>
            <div className="min-w-0">
              <span className="mb-0.5 block text-[11px] text-muted">{t(lang, "brand.kicker")}</span>
              <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-text">EatLog</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLang((current) => current === "ru" ? "en" : "ru")}
            className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/5 px-3 text-sm font-bold text-muted"
            aria-label={lang === "ru" ? "Переключить язык приложения" : "Switch app language"}
          >
            <Globe size={16} className="mr-2" />
            {lang.toUpperCase()}
          </button>
        </header>

        <div className="sticky top-[68px] z-10 -mx-3.5 bg-[linear-gradient(180deg,rgba(12,19,36,0.98),rgba(12,19,36,0.78)_76%,rgba(12,19,36,0))] px-3.5 pb-3">
          <div role="tablist" aria-label="Main sections" className="grid grid-cols-3 gap-1.5 rounded-[18px] border border-white/10 bg-[#09111f]/80 p-1.5">
            {(["today", "stats", "goals"] as ViewKey[]).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={view === tab}
                tabIndex={view === tab ? 0 : -1}
                onClick={() => setView(tab)}
                className={`min-h-[46px] rounded-[14px] px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-0 ${view === tab ? "bg-[linear-gradient(180deg,#2ed184_0%,#25c97a_100%)] text-[#03210f] shadow-[0_2px_8px_rgba(45,209,132,0.08)]" : "bg-slate-900/20 text-slate-300"}`}
              >
                {t(lang, `tab.${tab}` as never)}
              </button>
            ))}
          </div>
        </div>

        <main className="pb-4">
          {view === "today" && (
            <div className="space-y-3">
              <section className="rounded-[22px] border border-accent/15 bg-[linear-gradient(180deg,rgba(7,16,30,0.99),rgba(2,6,23,0.99))] p-4 shadow-panel">
                <h2 className="mb-3 text-[22px] font-bold tracking-[-0.02em] text-text">{t(lang, "h.newMeal")}</h2>
                <label htmlFor="mealNote" className="mb-2 block text-[13px] font-semibold text-slate-200">{t(lang, "textarea.label")}</label>
                <textarea
                  id="mealNote"
                  value={mealNote}
                  onChange={(event) => setMealNote(event.target.value)}
                  placeholder={t(lang, "textarea.placeholder")}
                  className={`min-h-[96px] w-full rounded-2xl border px-3 py-3 text-base text-text outline-none transition ${noteValid ? "border-slate-700 bg-slate-950/70 focus:border-accent focus:ring-4 focus:ring-accent/10" : "border-danger/70 bg-slate-950/70 ring-4 ring-danger/10"}`}
                />
                <div className="mb-3 mt-2 flex items-start justify-between gap-3">
                  <p className={`text-[12px] leading-5 ${noteValid ? "text-muted" : "text-rose-300"}`}>{t(lang, noteValid ? "textarea.status" : "textarea.error")}</p>
                  <span className="shrink-0 text-[12px] text-muted">{mealNote.length}/{MEAL_NOTE_MAX_LENGTH}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddMeal}
                  disabled={!noteValid}
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#2ed184_0%,#25c97a_100%)] px-5 text-sm font-semibold text-[#03210f] shadow-[0_8px_24px_rgba(45,209,132,0.22)] disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-60"
                >
                  <Plus size={18} className="mr-2" />
                  {t(lang, "btn.eating")}
                </button>
                <p className="mt-3 text-[12px] text-muted">{t(lang, "last.meal")}{sinceLast}</p>
              </section>

              <section className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(4,10,22,0.98),rgba(2,6,23,0.98))] p-4 shadow-panel">
                <div className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-text">{formatTodayFeedTitle(lang)}</div>
                {!todayMeals.length ? (
                  <div className="py-2">
                    <div className="text-sm font-semibold text-slate-100">{t(lang, "list.empty")}</div>
                    <div className="mt-1 text-xs leading-5 text-muted">{t(lang, "list.emptyHint")}</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayMeals.map((meal, index) => {
                      const prev = index === 0 ? allSorted[allSorted.findIndex((item) => item.id === meal.id) - 1] : todayMeals[index - 1];
                      return (
                        <article key={meal.id} className="border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[15px] font-semibold ${meal.isSnack ? "text-amber-300" : "text-accent"}`}>{formatTimeHM(meal.ts, lang)}</span>
                                {meal.isSnack ? <span className="inline-flex min-h-6 items-center rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 text-[11px] font-semibold text-amber-200">{t(lang, "meal.badgeSnack")}</span> : null}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-100">{meal.note || t(lang, "no.description")}</p>
                              <p className="mt-2 text-xs text-muted">{prev ? t(lang, "interval.sincePrev", { value: formatInterval(meal.ts - prev.ts, lang) }) : t(lang, "interval.first")}</p>
                            </div>
                            <button type="button" onClick={() => deleteMeal(meal.id)} aria-label={t(lang, "confirm.ok")} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button type="button" onClick={() => toggleSnack(meal.id)} aria-label={t(lang, "meal.badgeSnack")} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                              <Cookie size={17} />
                            </button>
                            <button type="button" onClick={() => editMealTime(meal.id)} aria-label="Edit time" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                              <Clock3 size={17} />
                            </button>
                            <button type="button" onClick={() => editMealNote(meal.id)} aria-label="Edit note" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                              <Pencil size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {todayMeals.length ? (
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-[0.1em] text-muted">{t(lang, "chatgpt.kicker")}</div>
                      <button type="button" onClick={sendToChatGpt} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 px-4 text-sm font-semibold text-slate-200">
                        {t(lang, "chatgpt.btn")}
                      </button>
                      <p className="mt-2 text-center text-[11px] leading-5 text-muted">{t(lang, "chatgpt.desc")}</p>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          )}

          {view === "stats" && (
            <div className="space-y-3">
              <section className="rounded-[22px] border border-white/10 bg-panel p-4 shadow-panel">
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-text">{t(lang, "period.stats")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["today", "7", "14", "21"] as PeriodKey[]).map((item) => (
                    <button key={item} type="button" onClick={() => setPeriod(item)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${period === item ? "border-transparent bg-slate-100 text-slate-950" : "border-slate-700 bg-slate-950/50 text-slate-300"}`}>
                      {t(lang, `period.${item}` as never)}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: t(lang, "stat.meals"), value: periodSummary.meals },
                    { label: t(lang, "stat.snacks"), value: periodSummary.snacks },
                    { label: t(lang, "stat.sleep"), value: periodSummary.sleep },
                    { label: t(lang, "stat.dayInterval"), value: periodSummary.interval }
                  ].map((item) => {
                    const placeholder = item.value === t(lang, "stats.notEnoughData");
                    return (
                      <div key={item.label} className="min-h-[88px] rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] uppercase tracking-[0.08em] text-muted">{item.label}</div>
                        <div className={`mt-2 font-semibold leading-tight ${placeholder ? "max-w-[11ch] text-[13px] text-slate-300" : "text-[22px] text-text"}`}>{item.value}</div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-muted">{t(lang, "stats.retention")}</p>
              </section>

              <section className="rounded-[22px] border border-white/10 bg-panel p-4 shadow-panel">
                <h2 className="text-[20px] font-bold tracking-[-0.02em] text-text">{t(lang, "daily.breakdown")}</h2>
                {!filteredStats.length ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4">
                    <div className="text-sm font-semibold text-slate-100">{t(lang, "stats.noPeriodData")}</div>
                    <div className="mt-1 text-xs text-muted">{t(lang, "list.emptyHint")}</div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {filteredStats.map((day) => {
                      const goalHit = goals.minMealsPerDay != null && day.count >= goals.minMealsPerDay;
                      return (
                        <button key={day.key} type="button" onClick={() => setDetailDay(day)} className={`w-full rounded-2xl border px-3 py-3 text-left ${goalHit ? "border-accent/20 bg-accent/10" : "border-white/10 bg-slate-950/40"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-text">{formatDateDMY(day.ts, lang)}</div>
                            <div className={`text-xs font-semibold ${goalHit ? "text-accent" : "text-muted"}`}>{goalHit ? "✓" : ""}</div>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-muted">
                            <div><div>{t(lang, "table.meals")}</div><div className="mt-1 text-sm font-semibold text-slate-100">{day.count}</div></div>
                            <div><div>{t(lang, "table.snacks")}</div><div className="mt-1 text-sm font-semibold text-slate-100">{day.snacksCount}</div></div>
                            <div><div>{t(lang, "table.sleep")}</div><div className="mt-1 text-sm font-semibold text-slate-100">{day.sleepInterval ? formatInterval(day.sleepInterval, lang) : "–"}</div></div>
                            <div><div>{t(lang, "table.dayInterval")}</div><div className="mt-1 text-sm font-semibold text-slate-100">{formatMealIntervalStat(day.avgInterval, lang)}</div></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 border-t border-slate-800 pt-4">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">{t(lang, "data.storage")}</div>
                  <button type="button" onClick={exportMeals} className="grid min-h-14 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-sky-400/15 bg-slate-950/60 px-4 text-left text-slate-100">
                    <ArrowDownToLine size={18} className="text-sky-300" />
                    <div>
                      <div className="text-sm font-semibold">{t(lang, "export.btn")}</div>
                      <div className="mt-1 text-xs leading-5 text-muted">{t(lang, "export.desc")}</div>
                    </div>
                  </button>
                  <button type="button" onClick={resetHistory} className="mt-3 grid min-h-14 w-full grid-cols-[24px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-rose-400/15 bg-slate-950/60 px-4 text-left text-rose-200">
                    <Trash2 size={18} className="text-rose-300" />
                    <div>
                      <div className="text-sm font-semibold">{t(lang, "reset.btn")}</div>
                      <div className="mt-1 text-xs leading-5 text-muted">{t(lang, "reset.hint")}</div>
                    </div>
                  </button>
                </div>
              </section>
            </div>
          )}

          {view === "goals" && (
            <section className="rounded-[22px] border border-white/10 bg-panel p-4 shadow-panel">
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-text">{t(lang, "goals.title")}</h2>
              <p className="mt-2 text-[13px] leading-6 text-muted">{t(lang, "goals.desc")}</p>

              <div className="mt-5 space-y-4">
                <GoalRange
                  lang={lang}
                  title={t(lang, "goals.mealsLabel")}
                  hint={t(lang, "goals.mealsHint")}
                  from={goalDraft.minMeals}
                  to={goalDraft.maxMeals}
                  onStep={stepGoal}
                  fromKey="minMeals"
                  toKey="maxMeals"
                  min={0}
                  max={12}
                  step={1}
                />
                <GoalSingle
                  lang={lang}
                  title={t(lang, "goals.snacksLabel")}
                  hint={t(lang, "goals.snacksHint")}
                  value={goalDraft.maxSnacks}
                  onStep={(delta) => stepGoal("maxSnacks", delta, 0, 12)}
                />
                <GoalRange
                  lang={lang}
                  title={t(lang, "goals.dayIntervalLabel")}
                  hint={t(lang, "goals.dayIntervalHint")}
                  from={goalDraft.minDayIntHours}
                  to={goalDraft.maxDayIntHours}
                  onStep={stepGoal}
                  fromKey="minDayIntHours"
                  toKey="maxDayIntHours"
                  min={0}
                  max={12}
                  step={0.5}
                  unit={t(lang, "unit.hours")}
                />
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-[15px] font-semibold text-text">{t(lang, "goals.sleepLabel")}</div>
                  <div className="mt-2 text-xs leading-5 text-muted">{t(lang, "goals.sleepAutoHint")}</div>
                  <ReadOnlyMetric lang={lang} from={sleepRange.minSleepHours} to={sleepRange.maxSleepHours} unit={t(lang, "unit.hours")} />
                </div>
              </div>

              <button type="button" disabled={!goalDirty} onClick={saveGoalChanges} className="sticky bottom-[max(8px,var(--safe-bottom))] mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#2ed184_0%,#25c97a_100%)] px-5 text-sm font-semibold text-[#03210f] shadow-[0_8px_24px_rgba(45,209,132,0.18)] disabled:cursor-not-allowed disabled:bg-[linear-gradient(180deg,rgba(45,209,132,0.35),rgba(37,201,122,0.28))] disabled:text-[#b9d7c8] disabled:shadow-none disabled:opacity-100">
                {t(lang, "goals.save")}
              </button>
              <p className="mt-3 text-xs text-muted">{goalDirty ? t(lang, "goals.statusDirty") : t(lang, "goals.statusIdle")}</p>
            </section>
          )}
        </main>

        <footer className="mt-12 border-t border-white/10 pt-3 text-[10px] text-muted sm:mt-auto">
          <div>{t(lang, "footer.line1")}</div>
          <div className="mt-1">{t(lang, "footer.line2")}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href="./support.html">Support</a>
            <span className="text-slate-600">·</span>
            <a className="inline-flex min-h-11 items-center underline-offset-4 hover:underline" href="./privacy.html">Privacy</a>
            <span className="text-slate-600">·</span>
            <button type="button" onClick={() => setShowInstallHelp(true)} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{t(lang, "footer.install")}</button>
          </div>
        </footer>
      </div>

      {detailDay ? (
        <Overlay onClose={() => setDetailDay(null)} title={formatDateDMY(detailDay.ts, lang)}>
          {allSorted.filter((meal) => getDayKey(meal.ts) === detailDay.key).map((meal, index, list) => (
            <article key={meal.id} className="border-b border-slate-800 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${meal.isSnack ? "text-amber-300" : "text-accent"}`}>{formatTimeHM(meal.ts, lang)}</span>
                {meal.isSnack ? <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] font-semibold text-amber-200">{t(lang, "meal.badgeSnack")}</span> : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-100">{meal.note || t(lang, "no.description")}</p>
              <p className="mt-2 text-xs text-muted">{index === 0 ? t(lang, "interval.first") : t(lang, "interval.sincePrev", { value: formatInterval(meal.ts - list[index - 1].ts, lang) })}</p>
            </article>
          ))}
        </Overlay>
      ) : null}

      {showInstallHelp ? (
        <Overlay onClose={closeInstallHelp} title={t(lang, "welcome.notice.title")}>
          <p className="text-sm leading-6 text-muted">{t(lang, "welcome.notice.body")}</p>
          <button type="button" onClick={closeInstallHelp} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-[#03210f]">
            {t(lang, "welcome.notice.ok")}
          </button>
        </Overlay>
      ) : null}

      {showUpdateNotice ? (
        <Overlay onClose={() => { markUpdateNoticeSeen(CURRENT_UPDATE_NOTICE_VERSION); setShowUpdateNotice(false); }} title={t(lang, "update.notice.title")}>
          <p className="text-sm leading-6 text-muted">{t(lang, "update.notice.body")}</p>
          <button type="button" onClick={() => { markUpdateNoticeSeen(CURRENT_UPDATE_NOTICE_VERSION); setShowUpdateNotice(false); }} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-[#03210f]">
            {t(lang, "update.notice.ok")}
          </button>
        </Overlay>
      ) : null}

      {confirmState ? (
        <Overlay onClose={() => setConfirmState(null)} title={confirmState.title ?? ""}>
          <p className="text-sm leading-6 text-muted">{confirmState.body}</p>
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={() => setConfirmState(null)} className="min-h-11 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 text-sm font-semibold text-slate-200">
              {t(lang, "prompt.cancel")}
            </button>
            <button type="button" onClick={confirmState.onConfirm} className={`min-h-11 flex-1 rounded-2xl px-4 text-sm font-semibold ${confirmState.danger ? "bg-rose-500 text-white" : "bg-accent text-[#03210f]"}`}>
              {confirmState.confirmText ?? t(lang, "confirm.ok")}
            </button>
          </div>
        </Overlay>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 w-[min(320px,calc(100vw-28px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-3 shadow-panel backdrop-blur">
          <div className="text-sm font-semibold text-slate-100">{toast.title}</div>
          {toast.text ? <div className="mt-1 text-xs text-muted">{toast.text}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function GoalRange(props: {
  lang: Lang;
  title: string;
  hint: string;
  from: string;
  to: string;
  fromKey: "minMeals" | "minDayIntHours";
  toKey: "maxMeals" | "maxDayIntHours";
  onStep: (target: "minMeals" | "maxMeals" | "maxSnacks" | "minDayIntHours" | "maxDayIntHours", delta: number, min: number, max: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[15px] font-semibold text-text">{props.title}</div>
      <div className="mt-3 grid gap-3 min-[390px]:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-muted">{t(props.lang, "range.from")}</div>
          <StepperValue value={props.from} suffix={props.unit} onStep={(delta) => props.onStep(props.fromKey, delta, props.min, props.max)} />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-muted">{t(props.lang, "range.to")}</div>
          <StepperValue value={props.to} suffix={props.unit} onStep={(delta) => props.onStep(props.toKey, delta, props.min, props.max)} />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-muted">{props.hint}</div>
    </div>
  );
}

function GoalSingle(props: {
  lang: Lang;
  title: string;
  hint: string;
  value: string;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[15px] font-semibold text-text">{props.title}</div>
      <div className="mt-3 max-w-[180px]">
        <StepperValue value={props.value} onStep={props.onStep} />
      </div>
      <div className="mt-3 text-xs leading-5 text-muted">{props.hint}</div>
    </div>
  );
}

function StepperValue(props: { value: string; suffix?: string; onStep: (delta: number) => void; }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <button type="button" onClick={() => props.onStep(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg font-semibold text-slate-200">−</button>
      <div className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 px-3 text-center text-sm font-semibold text-text">
        {props.value || "—"}{props.value && props.suffix ? ` ${props.suffix}` : ""}
      </div>
      <button type="button" onClick={() => props.onStep(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg font-semibold text-slate-200">+</button>
    </div>
  );
}

function ReadOnlyMetric(props: { lang: Lang; from: null | number; to: null | number; unit: string; }) {
  const value = props.from != null && props.to != null
    ? `${props.from}–${props.to} ${props.unit}`
    : props.from != null
      ? `${props.from} ${props.unit}`
      : props.to != null
        ? `${props.to} ${props.unit}`
        : "—";

  return (
    <div className="mt-3 rounded-2xl border border-accent/15 bg-accent/10 px-4 py-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        <MoonStar size={14} className="text-accent" />
        {t(props.lang, "goals.sleepAutoBadge")}
      </div>
      <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-text">
        {value}
      </div>
    </div>
  );
}

function Overlay(props: { title: string; children: ReactNode; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur sm:items-center" onClick={props.onClose}>
      <div className="w-full max-w-[420px] rounded-[24px] border border-white/10 bg-panel p-5 shadow-shell" onClick={(event) => event.stopPropagation()}>
        <div className="text-[18px] font-bold text-text">{props.title}</div>
        <div className="mt-3">{props.children}</div>
      </div>
    </div>
  );
}

export default App;
