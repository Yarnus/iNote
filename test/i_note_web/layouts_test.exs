defmodule INoteWeb.LayoutsTest do
  use ExUnit.Case, async: true

  alias INoteWeb.Layouts
  alias INoteWeb.I18n

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
end
