# iNote

Local-first markdown notes built with Phoenix LiveView and SQLite.

iNote is a small personal notes app for a single local user. It keeps the stack simple, stores markdown as the source of truth, and focuses on fast note-taking instead of workspace features.

## Highlights

- Daily notes by date
- General notes with custom titles
- Typora-like markdown editing flow
- Full-text search
- TODO filtering from markdown checkboxes
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

## Pages

- `/` redirects to today's daily note
- `/daily/:date` opens or creates a daily note
- `/notes` lists general notes and creates a new one
- `/notes/:id` opens a general note
- `/search` searches across notes
- `/todos` filters checkbox items across notes
- `/tags` browses notes by tag
- `/locale/:locale` switches UI language between `en` and `zh`

## Editor

The editor uses markdown as the persisted format and supports a compact Typora-style writing flow:

- `# `, `## `, `### ` for headings
- `- `, `1. `, `> ` for lists and blockquotes
- `- [ ] ` and `- [x] ` for task items
- Autosave while typing

This keeps storage and indexing simple while still feeling close to a rich editor.

## Quick Start

Prerequisites:

- Elixir / Erlang
- Node.js

Install dependencies, create the database, and build assets:

```bash
make setup
```

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

## Release

Build a production release:

```bash
MIX_ENV=prod mix deps.get
MIX_ENV=prod mix assets.deploy
MIX_ENV=prod mix release
```

The release tarball is generated at:

```bash
_build/prod/rel/i_note/releases/0.1.0/i_note.tar.gz
```

After extracting it on the server, you can use:

```bash
bin/migrate
bin/server
```

`bin/server` starts Phoenix with `INOTE_SERVER=true`. `bin/migrate` runs all pending Ecto migrations inside the release.

## Production Database

`prod` uses SQLite and reads the database file path from `INOTE_DATABASE_PATH`.

Example:

```bash
export INOTE_DATABASE_PATH=/var/lib/i_note/i_note.db
export INOTE_SECRET_KEY_BASE="$(mix phx.gen.secret)"
export INOTE_HOST=notes.example.com
export INOTE_PORT=4000
export INOTE_POOL_SIZE=5
```

Practical deployment notes:

- `INOTE_DATABASE_PATH` should point to a persistent writable file on the server.
- The parent directory must exist before the app starts, for example `/var/lib/i_note`.
- Run `bin/migrate` once before the first `bin/server`.
- If you put Phoenix behind Nginx or Caddy, keeping `INOTE_PORT=4000` is enough.

## Notes

- TODO and tag indexes are rebuilt on note save. This is intentional and keeps the implementation simple for local personal use.
- SQLite FTS5 works well for local search, but Chinese tokenization is still basic.
- The app intentionally prefers a small markdown command set over a larger rich-text toolbar.
