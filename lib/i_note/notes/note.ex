defmodule INote.Notes.Note do
  use Ecto.Schema
  import Ecto.Changeset

  alias INote.Notes.{NoteTag, NoteTodo}

  schema "notes" do
    field :kind, Ecto.Enum, values: [daily: "daily", normal: "normal"]
    field :note_date, :date
    field :title, :string
    field :content_md, :string, default: ""

    has_many :tags, NoteTag
    has_many :todos, NoteTodo

    timestamps()
  end

  @doc false
  def changeset(note, attrs) do
    note
    |> cast(attrs, [:kind, :note_date, :title, :content_md])
    |> update_change(:title, &normalize_title/1)
    |> update_change(:content_md, &normalize_markdown/1)
    |> normalize_note_date()
    |> validate_required([:kind, :title])
    |> validate_kind_constraints()
    |> validate_length(:title, max: 120)
    |> validate_length(:content_md, max: 300_000)
    |> unique_constraint(:note_date, name: :notes_daily_note_date_uidx)
  end

  defp normalize_note_date(changeset) do
    case get_field(changeset, :kind) do
      :normal -> put_change(changeset, :note_date, nil)
      _ -> changeset
    end
  end

  defp validate_kind_constraints(changeset) do
    case get_field(changeset, :kind) do
      :daily -> validate_required(changeset, [:note_date])
      :normal -> changeset
      _ -> changeset
    end
  end

  defp normalize_title(value) when is_binary(value),
    do: value |> String.trim() |> String.slice(0, 120)

  defp normalize_title(value), do: value |> to_string() |> normalize_title()

  defp normalize_markdown(value) when is_binary(value), do: String.trim_trailing(value)
  defp normalize_markdown(_value), do: ""
end
