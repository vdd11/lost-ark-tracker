"""Requests must be addressed to this computer (DNS rebinding protection)."""

import pytest
from fastapi.testclient import TestClient

import main
from hosts import host_name, is_allowed_host


@pytest.mark.parametrize(
    "header, name",
    [
        ("127.0.0.1:8777", "127.0.0.1"),
        ("localhost", "localhost"),
        ("LOCALHOST:3000", "localhost"),
        ("[::1]:8777", "::1"),
        ("[::1]", "::1"),
        ("evil.example:8777", "evil.example"),
        ("::1", "::1"),
    ],
)
def test_host_name_drops_the_port(header, name):
    assert host_name(header) == name


@pytest.mark.parametrize("header", ["127.0.0.1", "127.0.0.1:8777", "localhost:8000", "localhost.", "[::1]:8777"])
def test_loopback_hosts_are_allowed(header):
    assert is_allowed_host(header)


@pytest.mark.parametrize(
    "header", ["evil.example", "evil.example:8777", "127.0.0.1.evil.example", "localhost.evil.example", "", "[::1"]
)
def test_other_hosts_are_refused(header):
    assert not is_allowed_host(header)


def test_a_rebound_domain_gets_400(client):
    response = client.get("/api/characters", headers={"Host": "evil.example"})
    assert response.status_code == 400


def test_the_normal_host_works(client):
    assert client.get("/api/characters", headers={"Host": "127.0.0.1:8777"}).status_code == 200
    assert client.get("/api/characters", headers={"Host": "localhost:3000"}).status_code == 200


def test_the_test_client_default_host_is_refused():
    # TestClient's default "testserver" isn't loopback: proof the check is on.
    with TestClient(main.app) as other:
        assert other.get("/api/").status_code == 400
