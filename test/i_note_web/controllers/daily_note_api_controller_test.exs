defmodule INoteWeb.DailyNoteAPIControllerTest do
  use INoteWeb.ConnCase

  alias INote.Notes

  test "returns month-grouped daily note content for a date range", %{conn: conn} do
    january_note = Notes.get_or_create_daily_note!(~D[2026-01-15])
    february_note = Notes.get_or_create_daily_note!(~D[2026-02-02])
    {:ok, _} = Notes.update_note(january_note, %{content_md: "January planning"})
    {:ok, _} = Notes.update_note(february_note, %{content_md: "February delivery"})

    conn =
      get(conn, ~p"/api/daily-notes?start_date=2026-01-01&end_date=2026-02-28")

    assert json_response(conn, 200) == %{
             "start_date" => "2026-01-01",
             "end_date" => "2026-02-28",
             "count" => 2,
             "month_groups" => [
               %{
                 "month" => "2026-01",
                 "notes" => [
                   %{
                     "note_date" => "2026-01-15",
                     "title" => january_note.title,
                     "content_md" => "January planning"
                   }
                 ]
               },
               %{
                 "month" => "2026-02",
                 "notes" => [
                   %{
                     "note_date" => "2026-02-02",
                     "title" => february_note.title,
                     "content_md" => "February delivery"
                   }
                 ]
               }
             ]
           }
  end

  test "returns 422 for invalid date params", %{conn: conn} do
    conn = get(conn, ~p"/api/daily-notes?start_date=bad-date&end_date=2026-02-28")

    assert json_response(conn, 422) == %{
             "error" => "start_date must be a valid ISO8601 date"
           }
  end

  test "returns 422 when start_date is after end_date", %{conn: conn} do
    conn = get(conn, ~p"/api/daily-notes?start_date=2026-03-01&end_date=2026-02-28")

    assert json_response(conn, 422) == %{
             "error" => "start_date must be less than or equal to end_date"
           }
  end
end
