defmodule INoteWeb.TodoLive.Index do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()

    {:ok,
     assign(socket,
       current_section: :todos,
       current_path: ~p"/todos",
       page_title: "TODO items",
       search_query: "",
       selected_date: today,
       filter: :all,
       counts: %{all: 0, open: 0, done: 0},
       todos: []
     )}
  end

  @impl true
  def handle_params(params, _url, socket) do
    filter = normalize_filter(params["filter"])
    query = if filter == :all, do: [], else: [filter: filter]

    {:noreply,
     assign(socket,
       filter: filter,
       current_path: ~p"/todos?#{query}",
       page_title: t(socket.assigns.locale, :todos_title),
       selected_date: Notes.today(),
       todos: Notes.list_todos(filter),
       counts: %{
         all: Notes.count_todos(:all),
         open: Notes.count_todos(:open),
         done: Notes.count_todos(:done)
       }
     )}
  end

  @impl true
  def handle_event("change_filter", %{"filter" => filter}, socket) do
    filter = normalize_filter(filter)
    query = if filter == :all, do: [], else: [filter: filter]

    {:noreply, push_patch(socket, to: ~p"/todos?#{query}")}
  end

  defp normalize_filter("open"), do: :open
  defp normalize_filter("done"), do: :done
  defp normalize_filter(:open), do: :open
  defp normalize_filter(:done), do: :done
  defp normalize_filter(_), do: :all
end
