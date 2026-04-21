defmodule INoteWeb.PageController do
  use INoteWeb, :controller

  def home(conn, _params) do
    today = Date.utc_today() |> Date.to_iso8601()
    redirect(conn, to: ~p"/daily/#{today}")
  end
end
