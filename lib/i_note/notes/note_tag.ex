defmodule INote.Notes.NoteTag do
  use Ecto.Schema
  import Ecto.Changeset

  alias INote.Notes.Note

  schema "note_tags" do
    field :tag, :string

    belongs_to :note, Note

    timestamps()
  end

  @doc false
  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:note_id, :tag])
    |> update_change(:tag, &normalize_tag/1)
    |> validate_required([:note_id, :tag])
    |> validate_length(:tag, max: 64)
    |> unique_constraint([:note_id, :tag], name: :note_tags_note_id_tag_uidx)
  end

  defp normalize_tag(value) when is_binary(value), do: value |> String.trim() |> String.downcase()
  defp normalize_tag(_value), do: ""
end
