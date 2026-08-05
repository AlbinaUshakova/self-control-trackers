import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { loadGoals, loadLang, saveGoals } from "./lib/storage";
import type { GoalsState, Lang } from "./types";

const GOALS_TITLES = new Set(["Daily goals", "Цели на день"]);
const BREAKDOWN_TITLES = new Set(["Daily breakdown", "Детализация по дням"]);
const HOST_ID = "eatlog-automatic-goals-host";

const copy = {
  en: {
    title: "Daily goals",
    description: "Set your eating rhythm. EatLog calculates the meal interval automatically.",
    meals: "Meals per day",
    mealsHint: "Snacks are already included in the total number of meals.",
    snacks: "Of these — snacks",
    snacksHint: "The daily goal is exceeded when there are more snacks than this value.",
    sleep: "Night fasting interval",
    sleepHint: "Choose the time between the last meal of one day and the first meal of the next.",
    interval: "Calculated meal interval",
    intervalHint: "Calculated from the meal count and night fasting range.",
    calculated: "Calculated automatically",
    from: "From",
    to: "To",
    hours: "hrs",
    save: "Save goals",
    saved: "Goals saved",
    idle: "Change a parameter to save a new routine.",
    dirty: "You have unsaved changes.",
    invalid: "Check that the start of each range is not greater than its end."
  },
  ru: {
    title: "Цели на день",
    description: "Настройте режим питания. EatLog сам рассчитает интервал между приёмами пищи.",
    meals: "Приёмов пищи",
    mealsHint: "Перекусы уже входят в общее количество приёмов пищи.",
    snacks: "Из них — перекусов",
    snacksHint: "Цель считается превышенной, если перекусов окажется больше этого значения.",
    sleep: "Ночной интервал без еды",
    sleepHint: "Укажите время между последним приёмом одного дня и первым приёмом следующего.",
    interval: "Расчётный интервал между приёмами",
    intervalHint: "Рассчитывается по количеству приёмов пищи и ночному интервалу.",
    calculated: "Рассчитывается автоматически",
    from: "От",
    to: "До",
    hours: "ч",
    save: "Сохранить цели",
    saved: "Цели сохранены",
    idle: "Измените параметры, чтобы сохранить новый режим.",
    dirty: "Есть несохранённые изменения.",
    invalid: "Проверьте, что начало диапазона не больше его конца."
  }
} as const;

type Draft = {
  minMeals: number;
  maxMeals: number;
  maxSnacks: number;
  minSleep: number;
  maxSleep: number;
};

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function goalsToDraft(goals: GoalsState): Draft {
  return {
    minMeals: clamp(goals.minMealsPerDay ?? 3, 2, 12),
    maxMeals: clamp(goals.maxMealsPerDay ?? 4, 2, 12),
    maxSnacks: clamp(goals.maxSnacksPerDay ?? 1, 0, 12),
    minSleep: clamp(goals.minSleepHours ?? 11, 0, 24),
    maxSleep: clamp(goals.maxSleepHours ?? 13, 0, 24)
  };
}

function calculateInterval(draft: Draft) {
  if (draft.minMeals < 2 || draft.maxMeals < 2 || draft.minMeals > draft.maxMeals || draft.minSleep > draft.maxSleep) {
    return { min: null, max: null };
  }

  const shortestEatingWindow = Math.max(0, 24 - draft.maxSleep);
  const longestEatingWindow = Math.max(0, 24 - draft.minSleep);
  const min = roundToHalf(shortestEatingWindow / Math.max(1, draft.maxMeals - 1));
  const max = roundToHalf(longestEatingWindow / Math.max(1, draft.minMeals - 1));

  return { min: Math.max(0, min), max: Math.max(0, max) };
}

function formatHours(value: number | null, lang: Lang) {
  if (value == null || !Number.isFinite(value)) return "—";
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  if (lang === "ru") {
    if (hours && minutes) return `${hours} ч ${minutes} мин`;
    if (hours) return `${hours} ч`;
    return `${minutes} мин`;
  }
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function parseDurationMinutes(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized || normalized === "–" || /not enough|недостаточно/i.test(normalized)) return null;

  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:ч|h)/i);
  const minutes = normalized.match(/(\d+)\s*(?:мин|м|m)/i);
  if (!hours && !minutes) return null;

  return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

function findSectionByTitle(titles: Set<string>) {
  return Array.from(document.querySelectorAll<HTMLElement>("main section")).find((section) => {
    const title = section.querySelector("h2")?.textContent?.trim();
    return title ? titles.has(title) : false;
  }) ?? null;
}

function getSavedGoals() {
  return loadGoals();
}

function isWithin(value: number, min: number | null, max: number | null) {
  return (min == null || value >= min) && (max == null || value <= max);
}

