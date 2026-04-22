defmodule INoteWeb.Layouts do
  use INoteWeb, :html

  embed_templates "layouts/*"

  def calendar_days(%Date{} = month_start) do
    month_start = Date.beginning_of_month(month_start)
    month_end = Date.end_of_month(month_start)

    grid_start = Date.add(month_start, -day_offset_from_sunday(month_start))
    grid_end = Date.add(month_end, 6 - day_offset_from_sunday(month_end))

    Date.range(grid_start, grid_end) |> Enum.to_list()
  end

  def weekday_label_class(0), do: ["mini-calendar__weekday", "is-sunday"]
  def weekday_label_class(6), do: ["mini-calendar__weekday", "is-saturday"]
  def weekday_label_class(_index), do: "mini-calendar__weekday"

  def weekend_class(%Date{} = date) do
    case Date.day_of_week(date) do
      6 -> "is-saturday"
      7 -> "is-sunday"
      _ -> nil
    end
  end

  defp day_offset_from_sunday(%Date{} = date), do: rem(Date.day_of_week(date), 7)

  def nav_item_class(current_section, section) do
    ["sidebar-nav__item", current_section == section && "is-active"]
  end

  def locale_item_class(current_locale, locale) do
    ["locale-switcher__item", current_locale == locale && "is-active"]
  end
end
