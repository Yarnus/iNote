defmodule INote.Repo.Migrations.CreateNotes do
  use Ecto.Migration

  def change do
    create table(:notes) do
      add :title, :string, null: false, default: "Untitled note"
      add :body_html, :text, null: false, default: ""
      add :body_text, :text, null: false, default: ""

      timestamps()
    end

    create index(:notes, [:updated_at])
  end
end
