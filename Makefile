.PHONY: setup reset test assets release run dev

setup:
	mix setup

reset:
	mix ecto.reset

test:
	mix test

assets:
	mix assets.build

release:
	MIX_ENV=prod mix deps.get
	MIX_ENV=prod mix assets.deploy
	MIX_ENV=prod mix release --overwrite

run:
	iex -S mix phx.server

dev: run
