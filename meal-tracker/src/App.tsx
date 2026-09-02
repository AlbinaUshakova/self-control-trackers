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

function parseTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const separated = /^(\d{1,2})\s*[:.,\- ]\s*(\d{2})$/.exec(trimmed);
  if (separated) {
    return { hh: Number(separated[1]), mm: Number(separated[2]) };
  }

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (/^\d{3,4}$/.test(digitsOnly)) {
    const normalized = digitsOnly.length === 3 ? `0${digitsOnly}` : digitsOnly;
    return {
      hh: Number(normalized.slice(0, 2)),
      mm: Number(normalized.slice(2, 4))
    };
  }

  return null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid] + sorted[mid + 1]) / 2;
}

function getRoutineData(stats: DailyStats[]) {
  const eligibleDays = stats.filter((day) => day.avgInterval != null && day.sleepInterval != null);
  const recentDays = eligibleDays.slice(0, 7);
  const sleepIntervals = recentDays.map((day) => day.sleepInterval!);
  const dayIntervals = recentDays.map((day) => day.avgInterval!);
  return {
    days: recentDays.length,
    medianSleepInterval: median(sleepIntervals),
    medianDayInterval: median(dayIntervals)
  };
}

function buildNutritionPrompt(lang: Lang, foodLog: string) {
  const instruction = lang === "ru"
    ? "Оцени примерные КБЖУ за день. Формат: Калории, Белки, Жиры, Углеводы. Если данных мало для точности, добавь до 3 пунктов: что уточнять. Не повторяй список, не считай по продуктам, не давай общих советов."
    : "Estimate daily macros. Format: Calories, Protein, Fat, Carbs. If details are missing, add up to 3 points: what to clarify. Don't repeat the list, don't break it down by item, and don't give general nutrition advice.";

  return `${instruction}\n\n${foodLog}`;
}

