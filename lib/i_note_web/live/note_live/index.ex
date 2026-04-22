defmodule INoteWeb.NoteLive.Index do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()

    {:ok,
     assign(socket,
       current_section: :notes,
       current_path: ~p"/notes",
       page_title: "Notes",
       search_query: "",
       selected_date: today,
       notes: [],
       query: "",
       sort: "updated_desc"
     )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    query = String.trim(params["q"] || "")
    sort = normalize_sort(params["sort"])
    route_params = note_index_params(query, sort)

    {:noreply,
     assign(socket,
       current_path: ~p"/notes?#{route_params}",
       notes: Notes.list_notes(query: query, sort: sort),
       query: query,
       sort: Atom.to_string(sort)
     )}
  end

  @impl true
  def handle_event("query_changed", %{"q" => query}, socket) do
    query = String.trim(query)
    sort = normalize_sort(socket.assigns.sort)

    {:noreply, push_patch(socket, to: ~p"/notes?#{note_index_params(query, sort)}")}
  end

  @impl true
  def handle_event("sort_changed", %{"sort" => sort}, socket) do
    sort = normalize_sort(sort)
    query = socket.assigns.query

    {:noreply, push_patch(socket, to: ~p"/notes?#{note_index_params(query, sort)}")}
  end

  @impl true
  def handle_event("create_note", _params, socket) do
    case Notes.create_note() do
      {:ok, note} ->
        {:noreply, push_navigate(socket, to: ~p"/notes/#{note.id}")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, inspect(reason))}
    end
  end

  defp note_index_params(query, sort) do
    []
    |> maybe_put_param(:q, query)
    |> maybe_put_param(:sort, sort_param(sort))
  end

  defp maybe_put_param(params, _key, nil), do: params
  defp maybe_put_param(params, _key, ""), do: params
  defp maybe_put_param(params, _key, "updated_desc"), do: params
  defp maybe_put_param(params, _key, :updated_desc), do: params
  defp maybe_put_param(params, key, value), do: Keyword.put(params, key, value)

  defp normalize_sort(:updated_asc), do: :updated_asc
  defp normalize_sort(:title_asc), do: :title_asc
  defp normalize_sort(:title_desc), do: :title_desc
  defp normalize_sort("updated_asc"), do: :updated_asc
  defp normalize_sort("title_asc"), do: :title_asc
  defp normalize_sort("title_desc"), do: :title_desc
  defp normalize_sort(_), do: :updated_desc

  defp sort_param(sort) when is_atom(sort), do: Atom.to_string(sort)
  defp sort_param(sort), do: sort
end
