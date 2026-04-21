defmodule INoteWeb.Live.LocaleHook do
  @moduledoc false

  import Phoenix.Component, only: [assign: 3]
  import Phoenix.LiveView, only: [attach_hook: 4]

  alias INoteWeb.I18n

  def on_mount(:default, _params, session, socket) do
    locale =
      session["locale"]
      |> I18n.normalize_locale()

    Gettext.put_locale(INoteWeb.Gettext, locale)

    socket =
      socket
      |> assign(:locale, locale)
      |> attach_hook(:sync_locale, :handle_params, fn _params, url, socket ->
        {:cont, assign(socket, :current_path, path_with_query(url))}
      end)

    {:cont, socket}
  end

  defp path_with_query(url) do
    uri = URI.parse(url)

    case uri.query do
      nil -> uri.path || "/"
      query -> "#{uri.path || "/"}?#{query}"
    end
  end
end
