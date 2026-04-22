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
       selected_tag: nil,
       tags: Notes.list_tags(),
       notes: []
     )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    selected_tag = normalize_tag(params["tag"])

    {:noreply,
     assign(socket,
       page_title: t(socket.assigns.locale, :tags_title),
       current_path: tag_path(selected_tag),
       selected_date: Notes.today(),
       selected_tag: selected_tag,
       tags: Notes.list_tags(),
       notes: if(selected_tag, do: Notes.list_notes_by_tag(selected_tag), else: [])
     )}
  end

  defp tag_path(nil), do: ~p"/tags"
  defp tag_path(tag), do: ~p"/tags?#{[tag: tag]}"

  defp normalize_tag(nil), do: nil

  defp normalize_tag(tag) when is_binary(tag) do
    normalized =
      tag
      |> String.trim()
      |> String.trim_leading("#")
      |> String.downcase()

    if normalized == "", do: nil, else: normalized
  end

  defp tag_tone_class(tag) when is_binary(tag) do
    case :erlang.phash2(tag, 4) do
      0 -> "tag-chip--tone-1"
      1 -> "tag-chip--tone-2"
      2 -> "tag-chip--tone-3"
      _ -> "tag-chip--tone-4"
    end
  end
end
