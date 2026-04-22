defmodule INoteWeb.SearchLive.Index do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()

    {:ok,
     assign(socket,
       current_section: :search,
       current_path: ~p"/search",
       page_title: "Search notes",
       search_query: "",
       query: "",
       selected_date: today,
       results: []
     )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    query = String.trim(params["q"] || "")

    {:noreply,
     assign(socket,
       page_title: t(socket.assigns.locale, :search_title),
       current_path: if(query == "", do: ~p"/search", else: ~p"/search?#{[q: query]}"),
       search_query: query,
       selected_date: Notes.today(),
       query: query,
       results: Notes.search_notes(query)
     )}
  end

  @impl true
  def handle_event("query_changed", %{"q" => query}, socket) do
    query = String.trim(query)

    {:noreply,
     push_patch(socket,
       to: if(query == "", do: ~p"/search", else: ~p"/search?#{[q: query]}")
     )}
  end
end
