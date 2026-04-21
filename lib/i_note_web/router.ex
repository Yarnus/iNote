defmodule INoteWeb.Router do
  use INoteWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug INoteWeb.Plugs.Locale
    plug :fetch_live_flash
    plug :put_root_layout, html: {INoteWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", INoteWeb do
    pipe_through :browser

    get "/", PageController, :home
    get "/locale/:locale", LocaleController, :update

    live_session :default, on_mount: [INoteWeb.Live.LocaleHook] do
      live "/daily/:date", DailyNoteLive.Show, :show
      live "/reports/monthly/:month", MonthlyReportLive.Show, :show
      live "/notes", NoteLive.Index, :index
      live "/notes/:id", NoteLive.Show, :show
      live "/search", SearchLive.Index, :index
      live "/todos", TodoLive.Index, :index
      live "/tags", TagLive.Index, :index
    end
  end

  if Application.compile_env(:i_note, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through :browser

      live_dashboard "/dashboard", metrics: INoteWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
