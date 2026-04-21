defmodule INote.Notes.NoteTodo do
  use Ecto.Schema
  import Ecto.Changeset

  alias INote.Notes.Note

  schema "note_todos" do
    field :line_no, :integer
    field :text, :string
    field :is_done, :boolean, default: false

    belongs_to :note, Note

    timestamps()
  end

  @doc false
  def changeset(todo, attrs) do
    todo
    |> cast(attrs, [:note_id, :line_no, :text, :is_done])
    |> update_change(:text, &normalize_text/1)
    |> validate_required([:note_id, :line_no, :text, :is_done])
    |> validate_number(:line_no, greater_than: 0)
    |> validate_length(:text, max: 280)
  end

  defp normalize_text(value) when is_binary(value), do: String.trim(value)
  defp normalize_text(_value), do: ""
end
