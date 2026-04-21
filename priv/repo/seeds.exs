alias INote.Notes
alias INote.Repo

Repo.delete_all("note_todos")
Repo.delete_all("note_tags")
Repo.delete_all("notes_fts")
Repo.delete_all("notes")

today = Date.utc_today()

daily_samples = [
  %{
    date: Date.add(today, -1),
    title: "Daily review",
    content_md: """
    # Daily review

    Yesterday was focused on #ProjectA planning.

    - [x] Finish weekly summary
    - [ ] Prepare agenda for #Meeting
    """
  },
  %{
    date: today,
    title: "Today",
    content_md: """
    # Today

    Notes for #ProjectA and #DeepWork.

    - [ ] Draft architecture notes
    - [ ] Reply to partner updates
    - [x] Organize inbox
    """
  },
  %{
    date: Date.add(today, 1),
    title: "Tomorrow prep",
    content_md: """
    # Tomorrow prep

    Keep momentum on #ProjectB.

    - [ ] Finalize proposal outline
    - [ ] Share summary in #Meeting
    """
  }
]

Enum.each(daily_samples, fn %{date: date, title: title, content_md: content_md} ->
  note = Notes.get_or_create_daily_note!(date)
  {:ok, _saved} = Notes.update_note(note, %{title: title, content_md: content_md})
end)

{:ok, requirement_note} = Notes.create_note(%{title: "Search redesign requirements"})

{:ok, _saved} =
  Notes.update_note(requirement_note, %{
    content_md: """
    # Search redesign requirements

    - [ ] Define search facets
    - [ ] Validate empty-state copy

    Track decisions with #Product and #Search.
    """
  })

IO.puts("Seeded daily notes, general notes, tags, TODO metadata, and FTS index.")
