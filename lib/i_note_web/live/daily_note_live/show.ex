defmodule INoteWeb.DailyNoteLive.Show do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()

    {:ok,
     assign(socket,
       current_section: :daily,
       current_path: ~p"/daily/#{Date.to_iso8601(today)}",
       page_title: "Daily note",
       search_query: "",
       selected_date: today,
       monthly_report_path:
         ~p"/reports/monthly/#{Date.to_iso8601(Date.beginning_of_month(today))}",
       note: nil,
       save_status: :idle
     )}
  end

  @impl true
  def handle_params(%{"date" => raw_date}, _url, socket) do
    case Notes.parse_date(raw_date) do
      {:ok, date} ->
        note = Notes.get_or_create_daily_note!(date)

        {:noreply,
         assign(socket,
           page_title: Date.to_iso8601(date),
           current_path: ~p"/daily/#{Date.to_iso8601(date)}",
           selected_date: date,
           monthly_report_path:
             ~p"/reports/monthly/#{Date.to_iso8601(Date.beginning_of_month(date))}",
           note: note,
           save_status: :idle
         )}

      _ ->
        today = Date.to_iso8601(Notes.today())
        {:noreply, push_navigate(socket, to: ~p"/daily/#{today}")}
    end
  end

  @impl true
  def handle_event("autosave_note", %{"id" => id, "content_md" => content_md}, socket) do
    note = socket.assigns.note

    case note && to_string(note.id) == id do
      false ->
        {:noreply, socket}

      true ->
        case Notes.update_note(note, %{content_md: content_md}) do
          {:ok, saved_note} ->
            {:noreply,
             assign(socket,
               note: saved_note,
               page_title: Date.to_iso8601(saved_note.note_date),
               save_status: :saved
             )}

          {:error, %Ecto.Changeset{} = changeset} ->
            {:noreply, put_flash(socket, :error, first_error(changeset))}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, inspect(reason))}
        end
    end
  end

  @impl true
  def handle_event("set_status_idle", _params, socket) do
    {:noreply, assign(socket, :save_status, :idle)}
  end

  defp first_error(changeset) do
    changeset.errors
    |> List.first()
    |> case do
      {field, {message, _opts}} -> "#{field} #{message}"
      nil -> "Could not save note"
    end
  end

  defp save_status_text(locale, :saved), do: t(locale, :saved)
  defp save_status_text(locale, _), do: t(locale, :save_hint)

  defp last_saved_at_iso(nil), do: nil

  defp last_saved_at_iso(%NaiveDateTime{} = updated_at), do: "#{NaiveDateTime.to_iso8601(updated_at)}Z"
  defp last_saved_at_iso(%DateTime{} = updated_at), do: DateTime.to_iso8601(updated_at)

  defp last_saved_fallback_text(nil), do: nil
  defp last_saved_fallback_text(updated_at), do: Calendar.strftime(updated_at, "%Y-%m-%d %H:%M")

  defp page_date_title("zh", date), do: Calendar.strftime(date, "%Y年%m月%d日")
  defp page_date_title(_, date), do: Calendar.strftime(date, "%A, %B %-d, %Y")
end