function refreshGoalHighlights() {
  const section = findSectionByTitle(BREAKDOWN_TITLES);
  if (!section) return;

  const goals = getSavedGoals();
  const cards = Array.from(section.querySelectorAll<HTMLButtonElement>(".mt-3.space-y-2 > button"));

  for (const card of cards) {
    const columns = Array.from(card.querySelectorAll<HTMLElement>(".grid.grid-cols-4 > div"));
    if (columns.length < 4) continue;

    const count = Number(columns[0].lastElementChild?.textContent?.trim());
    const snacks = Number(columns[1].lastElementChild?.textContent?.trim());
    const sleepMinutes = parseDurationMinutes(columns[2].lastElementChild?.textContent ?? "");
    const intervalMinutes = parseDurationMinutes(columns[3].lastElementChild?.textContent ?? "");

    const mealsHit = Number.isFinite(count) && isWithin(count, goals.minMealsPerDay, goals.maxMealsPerDay);
    const snacksHit = Number.isFinite(snacks) && (goals.maxSnacksPerDay == null || snacks <= goals.maxSnacksPerDay);
    const sleepGoalConfigured = goals.minSleepHours != null || goals.maxSleepHours != null;
    const sleepHit = !sleepGoalConfigured || (sleepMinutes != null && isWithin(sleepMinutes, goals.minSleepHours == null ? null : goals.minSleepHours * 60, goals.maxSleepHours == null ? null : goals.maxSleepHours * 60));
    const intervalGoalConfigured = goals.minDayIntervalMinutes != null || goals.maxDayIntervalMinutes != null;
    const intervalHit = !intervalGoalConfigured || (intervalMinutes != null && isWithin(intervalMinutes, goals.minDayIntervalMinutes, goals.maxDayIntervalMinutes));
    const goalHit = mealsHit && snacksHit && sleepHit && intervalHit;

    card.classList.toggle("border-accent/20", goalHit);
    card.classList.toggle("bg-accent/10", goalHit);
    card.classList.toggle("border-white/10", !goalHit);
    card.classList.toggle("bg-slate-950/40", !goalHit);

    const status = card.firstElementChild?.lastElementChild as HTMLElement | null;
    if (status) {
      status.classList.toggle("text-accent", goalHit);
      status.classList.toggle("text-muted", !goalHit);
      const nextText = goalHit ? "✓" : "";
      if (status.textContent !== nextText) status.textContent = nextText;
    }
  }
}

function Stepper(props: { value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void; }) {
  const change = (delta: number) => props.onChange(roundToHalf(clamp(props.value + delta, props.min, props.max)));
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <button type="button" onClick={() => change(-props.step)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg font-semibold text-slate-200">−</button>
      <div className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 px-3 text-center text-sm font-semibold text-text">
        {props.value}{props.suffix ? ` ${props.suffix}` : ""}
      </div>
      <button type="button" onClick={() => change(props.step)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-lg font-semibold text-slate-200">+</button>
    </div>
  );
}

function RangeControl(props: { lang: Lang; title: string; hint: string; from: number; to: number; min: number; max: number; step: number; suffix?: string; onFrom: (value: number) => void; onTo: (value: number) => void; }) {
  const text = copy[props.lang];
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[15px] font-semibold text-text">{props.title}</div>
      <div className="mt-3 grid gap-3 min-[390px]:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-muted">{text.from}</div>
          <Stepper value={props.from} min={props.min} max={props.max} step={props.step} suffix={props.suffix} onChange={props.onFrom} />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-muted">{text.to}</div>
          <Stepper value={props.to} min={props.min} max={props.max} step={props.step} suffix={props.suffix} onChange={props.onTo} />
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-muted">{props.hint}</div>
    </div>
  );
}

