defmodule INoteWeb.LocaleController do
  use INoteWeb, :controller

  alias INoteWeb.I18n

  def update(conn, %{"locale" => locale} = params) do
    locale = I18n.normalize_locale(locale)
    to = sanitize_path(params["to"])

    conn
    |> put_session(:locale, locale)
    |> redirect(to: to)
  end

  defp sanitize_path(nil), do: "/"

  defp sanitize_path(path) when is_binary(path) do
    if String.starts_with?(path, "/"), do: path, else: "/"
  end
end
