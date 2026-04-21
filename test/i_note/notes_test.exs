defmodule INote.NotesTest do
  use INote.DataCase

  alias INote.Notes

  test "get_or_create_daily_note!/1 keeps one note per date" do
    date = ~D[2026-04-21]

    first = Notes.get_or_create_daily_note!(date)
    second = Notes.get_or_create_daily_note!(date)

    assert first.id == second.id
    assert first.note_date == date
    assert first.kind == :daily
  end

  test "create_note/0 creates a normal note with a temporary title" do
    assert {:ok, note} = Notes.create_note()
    assert note.kind == :normal
    assert note.note_date == nil
    assert String.starts_with?(note.title, "Untitled ")
  end

  test "create_note/1 creates a normal note with a required title" do
    assert {:error, changeset} = Notes.create_note(%{title: "   "})
    assert "can't be blank" in errors_on(changeset).title

    assert {:ok, note} = Notes.create_note(%{title: "Product requirements"})
    assert note.kind == :normal
    assert note.note_date == nil
    assert note.title == "Product requirements"
  end

  test "list_notes/1 filters by query and sorts results" do
    {:ok, alpha} = Notes.create_note(%{title: "Alpha spec", content_md: "Milestone B"})
    {:ok, beta} = Notes.create_note(%{title: "Beta spec", content_md: "Contains alpha details"})

    by_query = Notes.list_notes(query: "alpha")
    assert Enum.map(by_query, & &1.id) == [beta.id, alpha.id]

    by_title = Notes.list_notes(sort: :title_asc)
    assert Enum.map(by_title, & &1.title) |> Enum.take(2) == ["Alpha spec", "Beta spec"]
  end

  test "delete_note/1 removes a normal note" do
    {:ok, note} = Notes.create_note(%{title: "Disposable"})

    assert {:ok, _deleted_note} = Notes.delete_note(note)
    assert Notes.get_note(note.id) == nil
  end

  test "update_note/2 syncs tags and todos metadata for normal notes" do
    assert {:ok, note} = Notes.create_note(%{title: "Work"})

    markdown = """
    # Work

    - [ ] Ship demo
    - [x] Write summary

    Discuss with #ProjectA and #Meeting.
    """

    assert {:ok, saved} = Notes.update_note(note, %{content_md: markdown})
    assert saved.title == "Work"

    tags = Notes.list_tags("project")
    assert Enum.any?(tags, &(&1.tag == "projecta"))

    open_todos = Notes.list_todos(:open)
    done_todos = Notes.list_todos(:done)

    assert Enum.any?(open_todos, &(&1.text == "Ship demo" and &1.note_kind == :normal))
    assert Enum.any?(done_todos, &(&1.text == "Write summary" and &1.note_kind == :normal))
  end

  test "search_notes/1 ranks title matches before content matches across note kinds" do
    title_note = Notes.get_or_create_daily_note!(~D[2026-04-23])
    assert {:ok, body_note} = Notes.create_note(%{title: "Meeting"})

    {:ok, _} =
      Notes.update_note(title_note, %{
        title: "Alpha roadmap",
        content_md: "General notes"
      })

    {:ok, _} =
      Notes.update_note(body_note, %{
        title: "Meeting",
        content_md: "Contains Alpha in paragraph"
      })

    [first | rest] = Notes.search_notes("alpha")
    assert first.id == title_note.id
    assert Enum.any?(rest, &(&1.id == body_note.id and &1.kind == :normal))
  end

  test "list_dates_with_daily_notes/1 only returns daily note dates" do
    daily = Notes.get_or_create_daily_note!(~D[2026-04-25])
    {:ok, _note} = Notes.create_note(%{title: "Standalone requirement"})

    dates = Notes.list_dates_with_daily_notes(~D[2026-04-01])

    assert daily.note_date in dates
  end
end
