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
    assert Enum.all?(open_todos, &(not Map.has_key?(&1, :line_no)))
    assert Enum.all?(done_todos, &(not Map.has_key?(&1, :line_no)))
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

  test "list_daily_notes_in_range/2 returns only daily notes in ascending date order" do
    april_second = Notes.get_or_create_daily_note!(~D[2026-04-02])
    april_fourth = Notes.get_or_create_daily_note!(~D[2026-04-04])
    _april_sixth = Notes.get_or_create_daily_note!(~D[2026-04-06])
    {:ok, normal_note} = Notes.create_note(%{title: "Normal note in range"})

    notes = Notes.list_daily_notes_in_range(~D[2026-04-02], ~D[2026-04-05])

    assert Enum.map(notes, & &1.note_date) == [~D[2026-04-02], ~D[2026-04-04]]
    assert Enum.all?(notes, &(&1.kind == :daily))
    refute Enum.any?(notes, &(&1.id == normal_note.id))
    assert Enum.any?(notes, &(&1.id == april_second.id))
    assert Enum.any?(notes, &(&1.id == april_fourth.id))
  end

  test "list_daily_notes_in_range/2 returns an empty list when start_date is after end_date" do
    assert Notes.list_daily_notes_in_range(~D[2026-04-10], ~D[2026-04-09]) == []
  end

  test "list_monthly_report_weeks/1 groups daily note checkboxes by report week" do
    april_first = Notes.get_or_create_daily_note!(~D[2026-04-01])
    april_third = Notes.get_or_create_daily_note!(~D[2026-04-03])
    april_fourth = Notes.get_or_create_daily_note!(~D[2026-04-04])
    april_sixth = Notes.get_or_create_daily_note!(~D[2026-04-06])
    april_tenth = Notes.get_or_create_daily_note!(~D[2026-04-10])
    april_thirtieth = Notes.get_or_create_daily_note!(~D[2026-04-30])
    {:ok, normal_note} = Notes.create_note(%{title: "Ignore normal notes"})

    {:ok, _} =
      Notes.update_note(april_first, %{
        content_md: """
        Planning
        - [ ] Draft monthly goals
        random text
        """
      })

    {:ok, _} =
      Notes.update_note(april_third, %{
        content_md: """
        - [x] Finish kickoff
        """
      })

    {:ok, _} =
      Notes.update_note(april_fourth, %{
        content_md: """
        - [ ] Review launch checklist
        """
      })

    {:ok, _} =
      Notes.update_note(april_sixth, %{
        content_md: """
        - [ ] Review launch checklist
        """
      })

    {:ok, _} =
      Notes.update_note(april_tenth, %{
        content_md: """
        - [x] Ship iteration one
        """
      })

    {:ok, _} =
      Notes.update_note(april_thirtieth, %{
        content_md: """
        Notes only
        - [] invalid checkbox
        - [ ] Wrap up release
        """
      })

    {:ok, _} =
      Notes.update_note(normal_note, %{
        content_md: """
        - [x] This should not appear
        """
      })

    report = Notes.list_monthly_report_weeks(~D[2026-04-18])

    assert report.month_start == ~D[2026-04-01]
    assert report.month_end == ~D[2026-04-30]

    assert report.weeks == [
             %{
               index: 1,
               start_date: ~D[2026-04-01],
               end_date: ~D[2026-04-03],
               items: [
                 %{
                   note_date: ~D[2026-04-01],
                   text: "Draft monthly goals",
                   is_done: false
                 },
                 %{note_date: ~D[2026-04-03], text: "Finish kickoff", is_done: true}
               ]
             },
             %{
               index: 2,
               start_date: ~D[2026-04-06],
               end_date: ~D[2026-04-10],
               items: [
                 %{
                   note_date: ~D[2026-04-06],
                   text: "Review launch checklist",
                   is_done: false
                 },
                 %{
                   note_date: ~D[2026-04-10],
                   text: "Ship iteration one",
                   is_done: true
                 }
               ]
             },
             %{
               index: 5,
               start_date: ~D[2026-04-27],
               end_date: ~D[2026-04-30],
               items: [
                 %{note_date: ~D[2026-04-30], text: "Wrap up release", is_done: false}
               ]
             }
           ]
  end

  test "list_monthly_report_weeks/1 treats friday as a one-day first week when month starts on friday" do
    first_day = Notes.get_or_create_daily_note!(~D[2026-05-01])
    second_day = Notes.get_or_create_daily_note!(~D[2026-05-02])
    eighth_day = Notes.get_or_create_daily_note!(~D[2026-05-08])

    {:ok, _} = Notes.update_note(first_day, %{content_md: "- [x] Close April"})
    {:ok, _} = Notes.update_note(second_day, %{content_md: "- [ ] Start May sprint"})
    {:ok, _} = Notes.update_note(eighth_day, %{content_md: "- [x] Demo sprint progress"})

    report = Notes.list_monthly_report_weeks(~D[2026-05-15])

    assert Enum.map(report.weeks, &{&1.index, &1.start_date, &1.end_date}) == [
             {1, ~D[2026-05-01], ~D[2026-05-01]},
             {2, ~D[2026-05-04], ~D[2026-05-08]}
           ]

    assert Enum.flat_map(report.weeks, & &1.items) == [
             %{note_date: ~D[2026-05-01], text: "Close April", is_done: true},
             %{
               note_date: ~D[2026-05-08],
               text: "Demo sprint progress",
               is_done: true
             }
           ]
  end
end
