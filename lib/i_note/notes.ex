defmodule INote.Notes do
  @moduledoc """
  The notes context for daily and general markdown notes.
  """

  import Ecto.Query, warn: false
  alias Ecto.Multi
  alias INote.Notes.{MarkdownIndex, Note, NoteTag, NoteTodo}
  alias INote.Repo

  def get_or_create_daily_note!(%Date{} = date) do
    case get_daily_note_by_date(date) do
      nil ->
        case create_daily_note(date) do
          {:ok, note} ->
            note

          {:error, %Ecto.Changeset{} = changeset} ->
            if Keyword.has_key?(changeset.errors, :note_date) do
              get_daily_note_by_date!(date)
            else
              raise Ecto.InvalidChangesetError, action: :insert, changeset: changeset
            end

          {:error, reason} ->
            raise "unable to create daily note for #{Date.to_iso8601(date)}: #{inspect(reason)}"
        end

      note ->
        note
    end
  end

  def get_note!(id), do: Repo.get!(Note, id)
  def get_note(id), do: Repo.get(Note, id)

  def get_daily_note_by_date(%Date{} = date), do: Repo.get_by(Note, kind: :daily, note_date: date)

  def get_daily_note_by_date!(%Date{} = date),
    do: Repo.get_by!(Note, kind: :daily, note_date: date)

  def create_daily_note(%Date{} = date) do
    attrs = %{
      kind: :daily,
      note_date: date,
      title: MarkdownIndex.default_title(date),
      content_md: ""
    }

    %Note{}
    |> Note.changeset(attrs)
    |> insert_and_sync()
  end

  def create_note, do: create_note(%{title: default_new_note_title()})

  def create_note(attrs) when is_map(attrs) do
    attrs =
      attrs
      |> normalize_attrs_map()
      |> Map.put(:kind, :normal)
      |> Map.put(
        :content_md,
        normalize_markdown(Map.get(attrs, "content_md", Map.get(attrs, :content_md, "")))
      )

    %Note{}
    |> Note.changeset(attrs)
    |> insert_and_sync()
  end

  def update_daily_note(%Note{} = note, attrs) when is_map(attrs), do: update_note(note, attrs)

  def update_note(%Note{} = note, attrs) when is_map(attrs) do
    normalized_attrs = normalize_note_attrs(note, attrs)

    Multi.new()
    |> Multi.update(:note, Note.changeset(note, normalized_attrs))
    |> Multi.run(:index, fn repo, %{note: saved_note} -> sync_derived_data(repo, saved_note) end)
    |> Repo.transaction()
    |> case do
      {:ok, %{note: saved_note}} -> {:ok, saved_note}
      {:error, :note, changeset, _changes} -> {:error, changeset}
      {:error, :index, reason, _changes} -> {:error, reason}
    end
  end

  def delete_note(%Note{} = note) do
    Multi.new()
    |> Multi.delete(:note, note)
    |> Multi.run(:fts, fn repo, %{note: deleted_note} ->
      repo.query("DELETE FROM notes_fts WHERE rowid = ?", [deleted_note.id])
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{note: deleted_note}} -> {:ok, deleted_note}
      {:error, :note, changeset, _changes} -> {:error, changeset}
      {:error, :fts, reason, _changes} -> {:error, reason}
    end
  end

  def list_notes(opts \\ []) do
    kind = Keyword.get(opts, :kind, :normal)
    limit = Keyword.get(opts, :limit, 100)
    query = normalize_filter_query(Keyword.get(opts, :query, ""))
    sort = normalize_note_sort(Keyword.get(opts, :sort, :updated_desc))

    Note
    |> where([note], note.kind == ^kind)
    |> maybe_filter_notes(query)
    |> order_notes(sort)
    |> limit(^limit)
    |> Repo.all()
  end

  def list_dates_with_daily_notes(%Date{} = month_start) do
    month_start = Date.beginning_of_month(month_start)
    next_month_start = month_start |> Date.add(32) |> Date.beginning_of_month()

    Repo.all(
      from note in Note,
        where:
          note.kind == :daily and note.note_date >= ^month_start and
            note.note_date < ^next_month_start,
        select: note.note_date
    )
  end

  def list_dates_with_notes(%Date{} = month_start), do: list_dates_with_daily_notes(month_start)

  def search_notes(query) when query in [nil, ""], do: []

  def search_notes(query) do
    query = String.trim(query)

    if query == "" do
      []
    else
      search_notes_fts(query)
    end
  end

  def list_todos(filter \\ :all) do
    filter = normalize_todo_filter(filter)

    NoteTodo
    |> join(:inner, [todo], note in assoc(todo, :note))
    |> maybe_filter_todos(filter)
    |> order_by([todo, note], desc: note.updated_at, asc: todo.line_no, asc: todo.id)
    |> select([todo, note], %{
      id: todo.id,
      text: todo.text,
      is_done: todo.is_done,
      line_no: todo.line_no,
      note_id: note.id,
      note_kind: note.kind,
      note_date: note.note_date,
      note_title: note.title
    })
    |> Repo.all()
  end

  def count_todos(filter \\ :all) do
    filter = normalize_todo_filter(filter)

    NoteTodo
    |> maybe_filter_todos(filter)
    |> Repo.aggregate(:count, :id)
  end

  def list_tags(query \\ "") do
    query = normalize_tag(query)

    NoteTag
    |> maybe_filter_tags(query)
    |> group_by([tag], tag.tag)
    |> order_by([tag], asc: tag.tag)
    |> select([tag], %{tag: tag.tag, count: count(tag.id)})
    |> limit(120)
    |> Repo.all()
  end

  def list_notes_by_tag(tag) do
    tag = normalize_tag(tag)

    if tag == "" do
      []
    else
      Note
      |> join(:inner, [note], note_tag in assoc(note, :tags))
      |> where([_note, note_tag], note_tag.tag == ^tag)
      |> order_by([note, _note_tag], desc: note.updated_at)
      |> select([note, _note_tag], %{
        id: note.id,
        kind: note.kind,
        note_date: note.note_date,
        title: note.title
      })
      |> Repo.all()
    end
  end

  def today, do: Date.utc_today()

  def parse_date(nil), do: {:error, :invalid}
  def parse_date(date) when is_binary(date), do: Date.from_iso8601(date)
  def parse_date(%Date{} = date), do: {:ok, date}

  defp insert_and_sync(changeset) do
    Multi.new()
    |> Multi.insert(:note, changeset)
    |> Multi.run(:index, fn repo, %{note: note} -> sync_derived_data(repo, note) end)
    |> Repo.transaction()
    |> case do
      {:ok, %{note: note}} -> {:ok, note}
      {:error, :note, changeset, _changes} -> {:error, changeset}
      {:error, :index, reason, _changes} -> {:error, reason}
    end
  end

  defp normalize_note_attrs(note, attrs) do
    attrs = normalize_attrs_map(attrs)

    content_md =
      attrs
      |> Map.get(:content_md, note.content_md)
      |> normalize_markdown()

    title =
      attrs
      |> Map.get(:title, note.title)
      |> normalize_title()
      |> normalize_missing_title(note, content_md)

    %{
      kind: note.kind,
      note_date: note.note_date,
      title: title,
      content_md: content_md
    }
  end

  defp normalize_missing_title("", %Note{kind: :daily} = note, content_md),
    do: MarkdownIndex.suggested_title(content_md, note.note_date)

  defp normalize_missing_title(title, _note, _content_md), do: title

  defp sync_derived_data(repo, %Note{} = note) do
    now = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)

    tags =
      note.content_md
      |> MarkdownIndex.extract_tags()
      |> Enum.uniq()
      |> Enum.map(fn tag ->
        %{note_id: note.id, tag: tag, inserted_at: now, updated_at: now}
      end)

    todos =
      note.content_md
      |> MarkdownIndex.extract_todos()
      |> Enum.map(fn todo ->
        %{
          note_id: note.id,
          line_no: todo.line_no,
          text: todo.text,
          is_done: todo.is_done,
          inserted_at: now,
          updated_at: now
        }
      end)

    with {:ok, _} <-
           repo.query(
             "INSERT OR REPLACE INTO notes_fts (rowid, note_id, title, content_md) VALUES (?, ?, ?, ?)",
             [note.id, note.id, note.title, note.content_md]
           ) do
      repo.delete_all(from t in NoteTag, where: t.note_id == ^note.id)
      repo.delete_all(from t in NoteTodo, where: t.note_id == ^note.id)

      if tags != [] do
        repo.insert_all(NoteTag, tags)
      end

      if todos != [] do
        repo.insert_all(NoteTodo, todos)
      end

      {:ok, :synced}
    end
  end

  defp search_notes_fts(query) do
    match_query = build_match_query(query)

    if match_query == "" do
      []
    else
      sql = """
      SELECT notes.id, notes.kind, notes.note_date, notes.title,
             snippet(notes_fts, 2, '<mark>', '</mark>', '...', 12) AS snippet,
             CASE WHEN lower(notes.title) LIKE ? THEN 0 ELSE 1 END AS title_rank,
             bm25(notes_fts, 9.0, 1.0) AS score
      FROM notes_fts
      JOIN notes ON notes.id = notes_fts.note_id
      WHERE notes_fts MATCH ?
      ORDER BY title_rank ASC, score ASC, notes.updated_at DESC
      LIMIT 50
      """

      like_query = "%" <> String.downcase(query) <> "%"

      case Repo.query(sql, [like_query, match_query]) do
        {:ok, %{rows: rows}} ->
          Enum.map(rows, fn [id, kind, note_date, title, snippet, _title_rank, _score] ->
            %{
              id: id,
              kind: cast_kind(kind),
              note_date: cast_date(note_date),
              title: title,
              snippet: snippet || ""
            }
          end)

        {:error, _reason} ->
          []
      end
    end
  end

  defp normalize_attrs_map(attrs) do
    attrs
    |> Enum.into(%{}, fn {key, value} -> {normalize_key(key), value} end)
  end

  defp normalize_key(key) when is_atom(key), do: key
  defp normalize_key(key) when is_binary(key), do: String.to_existing_atom(key)

  defp maybe_filter_notes(query, ""), do: query

  defp maybe_filter_notes(query, term) do
    like_term = "%" <> term <> "%"

    where(
      query,
      [note],
      like(fragment("lower(?)", note.title), ^like_term) or
        like(fragment("lower(?)", note.content_md), ^like_term)
    )
  end

  defp order_notes(query, :updated_asc),
    do: order_by(query, [note], asc: note.updated_at, asc: note.id)

  defp order_notes(query, :title_asc),
    do: order_by(query, [note], asc: note.title, desc: note.updated_at)

  defp order_notes(query, :title_desc),
    do: order_by(query, [note], desc: note.title, desc: note.updated_at)

  defp order_notes(query, :updated_desc),
    do: order_by(query, [note], desc: note.updated_at, desc: note.id)

  defp maybe_filter_todos(query, :open), do: where(query, [todo], todo.is_done == false)
  defp maybe_filter_todos(query, :done), do: where(query, [todo], todo.is_done == true)
  defp maybe_filter_todos(query, :all), do: query

  defp maybe_filter_tags(query, ""), do: query

  defp maybe_filter_tags(query, term) do
    like_term = "%" <> term <> "%"
    where(query, [tag], like(tag.tag, ^like_term))
  end

  defp normalize_todo_filter(:open), do: :open
  defp normalize_todo_filter(:done), do: :done
  defp normalize_todo_filter("open"), do: :open
  defp normalize_todo_filter("done"), do: :done
  defp normalize_todo_filter(_filter), do: :all

  defp normalize_filter_query(query) when is_binary(query),
    do: query |> String.trim() |> String.downcase()

  defp normalize_filter_query(_), do: ""

  defp normalize_note_sort(:updated_asc), do: :updated_asc
  defp normalize_note_sort(:updated_desc), do: :updated_desc
  defp normalize_note_sort(:title_asc), do: :title_asc
  defp normalize_note_sort(:title_desc), do: :title_desc
  defp normalize_note_sort("updated_asc"), do: :updated_asc
  defp normalize_note_sort("title_asc"), do: :title_asc
  defp normalize_note_sort("title_desc"), do: :title_desc
  defp normalize_note_sort(_), do: :updated_desc

  defp normalize_tag(tag) when is_binary(tag), do: tag |> String.trim() |> String.downcase()
  defp normalize_tag(_value), do: ""

  defp normalize_title(value) when is_binary(value),
    do: value |> String.trim() |> String.slice(0, 120)

  defp normalize_title(value), do: value |> to_string() |> normalize_title()

  defp normalize_markdown(value) when is_binary(value), do: String.trim_trailing(value)
  defp normalize_markdown(_value), do: ""

  defp cast_kind(:daily), do: :daily
  defp cast_kind(:normal), do: :normal
  defp cast_kind("daily"), do: :daily
  defp cast_kind("normal"), do: :normal
  defp cast_kind(_value), do: :normal

  defp cast_date(%Date{} = date), do: date
  defp cast_date(nil), do: nil

  defp cast_date(date) when is_binary(date) do
    case Date.from_iso8601(date) do
      {:ok, parsed} -> parsed
      _ -> nil
    end
  end

  defp cast_date(_value), do: nil

  defp build_match_query(query) do
    Regex.scan(~r/[\p{L}\p{N}_-]+/u, query)
    |> List.flatten()
    |> Enum.take(10)
    |> Enum.map_join(" OR ", &"#{&1}*")
  end

  defp default_new_note_title do
    timestamp = NaiveDateTime.utc_now() |> NaiveDateTime.truncate(:second)
    "Untitled #{Calendar.strftime(timestamp, "%Y-%m-%d %H:%M")}"
  end
end
