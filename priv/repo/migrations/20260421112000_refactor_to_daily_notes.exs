defmodule INote.Repo.Migrations.RefactorToDailyNotes do
  use Ecto.Migration

  def up do
    create table(:daily_notes) do
      add :note_date, :date, null: false
      add :title, :string, null: false
      add :content_md, :text, null: false, default: ""

      timestamps()
    end

    create unique_index(:daily_notes, [:note_date])
    create index(:daily_notes, [:updated_at])

    execute("""
    CREATE VIRTUAL TABLE daily_notes_fts
    USING fts5(
      note_id UNINDEXED,
      title,
      content_md
    )
    """)

    create table(:note_tags) do
      add :daily_note_id, references(:daily_notes, on_delete: :delete_all), null: false
      add :tag, :string, null: false

      timestamps()
    end

    create index(:note_tags, [:daily_note_id])
    create index(:note_tags, [:tag])
    create unique_index(:note_tags, [:daily_note_id, :tag])

    create table(:note_todos) do
      add :daily_note_id, references(:daily_notes, on_delete: :delete_all), null: false
      add :line_no, :integer, null: false
      add :text, :string, null: false
      add :is_done, :boolean, null: false, default: false

      timestamps()
    end

    create index(:note_todos, [:daily_note_id])
    create index(:note_todos, [:is_done])
  end

  def down do
    drop table(:note_todos)
    drop table(:note_tags)

    execute("DROP TABLE daily_notes_fts")

    drop table(:daily_notes)
  end
end
