defmodule INoteWeb.DailyNoteAPIController do
  use INoteWeb, :controller

  alias INote.Notes

  def index(conn, params) do
    with {:ok, start_date} <- fetch_iso8601_date(params, "start_date"),
         {:ok, end_date} <- fetch_iso8601_date(params, "end_date"),
         :ok <- validate_date_order(start_date, end_date) do
      notes = Notes.list_daily_notes_in_range(start_date, end_date)

      json(conn, %{
        start_date: Date.to_iso8601(start_date),
        end_date: Date.to_iso8601(end_date),
        count: length(notes),
        month_groups: group_notes_by_month(notes)
      })
    else
      {:error, message} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: message})
    end
  end

  defp fetch_iso8601_date(params, key) do
    case Map.fetch(params, key) do
      {:ok, value} when is_binary(value) ->
        case Date.from_iso8601(value) do
          {:ok, date} -> {:ok, date}
          {:error, _} -> {:error, "#{key} must be a valid ISO8601 date"}
        end

      {:ok, _value} ->
        {:error, "#{key} must be a string"}

      :error ->
        {:error, "#{key} is required"}
    end
  end

  defp validate_date_order(start_date, end_date) do
    case Date.compare(start_date, end_date) do
      :gt -> {:error, "start_date must be less than or equal to end_date"}
      _ -> :ok
    end
  end

  defp group_notes_by_month(notes) do
    notes
    |> Enum.group_by(&Calendar.strftime(&1.note_date, "%Y-%m"))
    |> Enum.map(fn {month, month_notes} ->
      %{
        month: month,
        notes: Enum.map(month_notes, &serialize_note/1)
      }
    end)
    |> Enum.sort_by(& &1.month)
  end

  defp serialize_note(note) do
    %{
      note_date: Date.to_iso8601(note.note_date),
      title: note.title,
      content_md: note.content_md
    }
  end
end