function AutomaticGoalsPanel(props: { lang: Lang; onSaved: () => void; }) {
  const text = copy[props.lang];
  const [saved, setSaved] = useState(() => getSavedGoals());
  const [draft, setDraft] = useState<Draft>(() => goalsToDraft(saved));
  const [notice, setNotice] = useState("");
  const interval = useMemo(() => calculateInterval(draft), [draft]);

  const nextGoals: GoalsState = {
    minMealsPerDay: draft.minMeals,
    maxMealsPerDay: draft.maxMeals,
    maxSnacksPerDay: draft.maxSnacks,
    minSleepHours: draft.minSleep,
    maxSleepHours: draft.maxSleep,
    minDayIntervalMinutes: interval.min == null ? null : Math.round(interval.min * 60),
    maxDayIntervalMinutes: interval.max == null ? null : Math.round(interval.max * 60)
  };

  const dirty = JSON.stringify(nextGoals) !== JSON.stringify(saved);
  const valid = draft.minMeals <= draft.maxMeals && draft.minSleep <= draft.maxSleep && draft.maxSnacks <= draft.maxMeals && interval.min != null && interval.max != null && interval.min <= interval.max;

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (next.maxSnacks > next.maxMeals) next.maxSnacks = next.maxMeals;
      return next;
    });
    setNotice("");
  };

  const save = () => {
    if (!valid) {
      setNotice(text.invalid);
      return;
    }
    saveGoals(nextGoals);
    setSaved(nextGoals);
    setNotice(text.saved);
    refreshGoalHighlights();
    props.onSaved();
    window.setTimeout(() => setNotice(""), 1800);
  };

  return (
    <section className="rounded-[22px] border border-white/10 bg-panel p-4 shadow-panel">
      <h2 className="text-[20px] font-bold tracking-[-0.02em] text-text">{text.title}</h2>
      <p className="mt-2 text-[13px] leading-6 text-muted">{text.description}</p>

      <div className="mt-5 space-y-4">
        <RangeControl
          lang={props.lang}
          title={text.meals}
          hint={text.mealsHint}
          from={draft.minMeals}
          to={draft.maxMeals}
          min={2}
          max={12}
          step={1}
          onFrom={(value) => update({ minMeals: value })}
          onTo={(value) => update({ maxMeals: value })}
        />

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <div className="text-[15px] font-semibold text-text">{text.snacks}</div>
          <div className="mt-3 max-w-[180px]">
            <Stepper value={draft.maxSnacks} min={0} max={draft.maxMeals} step={1} onChange={(value) => update({ maxSnacks: value })} />
          </div>
          <div className="mt-3 text-xs leading-5 text-muted">{text.snacksHint}</div>
        </div>

        <RangeControl
          lang={props.lang}
          title={text.sleep}
          hint={text.sleepHint}
          from={draft.minSleep}
          to={draft.maxSleep}
          min={0}
          max={24}
          step={0.5}
          suffix={text.hours}
          onFrom={(value) => update({ minSleep: value })}
          onTo={(value) => update({ maxSleep: value })}
        />

        <div className="rounded-2xl border border-accent/15 bg-accent/10 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            <Clock3 size={14} className="text-accent" />
            {text.calculated}
          </div>
          <div className="mt-2 text-[15px] font-semibold text-text">{text.interval}</div>
          <div className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-text">
            {formatHours(interval.min, props.lang)}–{formatHours(interval.max, props.lang)}
          </div>
          <div className="mt-2 text-xs leading-5 text-muted">{text.intervalHint}</div>
        </div>
      </div>

      <button type="button" disabled={!dirty} onClick={save} className="mt-6 inline-flex min-h-[52px] w-full items-center justify-center rounded-[18px] bg-[linear-gradient(180deg,#2ed184_0%,#25c97a_100%)] px-5 text-sm font-semibold text-[#03210f] shadow-[0_8px_24px_rgba(45,209,132,0.18)] disabled:cursor-not-allowed disabled:bg-[linear-gradient(180deg,rgba(45,209,132,0.35),rgba(37,201,122,0.28))] disabled:text-[#b9d7c8] disabled:shadow-none disabled:opacity-100">
        {text.save}
      </button>
      <p className={`mt-3 text-xs ${notice === text.invalid ? "text-rose-300" : "text-muted"}`}>{notice || (dirty ? text.dirty : text.idle)}</p>
    </section>
  );
}

export default function GoalAutomation() {
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let hiddenSection: HTMLElement | null = null;

    const sync = () => {
      const nextLang = document.documentElement.lang === "ru" ? "ru" : "en";
      setLang((current) => current === nextLang ? current : nextLang);

      const goalsSection = findSectionByTitle(GOALS_TITLES);
      if (goalsSection) {
        hiddenSection = goalsSection;
        goalsSection.style.display = "none";
        let nextHost = document.getElementById(HOST_ID);
        if (!nextHost || !nextHost.isConnected) {
          nextHost = document.createElement("div");
          nextHost.id = HOST_ID;
          goalsSection.parentElement?.insertBefore(nextHost, goalsSection);
        }
        setHost((current) => current === nextHost ? current : nextHost);
      } else {
        setHost(null);
      }

      refreshGoalHighlights();
    };

    const observer = new MutationObserver(() => window.requestAnimationFrame(sync));
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["lang", "aria-selected"] });
    sync();

    return () => {
      observer.disconnect();
      if (hiddenSection) hiddenSection.style.display = "";
      document.getElementById(HOST_ID)?.remove();
    };
  }, []);

  if (!host) return null;
  return createPortal(<AutomaticGoalsPanel lang={lang} onSaved={refreshGoalHighlights} />, host);
}
