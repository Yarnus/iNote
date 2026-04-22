defmodule INoteWeb.EditorLiveTest do
  use INoteWeb.ConnCase

  import Phoenix.LiveViewTest

  alias INote.Notes

  test "note page renders editor mode toggles and source textarea", %{conn: conn} do
    {:ok, note} =
      Notes.create_note(%{
        title: "Editor test",
        content_md: """
        ```elixir
        IO.puts(:ok)
        ```
        """
      })

    {:ok, _view, html} = live(conn, ~p"/notes/#{note.id}")

    assert html =~ "data-editor-mode-trigger=\"rich\""
    assert html =~ "data-editor-mode-trigger=\"source\""
    assert html =~ "data-markdown-source"
    assert html =~ "Write"
    assert html =~ "Source"
  end

  test "daily page renders editor mode toggles and source textarea", %{conn: conn} do
    note = Notes.get_or_create_daily_note!(~D[2026-04-20])

    {:ok, _view, html} = live(conn, ~p"/daily/#{Date.to_iso8601(note.note_date)}")

    assert html =~ "data-editor-mode-trigger=\"rich\""
    assert html =~ "data-editor-mode-trigger=\"source\""
    assert html =~ "data-markdown-source"
    assert html =~ "Write"
    assert html =~ "Source"
  end
end
