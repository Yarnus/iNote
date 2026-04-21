defmodule INoteWeb.Layouts do
  use INoteWeb, :html

  embed_templates "layouts/*"

  def calendar_days(%Date{} = month_start) do
    month_start = Date.beginning_of_month(month_start)
    month_end = Date.end_of_month(month_start)

    grid_start = Date.add(month_start, -(Date.day_of_week(month_start) - 1))
    grid_end = Date.add(month_end, 7 - Date.day_of_week(month_end))

    Date.range(grid_start, grid_end) |> Enum.to_list()
  end

  def note_exists?(note_dates, date), do: date in note_dates

  def nav_item_class(current_section, section) do
    ["sidebar-nav__item", current_section == section && "is-active"]
  end

  def locale_item_class(current_locale, locale) do
    ["locale-switcher__item", current_locale == locale && "is-active"]
  end
end
