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

  test "note page renders a browser-local last saved time hook", %{conn: conn} do
    {:ok, note} = Notes.create_note(%{title: "Saved note", content_md: "Initial"})
    {:ok, saved_note} = Notes.update_note(note, %{content_md: "Updated"})

    {:ok, _view, html} = live(conn, ~p"/notes/#{saved_note.id}")

    assert html =~ "Last saved"
    assert html =~ "phx-hook=\"LocalTime\""
    assert html =~ "data-local-datetime="
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

  test "daily page shows last saved timestamp", %{conn: conn} do
    note = Notes.get_or_create_daily_note!(~D[2026-04-21])
    {:ok, saved_note} = Notes.update_note(note, %{content_md: "Updated content"})

    {:ok, _view, html} = live(conn, ~p"/daily/#{Date.to_iso8601(saved_note.note_date)}")

    assert html =~ "Last saved"
    assert html =~ "phx-hook=\"LocalTime\""
    assert html =~ "data-local-datetime="
  end
end
