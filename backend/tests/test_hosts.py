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


# Cross-site writes (see hosts.py): a page on another site can't change anything.

EVIL = {"Origin": "https://evil.example"}


@pytest.mark.parametrize("path", ["/api/update/install", "/api/backup"])
def test_writes_from_another_site_are_refused(client, path):
    response = client.post(path, headers=EVIL, json={})
    assert response.status_code == 403
    assert client.post(path, headers={"Origin": "null"}, json={}).status_code == 403
    assert client.post(path, headers={"Sec-Fetch-Site": "cross-site"}, json={}).status_code == 403


def test_own_dev_and_headerless_writes_pass(client):
    body = {"name": "Main", "class_name": "Bard"}
    # The app's own origin (TestClient talks to http://127.0.0.1, port 80).
    assert client.post("/api/characters", json=body, headers={"Origin": "http://127.0.0.1"}).status_code == 201
    assert client.post("/api/characters", json={**body, "name": "Dev"}, headers={"Origin": "http://localhost:3000"}).status_code == 201
    assert client.post("/api/characters", json={**body, "name": "Fetch"}, headers={"Sec-Fetch-Site": "same-origin"}).status_code == 201
    assert client.post("/api/characters", json={**body, "name": "Curl"}).status_code == 201
    # Another local port that isn't the app or a dev server, and reads from anywhere, behave as before.
    assert client.post("/api/characters", json={**body, "name": "X"}, headers={"Origin": "http://127.0.0.1:9999"}).status_code == 403
    assert client.get("/api/characters", headers=EVIL).status_code == 200


def test_origin_rules():
    from hosts import is_allowed_origin

    assert is_allowed_origin("http://127.0.0.1:8777", "127.0.0.1:8777")
    assert is_allowed_origin("http://[::1]:8777", "[::1]:8777")
    assert is_allowed_origin("http://localhost:3000", "127.0.0.1:8777")
    assert not is_allowed_origin("http://127.0.0.1:8778", "127.0.0.1:8777")
    assert not is_allowed_origin("http://localhost.evil.example:8777", "127.0.0.1:8777")
    assert not is_allowed_origin("file://", "127.0.0.1:8777")
