defmodule INote.RuntimeConfigTest do
  use ExUnit.Case, async: true

  alias INote.RuntimeConfig

  test "defaults to IPv4 loopback" do
    assert RuntimeConfig.parse_bind_ip!(nil) == {127, 0, 0, 1}
  end

  test "parses supported bind addresses" do
    assert RuntimeConfig.parse_bind_ip!("127.0.0.1") == {127, 0, 0, 1}
    assert RuntimeConfig.parse_bind_ip!("0.0.0.0") == {0, 0, 0, 0}
    assert RuntimeConfig.parse_bind_ip!("::1") == {0, 0, 0, 0, 0, 0, 0, 1}
    assert RuntimeConfig.parse_bind_ip!("::") == {0, 0, 0, 0, 0, 0, 0, 0}
  end

  test "rejects unsupported bind addresses" do
    assert_raise ArgumentError, ~r/unsupported INOTE_BIND_IP value/, fn ->
      RuntimeConfig.parse_bind_ip!("192.168.1.10")
    end
  end
end
