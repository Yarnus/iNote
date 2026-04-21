defmodule INote.Repo.Migrations.CreateSearchEntries do
  use Ecto.Migration

  def up do
    execute("""
    CREATE VIRTUAL TABLE search_entries
    USING fts5(
      entry_type UNINDEXED,
      entry_id UNINDEXED,
      title,
      content
    )
    """)
  end

  def down do
    execute("DROP TABLE search_entries")
  end
end
