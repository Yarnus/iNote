# Architecture Notes

This document captures a few implementation choices that are intentional and useful when maintaining the project.

## Source Of Truth

Markdown is the persisted source of truth. The editor enhances the writing experience, but notes are stored as markdown instead of HTML or a custom rich-text format.

## Derived Data

TODO items and hashtags are indexed from note content on save. This keeps the implementation simple and consistent for a local-first personal app.

## Search

SQLite FTS5 powers full-text search. It works well for local search, but Chinese tokenization is still basic.

## Editor Scope

The app intentionally supports a small markdown command set instead of a larger toolbar-heavy rich-text editor. This keeps the editing model easier to reason about and closer to the stored markdown.
