defmodule INote.Notes.MarkdownIndex do
  @moduledoc false

  @todo_pattern ~r/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/u
  @tag_pattern ~r/(?:^|[\s\(\[{])#([\p{L}\p{N}_-]+)/u
  @heading_pattern ~r/^\s{0,3}\#{1,6}\s+(.+)$/um

  def extract_tags(markdown) when is_binary(markdown) do
    stripped = strip_fenced_code(markdown)

    Regex.scan(@tag_pattern, stripped, capture: :all_but_first)
    |> List.flatten()
    |> Enum.map(&normalize_tag/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.uniq()
  end

  def extract_tags(_value), do: []

  def extract_todos(markdown) when is_binary(markdown) do
    markdown
    |> String.split("\n")
    |> Enum.with_index(1)
    |> Enum.reduce([], fn {line, line_no}, acc ->
      case Regex.run(@todo_pattern, line) do
        [_, marker, text] ->
          trimmed = String.trim(text)

          if trimmed == "" do
            acc
          else
            [%{line_no: line_no, text: trimmed, is_done: String.downcase(marker) == "x"} | acc]
          end

        _ ->
          acc
      end
    end)
    |> Enum.reverse()
  end

  def extract_todos(_value), do: []

  def suggested_title(markdown, note_date) do
    markdown
    |> extract_heading()
    |> case do
      nil ->
        markdown
        |> first_text_line()
        |> fallback_title(note_date)

      heading ->
        heading
    end
  end

  def default_title(%Date{} = date), do: Date.to_iso8601(date)

  defp extract_heading(markdown) do
    case Regex.run(@heading_pattern, markdown, capture: :all_but_first) do
      [heading] -> sanitize_title(heading)
      _ -> nil
    end
  end

  defp first_text_line(markdown) do
    markdown
    |> String.split("\n")
    |> Enum.map(&String.trim/1)
    |> Enum.find(fn line -> line != "" end)
    |> sanitize_title()
  end

  defp fallback_title(nil, note_date), do: default_title(note_date)
  defp fallback_title("", note_date), do: default_title(note_date)
  defp fallback_title(text, _note_date), do: text

  defp sanitize_title(nil), do: nil

  defp sanitize_title(value) do
    value
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
    |> String.trim_trailing("#")
    |> String.trim()
    |> String.slice(0, 120)
    |> case do
      "" -> nil
      title -> title
    end
  end

  defp normalize_tag(tag) do
    tag
    |> String.trim()
    |> String.trim_leading("#")
    |> String.downcase()
    |> String.slice(0, 64)
  end

  defp strip_fenced_code(markdown) do
    markdown
    |> String.split("\n")
    |> Enum.reduce({[], false}, fn line, {acc, in_code?} ->
      trimmed = String.trim_leading(line)

      cond do
        String.starts_with?(trimmed, "```") ->
          {acc, not in_code?}

        in_code? ->
          {acc, in_code?}

        true ->
          {[line | acc], in_code?}
      end
    end)
    |> elem(0)
    |> Enum.reverse()
    |> Enum.join("\n")
  end
end
