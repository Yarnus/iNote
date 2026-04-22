defmodule INote.Repo.Migrations.RemoveLineNoFromNoteTodos do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE note_todos RENAME TO note_todos_legacy")

    create table(:note_todos) do
      add :note_id, references(:notes, on_delete: :delete_all), null: false
      add :text, :string, null: false
      add :is_done, :boolean, null: false, default: false

      timestamps()
    end

    execute("""
    INSERT INTO note_todos (id, note_id, text, is_done, inserted_at, updated_at)
    SELECT id, note_id, text, is_done, inserted_at, updated_at
    FROM note_todos_legacy
    """)

    execute("DROP TABLE note_todos_legacy")

    create index(:note_todos, [:note_id], name: :note_todos_note_id_idx)
    create index(:note_todos, [:is_done], name: :note_todos_is_done_idx)
  end

  def down do
    execute("ALTER TABLE note_todos RENAME TO note_todos_without_line_no")

    create table(:note_todos) do
      add :note_id, references(:notes, on_delete: :delete_all), null: false
      add :line_no, :integer, null: false, default: 0
      add :text, :string, null: false
      add :is_done, :boolean, null: false, default: false

      timestamps()
    end

    execute("""
    INSERT INTO note_todos (id, note_id, line_no, text, is_done, inserted_at, updated_at)
    SELECT id, note_id, 0, text, is_done, inserted_at, updated_at
    FROM note_todos_without_line_no
    """)

    execute("DROP TABLE note_todos_without_line_no")

    create index(:note_todos, [:note_id], name: :note_todos_note_id_idx)
    create index(:note_todos, [:is_done], name: :note_todos_is_done_idx)
  end
end
