defmodule INote.Repo.Migrations.UnifyNotesModel do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE notes RENAME TO legacy_notes")

    create table(:notes) do
      add :kind, :string, null: false
      add :note_date, :date
      add :title, :string, null: false
      add :content_md, :text, null: false, default: ""

      timestamps()
    end

    execute("""
    INSERT INTO notes (id, kind, note_date, title, content_md, inserted_at, updated_at)
    SELECT id, 'daily', note_date, title, content_md, inserted_at, updated_at
    FROM daily_notes
    """)

    execute("""
    INSERT INTO notes (kind, note_date, title, content_md, inserted_at, updated_at)
    SELECT 'normal', NULL, title, body_text, inserted_at, updated_at
    FROM legacy_notes
    """)

    create unique_index(:notes, [:note_date], name: :notes_daily_note_date_uidx)
    create index(:notes, [:kind], name: :notes_kind_idx)
    create index(:notes, [:updated_at], name: :notes_updated_at_idx)

    create table(:note_tags_v2) do
      add :note_id, references(:notes, on_delete: :delete_all), null: false
      add :tag, :string, null: false

      timestamps()
    end

    execute("""
    INSERT INTO note_tags_v2 (note_id, tag, inserted_at, updated_at)
    SELECT daily_note_id, tag, inserted_at, updated_at
    FROM note_tags
    """)

    create table(:note_todos_v2) do
      add :note_id, references(:notes, on_delete: :delete_all), null: false
      add :line_no, :integer, null: false
      add :text, :string, null: false
      add :is_done, :boolean, null: false, default: false

      timestamps()
    end

    execute("""
    INSERT INTO note_todos_v2 (note_id, line_no, text, is_done, inserted_at, updated_at)
    SELECT daily_note_id, line_no, text, is_done, inserted_at, updated_at
    FROM note_todos
    """)

    execute("DROP TABLE note_todos")
    execute("ALTER TABLE note_todos_v2 RENAME TO note_todos")
    create index(:note_todos, [:note_id], name: :note_todos_note_id_idx)
    create index(:note_todos, [:is_done], name: :note_todos_is_done_idx)

    execute("DROP TABLE note_tags")
    execute("ALTER TABLE note_tags_v2 RENAME TO note_tags")
    create index(:note_tags, [:note_id], name: :note_tags_note_id_idx)
    create index(:note_tags, [:tag], name: :note_tags_tag_idx)
    create unique_index(:note_tags, [:note_id, :tag], name: :note_tags_note_id_tag_uidx)

    execute("DROP TABLE daily_notes_fts")

    execute("""
    CREATE VIRTUAL TABLE notes_fts
    USING fts5(
      note_id UNINDEXED,
      title,
      content_md
    )
    """)

    execute("""
    INSERT INTO notes_fts (rowid, note_id, title, content_md)
    SELECT id, id, title, content_md
    FROM notes
    """)

    execute("DROP TABLE daily_notes")
  end

  def down do
    raise "Irreversible migration"
  end
end
