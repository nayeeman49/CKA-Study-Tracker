# CKA Study Tracker

Web app for working through the CNCF CKA v1.35 syllabus with progress tracking, a study calendar, streaks and a shared leaderboard.

## Run
    npm install
    npm start            # http://localhost:3000
Needs Node 22.5+ (uses the built-in `node:sqlite`). Data lives in `data/cka.db` (override with `DATA_DIR`).
Behind HTTPS set `COOKIE_SECURE=1`.

Docker: `docker build -t cka-tracker . && docker run -p 3000:3000 -v cka-data:/data cka-tracker`

## Curriculum
`npm run build:curriculum` regenerates `data/curriculum.json` from `content/docs` (the course repo). Domain weights are in `scripts/build-curriculum.js` (from the CNCF PDF).

## Features
Accounts (scrypt + session cookie) · curriculum checklist with in-app lesson reader · exam-weighted readiness · calendar heatmap with scheduling, auto-plan to exam date, time logging · streaks and nudges · .ics daily reminder + browser notifications · leaderboard, activity feed and public profiles (opt-out in Settings).
