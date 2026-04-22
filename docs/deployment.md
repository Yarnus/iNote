# Deployment Guide

This document covers the production runtime configuration for iNote.

## Database

`prod` uses SQLite and reads the database file path from `INOTE_DATABASE_PATH`.

Example:

```bash
export INOTE_DATABASE_PATH=/var/lib/i_note/i_note.db
export INOTE_SECRET_KEY_BASE="$(mix phx.gen.secret)"
export INOTE_HOST=notes.example.com
export INOTE_PORT=4000
export INOTE_POOL_SIZE=5
```

## Practical Notes

- `INOTE_DATABASE_PATH` should point to a persistent writable file on the server.
- The parent directory must exist before the app starts, for example `/var/lib/i_note`.
- Run `bin/migrate` once before the first `bin/server`.
- If you put Phoenix behind Nginx or Caddy, keeping `INOTE_PORT=4000` is enough.

## Related

- [Release guide](release.md)
