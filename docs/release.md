# Release Guide

This document covers building a production release and publishing a release artifact.

## Build

Build a production release on macOS:

```bash
make release
```

The release tarball is generated at:

```bash
_build/prod/i_note-0.1.0.tar.gz
```

Adjust the version in the filename to match `mix.exs`.

## Run A Release

After extracting it on the server, you can use:

```bash
bin/migrate
bin/server
```

`bin/server` starts Phoenix with `INOTE_SERVER=true`. `bin/migrate` runs all pending Ecto migrations inside the release.

## Publish To GitHub Releases

```bash
git tag v0.1.0
git push origin v0.1.0
gh release create v0.1.0 _build/prod/i_note-0.1.0.tar.gz \
  --title "iNote v0.1.0"
```

Adjust the version in the commands above to match `mix.exs`.
