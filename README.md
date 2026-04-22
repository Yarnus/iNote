# iNote

[![Elixir](https://img.shields.io/badge/Elixir-1.18-6e4a7e?logo=elixir&logoColor=white)](https://elixir-lang.org/)
[![Erlang](https://img.shields.io/badge/Erlang-OTP%2027-a90533?logo=erlang&logoColor=white)](https://www.erlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Local-first markdown notes for one person, built with Phoenix LiveView and SQLite.

iNote is a small note app that keeps markdown as the source of truth and stays intentionally narrow: daily notes, general notes, fast search, task extraction, and monthly rollups. It is designed for local personal use, with a simple Phoenix + SQLite stack and no account, sync, or collaboration layer.

![iNote screenshot](preview.png)

## Highlights

- Daily notes by date
- General notes with custom titles
- Typora-like markdown editing flow
- Write/source mode toggle
- Inline code and fenced code block support
- Syntax highlighting for code fences
- Full-text search
- TODO filtering from markdown checkboxes
- Monthly report grouped by week from daily note tasks
- Tag browsing from inline hashtags
- Light and dark mode
- Bilingual UI: English and Chinese

## Stack

- Elixir
- Phoenix + LiveView
- SQLite via `ecto_sqlite3`

## Product Boundaries

- No auth
- No sync or cloud features
- No team collaboration
- No scheduling or due-date subsystem

## Editor

The editor uses markdown as the persisted format and supports a compact Typora-style writing flow:

- `# ` through `###### ` for headings
- `- `, `1. `, `> ` for lists and blockquotes
- `- [ ] ` and `- [x] ` for task items
- `` `inline code` `` and fenced code blocks with language labels
- Toggle between rich writing mode and raw markdown source mode
- Autosave while typing

This keeps storage and indexing simple while still feeling close to a rich editor when you write.

## Quick Start

Prerequisites:

- Elixir / Erlang
- Node.js

Install dependencies, create the database, and build assets:

```bash
make setup
```

`make setup`, `make assets`, and `make release` now install `assets/package.json` dependencies automatically.

Run the app:

```bash
make run
```

Then open `http://localhost:4000`.

## Common Commands

```bash
make test
make assets
make reset
```

## Docs

- [Usage guide](docs/usage.md)
- [Release guide](docs/release.md)
- [Deployment guide](docs/deployment.md)
- [Architecture notes](docs/architecture.md)

The README stays focused on product overview and local development. Release, deployment, and implementation notes live under `docs/`.