const statsBreakdownGridClass = "grid-cols-[minmax(64px,0.92fr)_minmax(0,0.86fr)_minmax(0,0.96fr)_minmax(0,1.18fr)_minmax(0,1.08fr)]";

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
    meals: goals.mealsPerDay == null ? "" : String(goals.mealsPerDay),
    maxSnacks: goals.maxSnacksPerDay == null ? "" : String(goals.maxSnacksPerDay)
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
    meals: normalizeNumberish(goalDraft.meals),
    maxSnacks: normalizeNumberish(goalDraft.maxSnacks)
  };

  const routineData = useMemo(() => getRoutineData(dailyStats), [dailyStats]);

  const goalDirty = useMemo(() => {
    return (
      currentGoalValues.meals !== goals.mealsPerDay ||
      currentGoalValues.maxSnacks !== goals.maxSnacksPerDay
    );
  }, [currentGoalValues.maxSnacks, currentGoalValues.meals, goals]);

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
      meals: next.mealsPerDay == null ? "" : String(next.mealsPerDay),
      maxSnacks: next.maxSnacksPerDay == null ? "" : String(next.maxSnacksPerDay)
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
    const input = window.prompt(`${t(lang, "alert.invalidTime")}`, current);
    if (!input) return;
    const parsed = parseTimeInput(input);
    if (!parsed) {
      window.alert(t(lang, "alert.invalidTime"));
      return;
    }
    const { hh, mm } = parsed;
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
    const next: GoalsState = {
      mealsPerDay: currentGoalValues.meals,
      maxSnacksPerDay: currentGoalValues.maxSnacks
    };
    persistGoals(next);
    setToast({ title: t(lang, "goals.saved") });
  }

  function sendToChatGpt() {
    if (!todayMeals.length) {
      window.alert(t(lang, "chatgpt.noData"));
      return;
    }
    const foodLog = todayMeals
      .map((meal) => meal.note.trim())
      .filter(Boolean)
      .join("\n");
    if (!foodLog) {
      window.alert(t(lang, "chatgpt.noData"));
      return;
    }
    const prompt = buildNutritionPrompt(lang, foodLog);
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
                <div className="mb-3 mt-2">
                  <p className={`text-[12px] leading-5 ${noteValid ? "text-muted" : "text-rose-300"}`}>{t(lang, noteValid ? "textarea.status" : "textarea.error")}</p>
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
                            <div className="flex shrink-0 gap-2">
                              <button type="button" onClick={() => toggleSnack(meal.id)} aria-label={t(lang, "meal.badgeSnack")} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                                <Cookie size={17} />
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button type="button" onClick={() => editMealTime(meal.id)} aria-label="Edit time" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                              <Clock3 size={17} />
                            </button>
                            <button type="button" onClick={() => editMealNote(meal.id)} aria-label="Edit note" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-slate-200">
                              <Pencil size={17} />
                            </button>
                            <button type="button" onClick={() => deleteMeal(meal.id)} aria-label={t(lang, "confirm.ok")} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
                              <Trash2 size={17} />
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
                <div className="mt-3 grid grid-cols-2 gap-2 min-[390px]:grid-cols-4">
                  {(["today", "7", "14", "21"] as PeriodKey[]).map((item) => (
                    <button key={item} type="button" onClick={() => setPeriod(item)} className={`inline-flex min-h-11 h-11 w-full items-center justify-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${period === item ? "border-transparent bg-slate-100 text-slate-950" : "border-slate-700 bg-slate-950/50 text-slate-300"}`}>
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
                        <div className="min-h-[40px] text-[10px] uppercase tracking-[0.08em] text-muted">{item.label}</div>
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
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
                    <div className="max-h-[320px] overflow-y-auto">
                      <div className="sticky top-0 z-10 bg-slate-950/40">
                        <div className={`grid ${statsBreakdownGridClass} gap-2 border-b border-white/10 px-3 py-3 text-[9px] uppercase tracking-[0.06em] text-muted sm:text-[11px] sm:tracking-[0.12em]`}>
                          <div className="pl-2">{t(lang, "table.date")}</div>
                          <div className="min-w-0 text-center leading-tight">
                            <span className="sm:hidden">{t(lang, "table.mealsShort")}</span>
                            <span className="hidden sm:inline">{t(lang, "table.meals")}</span>
                          </div>
                          <div className="min-w-0 text-center leading-tight">
                            <span className="sm:hidden">{t(lang, "table.snacksShort")}</span>
                            <span className="hidden sm:inline">{t(lang, "table.snacks")}</span>
                          </div>
                          <div className="min-w-0 text-center leading-tight">
                            <span className="sm:hidden">{t(lang, "table.sleepShort")}</span>
                            <span className="hidden sm:inline">{t(lang, "table.sleep")}</span>
                          </div>
                          <div className="min-w-0 text-center leading-tight">
                            <span className="sm:hidden">{t(lang, "table.dayIntervalShort")}</span>
                            <span className="hidden sm:inline">{t(lang, "table.dayInterval")}</span>
                          </div>
                        </div>
                      </div>
                      {filteredStats.map((day, index) => {
                        const mealsOk = goals.mealsPerDay == null || day.count === goals.mealsPerDay;
                        const snacksWithin = goals.maxSnacksPerDay == null || day.snacksCount <= goals.maxSnacksPerDay;
                        const goalHit = mealsOk && snacksWithin;
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => setDetailDay(day)}
                            className={`w-full border-b px-3 py-3 text-left transition-colors ${goalHit ? "bg-accent/10 border-accent/20" : "bg-transparent border-white/10 hover:bg-white/5"} ${index === filteredStats.length - 1 ? "border-b-0" : ""}`}
                          >
                            <div className={`grid ${statsBreakdownGridClass} items-center gap-2 text-xs text-slate-100 sm:text-sm`}>
                              <div className="pl-2 text-text">{formatDateDMY(day.ts, lang)}</div>
                              <div className="min-w-0 text-center font-semibold">{day.count}</div>
                              <div className="min-w-0 text-center font-semibold">{day.snacksCount}</div>
                              <div className="min-w-0 text-center font-semibold leading-tight">{day.sleepInterval ? formatInterval(day.sleepInterval, lang) : "–"}</div>
                              <div className="min-w-0 text-center font-semibold leading-tight">{formatMealIntervalStat(day.avgInterval, lang)}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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
                <GoalSingle
                  lang={lang}
                  title={t(lang, "goals.mealsLabel")}
                  hint={t(lang, "goals.mealsHint")}
                  value={goalDraft.meals}
                  onStep={(delta) => stepGoal("meals", delta, 0, 12)}
                />
                <GoalSingle
                  lang={lang}
                  title={t(lang, "goals.snacksLabel")}
                  hint={t(lang, "goals.snacksHint")}
                  value={goalDraft.maxSnacks}
                  onStep={(delta) => stepGoal("maxSnacks", delta, 0, 12)}
                />
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="text-[15px] font-semibold text-text">{t(lang, "goals.routineTitle")}</div>
                  {routineData.days >= 3 ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">{t(lang, "table.sleep")}</div>
                          <div className="mt-2 text-[22px] font-semibold text-text">{formatInterval(routineData.medianSleepInterval, lang)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                          <div className="text-[11px] uppercase tracking-[0.08em] text-muted">{t(lang, "stat.dayInterval")}</div>
                          <div className="mt-2 text-[22px] font-semibold text-text">{formatInterval(routineData.medianDayInterval, lang)}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs leading-5 text-muted">{t(lang, "goals.routineInfo")}</div>
                      <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-3 text-xs text-muted">{t(lang, "goals.routineSubtitle", { count: routineData.days })}</div>
                    </>
                  ) : (
                    <>
                      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                        <div className="text-sm font-semibold text-text">{t(lang, "goals.collectingTitle")}</div>
                        <div className="mt-2 text-xs leading-5 text-muted">{t(lang, "goals.collectingHint")}</div>
                        <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-slate-100">{t(lang, "goals.collectingProgress", { count: routineData.days })}</div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button type="button" disabled={!goalDirty} onClick={saveGoalChanges} className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#2ed184_0%,#25c97a_100%)] px-5 text-sm font-semibold text-[#03210f] shadow-[0_8px_24px_rgba(45,209,132,0.18)] disabled:cursor-not-allowed disabled:bg-[linear-gradient(180deg,rgba(45,209,132,0.35),rgba(37,201,122,0.28))] disabled:text-[#b9d7c8] disabled:shadow-none disabled:opacity-100">
                {t(lang, "goals.save")}
              </button>
              <p className="mt-3 text-xs text-muted">{goalDirty ? t(lang, "goals.statusDirty") : t(lang, "goals.statusIdle")}</p>
            </section>
          )}
        </main>

        <footer className="mt-12 border-t border-white/10 pt-3 text-[10px] text-muted sm:mt-auto">
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
        {props.value === "" ? "—" : props.value}{props.value && props.suffix ? ` ${props.suffix}` : ""}
      </div>
      <button type="button" onClick={() => props.onStep(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg font-semibold text-slate-200">+</button>
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
