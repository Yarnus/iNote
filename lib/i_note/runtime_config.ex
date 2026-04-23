defmodule INote.RuntimeConfig do
  @moduledoc false

  def parse_bind_ip!(nil), do: parse_bind_ip!("127.0.0.1")

  def parse_bind_ip!(value) when is_binary(value) do
    case String.trim(value) do
      "127.0.0.1" -> {127, 0, 0, 1}
      "0.0.0.0" -> {0, 0, 0, 0}
      "::1" -> {0, 0, 0, 0, 0, 0, 0, 1}
      "::" -> {0, 0, 0, 0, 0, 0, 0, 0}
      invalid -> raise ArgumentError, "unsupported INOTE_BIND_IP value: #{inspect(invalid)}"
    end
  end
end
