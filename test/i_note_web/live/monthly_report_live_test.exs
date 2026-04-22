defmodule INoteWeb.MonthlyReportLiveTest do
  use INoteWeb.ConnCase

  import Phoenix.LiveViewTest

  alias INote.Notes

  test "daily page links to the selected month's report", %{conn: conn} do
    {:ok, _view, html} = live(conn, ~p"/daily/2026-04-18")

    assert html =~ ~p"/reports/monthly/2026-04-01"
    assert html =~ "Monthly Report"
  end

  test "monthly report page renders grouped task items", %{conn: conn} do
    first_day = Notes.get_or_create_daily_note!(~D[2026-04-01])
    eighth_day = Notes.get_or_create_daily_note!(~D[2026-04-08])

    {:ok, _} =
      Notes.update_note(first_day, %{
        content_md: """
        - [ ] Draft milestone plan
        """
      })

    {:ok, _} =
      Notes.update_note(eighth_day, %{
        content_md: """
        - [x] Ship first deliverable
        """
      })

    {:ok, _view, html} = live(conn, ~p"/reports/monthly/2026-04-01")

    assert html =~ "Monthly report"
    assert html =~ "Week 1 (04/01-04/03)"
    assert html =~ "Draft milestone plan"
    assert html =~ "monthly-report-output"
    assert html =~ "Copy report"
    assert html =~ "- Draft milestone plan"
    assert html =~ "Week 2 (04/06-04/10)"
    assert html =~ "- Ship first deliverable"
    refute html =~ "[ ]"
    refute html =~ "[x]"
    refute html =~ "report-week__title"
  end

  test "monthly report page shows an empty state when the month has no tasks", %{conn: conn} do
    {:ok, _view, html} = live(conn, ~p"/reports/monthly/2026-06-01")

    assert html =~ "No task items found for this month."
    assert html =~ ~s(class="empty-panel report-panel")
  end
end
