defmodule INote.Repo.Migrations.CreateTodos do
  use Ecto.Migration

  def change do
    create table(:todos) do
      add :title, :string, null: false
      add :details, :text, null: false, default: ""
      add :completed, :boolean, default: false, null: false
      add :due_date, :date
      add :priority, :string
      add :position, :integer, null: false, default: 0
      add :note_id, references(:notes, on_delete: :nilify_all)

      timestamps()
    end

    create index(:todos, [:note_id])
    create index(:todos, [:position])
    create index(:todos, [:due_date])
  end
end
