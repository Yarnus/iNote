defmodule INoteWeb.TagLive.Index do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()

    {:ok,
     assign(socket,
       current_section: :tags,
       current_path: ~p"/tags",
       page_title: "Tag browser",
       search_query: "",
       selected_date: today,
       calendar_note_dates: Notes.list_dates_with_daily_notes(today),
       query: "",
       selected_tag: nil,
       tags: Notes.list_tags(""),
       notes: []
     )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    query = String.trim(params["q"] || "")
    selected_tag = normalize_tag(params["tag"])

    route_params =
      []
      |> maybe_put_param(:q, query)
      |> maybe_put_param(:tag, selected_tag)

    {:noreply,
     assign(socket,
       page_title: t(socket.assigns.locale, :tags_title),
       current_path: ~p"/tags?#{route_params}",
       selected_date: Notes.today(),
       calendar_note_dates: Notes.list_dates_with_daily_notes(Notes.today()),
       query: query,
       selected_tag: selected_tag,
       tags: Notes.list_tags(query),
       notes: if(selected_tag, do: Notes.list_notes_by_tag(selected_tag), else: [])
     )}
  end

  @impl true
  def handle_event("query_changed", %{"q" => query}, socket) do
    query = String.trim(query)
    selected_tag = socket.assigns.selected_tag

    params =
      []
      |> maybe_put_param(:q, query)
      |> maybe_put_param(:tag, selected_tag)

    {:noreply, push_patch(socket, to: ~p"/tags?#{params}")}
  end

  defp maybe_put_param(params, _key, nil), do: params
  defp maybe_put_param(params, _key, ""), do: params
  defp maybe_put_param(params, key, value), do: Keyword.put(params, key, value)

  defp normalize_tag(nil), do: nil

  defp normalize_tag(tag) when is_binary(tag) do
    normalized =
      tag
      |> String.trim()
      |> String.trim_leading("#")
      |> String.downcase()

    if normalized == "", do: nil, else: normalized
  end
end
