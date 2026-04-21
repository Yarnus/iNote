defmodule INoteWeb.RoutesControllerTest do
  use INoteWeb.ConnCase

  test "home redirects to today's daily note", %{conn: conn} do
    conn = get(conn, ~p"/")
    today = Date.utc_today() |> Date.to_iso8601()

    assert redirected_to(conn) == "/daily/#{today}"
  end

  test "main routes render", %{conn: conn} do
    assert html_response(get(conn, ~p"/notes"), 200) =~ "Notes"
    assert html_response(get(conn, ~p"/search"), 200) =~ "Search"
    assert html_response(get(conn, ~p"/todos"), 200) =~ "TODO"
    assert html_response(get(conn, ~p"/tags"), 200) =~ "Tag"
  end
end
