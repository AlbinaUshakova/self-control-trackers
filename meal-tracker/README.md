# EatLog

Простой офлайн-first трекер приёмов пищи и перекусов.

Текущая реализация: `React + TypeScript + Vite + Tailwind CSS`.

## Ссылки

- Production (Vercel): `https://eatlog-tracker.vercel.app/`
- GitHub Pages: `https://albinaushakova.github.io/self-control-trackers/meal-tracker/`

## Что умеет

- добавлять приёмы пищи и перекусы
- показывать интервалы между приёмами, включая последний приём в дневнике дня
- считать статистику по дню и по периоду
- хранить данные локально в `localStorage`
- работать как PWA через `service-worker.js`
- публиковать отдельные `support` и `privacy` страницы

## Структура

- [index.html](/Users/albina/Projects/active/self-control-trackers/meal-tracker/index.html) — Vite entrypoint
- [src/App.tsx](/Users/albina/Projects/active/self-control-trackers/meal-tracker/src/App.tsx) — основной React app shell и экраны
- [src/lib](/Users/albina/Projects/active/self-control-trackers/meal-tracker/src/lib) — storage, i18n, форматирование и вычисления
- [public/service-worker.js](/Users/albina/Projects/active/self-control-trackers/meal-tracker/public/service-worker.js) — офлайн-кеш и обновление PWA
- [public/manifest.json](/Users/albina/Projects/active/self-control-trackers/meal-tracker/public/manifest.json) — PWA manifest
- [support.html](/Users/albina/Projects/active/self-control-trackers/meal-tracker/support.html) и [privacy.html](/Users/albina/Projects/active/self-control-trackers/meal-tracker/privacy.html) — исходники публичных страниц
- [vercel.json](/Users/albina/Projects/active/self-control-trackers/meal-tracker/vercel.json) — маршрутизация для Vercel

## Маршруты

- `/` — основной URL приложения
- `/app` и `/app.html` — редирект на `/`
- `/index.html` — редирект на `/` на Vercel
- `/support` и `/support.html` — support page
- `/privacy` и `/privacy.html` — privacy page
- GitHub Pages: используйте `support.html` и `privacy.html` как каноничные публичные URL страниц

## Локальная разработка

Для локальной разработки:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Деплой

### Vercel

- root directory проекта: `meal-tracker`
- production branch: `main`
- build command: `npm run build`
- output directory: `dist`

### GitHub Pages

GitHub Pages публикует содержимое папки `meal-tracker` по адресу:

`https://albinaushakova.github.io/self-control-trackers/meal-tracker/`

Публичные страницы на GitHub Pages:

- `https://albinaushakova.github.io/self-control-trackers/meal-tracker/support.html`
- `https://albinaushakova.github.io/self-control-trackers/meal-tracker/privacy.html`

## Текущее состояние

Проект ведётся как само приложение. Лендинг и preview-страницы больше не являются частью поддерживаемой структуры проекта.
Миграция на React/Vite/Tailwind завершена, но публичный smoke-check на реальном деплое всё ещё требуется перед релизом.

## Артефакты публикации

- `publish-checklist.md`
- `release-qa-checklist.md`
- `store-listing-copy.md`
- `privacy-policy.md`
- `version-notes.md`
- `native-packaging-setup.md`
