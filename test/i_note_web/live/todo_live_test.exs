defmodule INoteWeb.TodoLiveTest do
  use INoteWeb.ConnCase

  import Phoenix.LiveViewTest

  alias INote.Notes

  test "todos page defaults to open items and hides date and open-note link", %{conn: conn} do
    daily = Notes.get_or_create_daily_note!(~D[2026-04-22])
    {:ok, normal} = Notes.create_note(%{title: "Project inbox"})

    {:ok, _} =
      Notes.update_note(daily, %{
        content_md: """
        - [ ] Draft architecture notes
        - [x] Archive old tasks
        """
      })

    {:ok, _} =
      Notes.update_note(normal, %{
        content_md: """
        - [ ] Reply to partner updates
        """
      })

    {:ok, view, html} = live(conn, ~p"/todos")

    assert html =~ "Draft architecture notes"
    assert html =~ "Reply to partner updates"
    assert html =~ "Project inbox"
    assert has_element?(view, ".todo-filter--open.is-active")
    refute has_element?(view, ".todo-row__meta", "2026-04-22")
    refute html =~ "#1"
    refute html =~ "Archive old tasks"
    refute html =~ "Open note"
    refute html =~ "line 1"
  end

  test "todos page supports explicit all and done filters", %{conn: conn} do
    daily = Notes.get_or_create_daily_note!(~D[2026-04-22])

    {:ok, _} =
      Notes.update_note(daily, %{
        content_md: """
        - [ ] Draft architecture notes
        - [x] Archive old tasks
        """
      })

    {:ok, _all_view, all_html} = live(conn, ~p"/todos?filter=all")
    {:ok, _done_view, done_html} = live(conn, ~p"/todos?filter=done")

    assert all_html =~ "Draft architecture notes"
    assert all_html =~ "Archive old tasks"

    assert done_html =~ "Archive old tasks"
    refute done_html =~ "Draft architecture notes"
  end
end
