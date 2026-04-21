defmodule INoteWeb.NoteRoutes do
  use Phoenix.VerifiedRoutes,
    endpoint: INoteWeb.Endpoint,
    router: INoteWeb.Router,
    statics: INoteWeb.static_paths()

  import INoteWeb.I18n, only: [t: 2]

  def note_path(%{kind: :daily, note_date: %Date{} = date}),
    do: ~p"/daily/#{Date.to_iso8601(date)}"

  def note_path(%{kind: "daily", note_date: %Date{} = date}),
    do: ~p"/daily/#{Date.to_iso8601(date)}"

  def note_path(%{id: id}), do: ~p"/notes/#{id}"

  def note_meta(_locale, %{kind: :daily, note_date: %Date{} = date}), do: Date.to_iso8601(date)
  def note_meta(_locale, %{kind: "daily", note_date: %Date{} = date}), do: Date.to_iso8601(date)
  def note_meta(locale, _note), do: t(locale, :general_note)
end
