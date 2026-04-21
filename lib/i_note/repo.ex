defmodule INote.Repo do
  use Ecto.Repo,
    otp_app: :i_note,
    adapter: Ecto.Adapters.SQLite3
end
