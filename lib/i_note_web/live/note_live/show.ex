defmodule INoteWeb.NoteLive.Show do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     assign(socket,
       current_section: :notes,
       current_path: ~p"/notes",
       page_title: "Note",
       search_query: "",
       selected_date: Notes.today(),
       note: nil,
       save_status: :idle,
       title_input: ""
     )}
  end

  @impl true
  def handle_params(%{"id" => id}, _url, socket) do
    case Notes.get_note(id) do
      %{kind: :normal} = note ->
        {:noreply,
         assign(socket,
           current_path: ~p"/notes/#{note.id}",
           page_title: note.title,
           note: note,
           title_input: note.title,
           save_status: :idle
         )}

      %{kind: :daily, note_date: %Date{} = date} ->
        {:noreply, push_navigate(socket, to: ~p"/daily/#{Date.to_iso8601(date)}")}

      nil ->
        case Notes.parse_date(id) do
          {:ok, date} ->
            {:noreply, push_navigate(socket, to: ~p"/daily/#{Date.to_iso8601(date)}")}

          _ ->
            {:noreply, push_navigate(socket, to: ~p"/notes")}
        end
    end
  end

  @impl true
  def handle_event("autosave_note", %{"id" => id, "content_md" => content_md}, socket) do
    with %{id: note_id} = note <- socket.assigns.note,
         true <- to_string(note_id) == id do
      case Notes.update_note(note, %{content_md: content_md}) do
        {:ok, saved_note} ->
          {:noreply,
           assign(socket,
             note: saved_note,
             page_title: saved_note.title,
             save_status: :saved
           )}

        {:error, %Ecto.Changeset{} = changeset} ->
          {:noreply, put_flash(socket, :error, first_error(changeset))}

        {:error, reason} ->
          {:noreply, put_flash(socket, :error, inspect(reason))}
      end
    else
      _ -> {:noreply, socket}
    end
  end

  @impl true
  def handle_event("save_title", %{"title" => title}, socket) do
    case socket.assigns.note do
      %{kind: :normal} = note ->
        case Notes.update_note(note, %{title: title}) do
          {:ok, saved_note} ->
            {:noreply,
             assign(socket,
               note: saved_note,
               title_input: saved_note.title,
               page_title: saved_note.title,
               save_status: :saved
             )}

          {:error, %Ecto.Changeset{} = changeset} ->
            {:noreply, put_flash(socket, :error, first_error(changeset))}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, inspect(reason))}
        end

      _ ->
        {:noreply, socket}
    end
  end

  @impl true
  def handle_event("delete_note", _params, socket) do
    case socket.assigns.note do
      %{kind: :normal} = note ->
        case Notes.delete_note(note) do
          {:ok, _deleted_note} -> {:noreply, push_navigate(socket, to: ~p"/notes")}
          {:error, reason} -> {:noreply, put_flash(socket, :error, inspect(reason))}
        end

      _ ->
        {:noreply, socket}
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
end
