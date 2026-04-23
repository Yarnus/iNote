# Deployment Guide

This document covers the production runtime configuration for iNote.

## Database

`prod` uses SQLite and reads the database file path from `INOTE_DATABASE_PATH`.

Example:

```bash
export INOTE_DATABASE_PATH=/var/lib/i_note/i_note.db
export INOTE_SECRET_KEY_BASE="$(mix phx.gen.secret)"
export INOTE_HOST=notes.example.com
export INOTE_BIND_IP=127.0.0.1
export INOTE_PORT=4000
export INOTE_POOL_SIZE=5
```

## Practical Notes

- `INOTE_DATABASE_PATH` should point to a persistent writable file on the server.
- The parent directory must exist before the app starts, for example `/var/lib/i_note`.
- Run `bin/migrate` once before the first `bin/server`.
- If you put Phoenix behind Nginx or Caddy, keeping `INOTE_PORT=4000` is enough.
- `INOTE_HOST` controls generated URLs and origin checks. It does not control the listen interface.
- `INOTE_BIND_IP` controls the listen interface for the release:
  `127.0.0.1` for local-only access,
  `0.0.0.0` to expose IPv4 on the LAN,
  `::1` for IPv6 loopback only,
  `::` to expose IPv6 on all interfaces.

## Related

- [Release guide](release.md)
