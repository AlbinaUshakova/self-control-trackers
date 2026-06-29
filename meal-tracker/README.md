# EatLog

Простой офлайн-first трекер приёмов пищи и перекусов.

## Ссылки

- Production (Vercel): `https://eatlog-tracker.vercel.app/`
- GitHub Pages: `https://albinaushakova.github.io/self-control-trackers/meal-tracker/`

## Что умеет

- добавлять приёмы пищи и перекусы
- показывать интервалы между приёмами, включая последний приём в дневнике дня
- считать статистику по дню и по периоду
- хранить данные локально в `localStorage`
- работать как PWA через `service-worker.js`

## Структура

- [index.html](/Users/albina/Desktop/self-control-trackers/meal-tracker/index.html) — основной entrypoint приложения
- [app.html](/Users/albina/Desktop/self-control-trackers/meal-tracker/app.html) — альтернативный entrypoint, редиректится на корень в Vercel
- [service-worker.js](/Users/albina/Desktop/self-control-trackers/meal-tracker/service-worker.js) — офлайн-кеш и обновление PWA
- [manifest.json](/Users/albina/Desktop/self-control-trackers/meal-tracker/manifest.json) — PWA manifest
- [vercel.json](/Users/albina/Desktop/self-control-trackers/meal-tracker/vercel.json) — маршрутизация для Vercel

## Маршруты

- `/` — основной URL приложения
- `/app` и `/app.html` — редирект на `/`
- `/index.html` — редирект на `/` на Vercel

## Локальная разработка

Проект статический. Для локального запуска достаточно открыть `index.html` через локальный сервер.

Примеры:

```bash
python3 -m http.server
```

или

```bash
npx serve .
```

## Деплой

### Vercel

- root directory проекта: `meal-tracker`
- production branch: `main`
- build command не нужен

### GitHub Pages

GitHub Pages публикует содержимое папки `meal-tracker` по адресу:

`https://albinaushakova.github.io/self-control-trackers/meal-tracker/`

## Текущее состояние

Проект ведётся как само приложение. Лендинг и preview-страницы больше не являются частью поддерживаемой структуры проекта.
