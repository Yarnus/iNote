defmodule INoteWeb.LayoutsTest do
  use ExUnit.Case, async: true

  alias INoteWeb.Layouts
  alias INoteWeb.I18n
  import Phoenix.LiveViewTest

  test "calendar_days/1 renders a sunday-first grid" do
    days = Layouts.calendar_days(~D[2026-04-01])

    assert hd(days) == ~D[2026-03-29]
    assert Enum.at(days, 6) == ~D[2026-04-04]
    assert List.last(days) == ~D[2026-05-02]
  end

  test "weekday_labels/1 starts from sunday" do
    assert I18n.weekday_labels("en") == ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    assert I18n.weekday_labels("zh") == ["日", "一", "二", "三", "四", "五", "六"]
  end

  test "root layout includes browser icon links" do
    html =
      render_component(&Layouts.root/1,
        flash: %{},
        page_title: "Daily note",
        inner_content: "content"
      )

    assert html =~ ~s(<meta name="color-scheme" content="light dark")
    assert html =~ ~s(<meta name="theme-color" content="#f4f0e7")
    assert html =~ ~s(rel="icon" type="image/svg+xml")
    assert html =~ ~s(href="/favicon.svg")
    assert html =~ ~s(rel="icon" sizes="any")
    assert html =~ ~s(href="/favicon.ico")
    assert html =~ ~s(rel="apple-touch-icon")
    assert html =~ ~s(href="/apple-touch-icon.png")
    assert html =~ ~s(rel="manifest")
    assert html =~ ~s(href="/site.webmanifest")
  end
end
