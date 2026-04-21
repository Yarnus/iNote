defmodule INoteWeb.MonthlyReportLive.Show do
  use INoteWeb, :live_view

  alias INote.Notes

  @impl true
  def mount(_params, _session, socket) do
    today = Notes.today()
    month_start = Date.beginning_of_month(today)

    {:ok,
     assign(socket,
       current_section: nil,
       current_path: ~p"/reports/monthly/#{Date.to_iso8601(month_start)}",
       page_title: "Monthly report",
       search_query: "",
       selected_date: month_start,
       calendar_note_dates: Notes.list_dates_with_daily_notes(month_start),
       month_start: month_start,
       report_weeks: [],
       report_markdown: ""
     )}
  end

  @impl true
  def handle_params(%{"month" => raw_month}, _url, socket) do
    case Notes.parse_date(raw_month) do
      {:ok, date} ->
        month_start = Date.beginning_of_month(date)
        report = Notes.list_monthly_report_weeks(month_start)
        locale = socket.assigns.locale

        {:noreply,
         assign(socket,
           current_path: ~p"/reports/monthly/#{Date.to_iso8601(month_start)}",
           page_title: t(locale, :monthly_report_title),
           selected_date: month_start,
           calendar_note_dates: Notes.list_dates_with_daily_notes(month_start),
           month_start: month_start,
           report_weeks: report.weeks,
           report_markdown: format_report(locale, report)
         )}

      _ ->
        today_month = Notes.today() |> Date.beginning_of_month() |> Date.to_iso8601()
        {:noreply, push_navigate(socket, to: ~p"/reports/monthly/#{today_month}")}
    end
  end

  defp format_report(locale, %{month_start: month_start, weeks: weeks}) do
    case weeks do
      [] ->
        ""

      _ ->
        body = Enum.map(weeks, &format_week(locale, &1))
        Enum.join(["# #{report_title_line(locale, month_start)}" | body], "\n\n")
    end
  end

  defp format_week(locale, %{
         index: index,
         start_date: start_date,
         end_date: end_date,
         items: items
       }) do
    lines = Enum.map(items, &format_item/1)

    Enum.join(
      [
        "## #{week_heading(locale, index, start_date, end_date)}"
        | lines
      ],
      "\n"
    )
  end

  defp format_item(%{text: text}), do: "- #{text}"

  defp report_title_line("zh", month_start),
    do: "#{Calendar.strftime(month_start, "%Y年%m月")}#{t("zh", :monthly_report_title)}"

  defp report_title_line(_locale, month_start),
    do: "#{Calendar.strftime(month_start, "%Y-%m")} #{t("en", :monthly_report_title)}"

  defp week_heading("zh", index, start_date, end_date),
    do: "第#{index}周 (#{short_date(start_date)}-#{short_date(end_date)})"

  defp week_heading(_locale, index, start_date, end_date),
    do: "Week #{index} (#{short_date(start_date)}-#{short_date(end_date)})"

  defp short_date(date), do: Calendar.strftime(date, "%m/%d")
end
