defmodule INoteWeb.Plugs.Locale do
  @moduledoc false

  import Plug.Conn

  alias INoteWeb.I18n

  def init(opts), do: opts

  def call(conn, _opts) do
    locale =
      conn
      |> get_session(:locale)
      |> case do
        nil -> detect_from_header(conn)
        value -> value
      end
      |> I18n.normalize_locale()

    Gettext.put_locale(INoteWeb.Gettext, locale)

    conn
    |> put_session(:locale, locale)
    |> assign(:locale, locale)
  end

  defp detect_from_header(conn) do
    conn
    |> get_req_header("accept-language")
    |> List.first()
    |> parse_accept_language()
  end

  defp parse_accept_language(nil), do: "en"

  defp parse_accept_language(header) do
    case Regex.run(~r/\b(zh|en)(?:[-_;,]|$)/i, header, capture: :all_but_first) do
      [locale] -> String.downcase(locale)
      _ -> "en"
    end
  end
end
