"""scripts/check_links.py: how link-check outcomes are classified (offline)."""

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "check_links.py"
spec = importlib.util.spec_from_file_location("check_links", SCRIPT)
check_links = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_links)

URL = "https://maxroll.gg/lost-ark"


@pytest.mark.parametrize(
    "status, final_url, error, expected",
    [
        (200, URL, None, "ok"),
        (200, "https://maxroll.gg/lost-ark/", None, "ok"),
        (301, "https://www.maxroll.gg/lost-ark", None, "ok"),
        (403, URL, None, "unverifiable"),
        (429, URL, None, "unverifiable"),
        (None, None, "timed out", "unverifiable"),
        (404, URL, None, "dead"),
        (410, URL, None, "dead"),
        (503, URL, None, "dead"),
        (None, None, "[Errno 11001] getaddrinfo failed", "dead"),
        (None, None, "[WinError 10061] connection refused", "dead"),
        # A lapsed domain that now redirects somewhere else still answers 200.
        (200, "https://sunwinpvc.com/", None, "moved"),
    ],
)
def test_classify(status, final_url, error, expected):
    assert check_links.classify(URL, status, final_url, error) == expected


def test_subdomains_of_the_same_site_are_not_moves():
    assert check_links.classify("https://meta-game.gg", 200, "https://lostark.meta-game.gg/") == "ok"


def test_report_lists_problems_and_unverifiable_links():
    results = [
        {"title": "Good", "url": URL, "status": 200, "final_url": URL, "error": None, "result": "ok"},
        {"title": "Gone", "url": "https://gone.example", "status": 404, "final_url": None, "error": None, "result": "dead"},
        {"title": "Wiki", "url": "https://wiki.example", "status": 403, "final_url": None, "error": None, "result": "unverifiable"},
    ]
    text = check_links.report(results)
    assert text.startswith("Checked 3 links: 1 need attention, 1 couldn't be verified.")
    assert "- **dead**: Gone (https://gone.example): HTTP 404" in text
    assert "- unverifiable: Wiki (https://wiki.example): HTTP 403" in text


def test_reads_the_built_in_links():
    links = check_links.load_links()
    assert links and all(link["url"].startswith("https://") for link in links)


def test_the_same_error_everywhere_is_a_local_problem():
    broken = [{"status": None, "error": "certificate store"}] * 3
    assert check_links.checker_broken(broken)
    assert not check_links.checker_broken([{"status": None, "error": "x"}, {"status": 200, "error": None}])
    assert not check_links.checker_broken([{"status": None, "error": "a"}, {"status": None, "error": "b"}])
