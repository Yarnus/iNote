defmodule INote.Repo.Migrations.CreateEvents do
  use Ecto.Migration

  def change do
    create table(:events) do
      add :title, :string, null: false
      add :description, :text, null: false, default: ""
      add :starts_at, :naive_datetime, null: false
      add :ends_at, :naive_datetime, null: false
      add :all_day, :boolean, default: false, null: false
      add :note_id, references(:notes, on_delete: :nilify_all)
      add :todo_id, references(:todos, on_delete: :nilify_all)

      timestamps()
    end

    create index(:events, [:note_id])
    create index(:events, [:todo_id])
    create index(:events, [:starts_at])
  end
end
