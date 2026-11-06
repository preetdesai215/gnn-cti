from src.ingest.phishing import add_urls, load_history, parse_lines
from src.models.phish_eval import split_platform


def test_parse_lines_keeps_only_http_urls():
    text = "https://a.example.com/x\n\nnot a url\nhttp://b.example.org/\n  https://c.example.net/p  \nhttps://bad url.example/\n"
    assert parse_lines(text) == ["https://a.example.com/x", "http://b.example.org/", "https://c.example.net/p"]


def test_add_urls_skips_duplicates_and_keeps_first_day(tmp_path):
    path = tmp_path / "phish_history.csv"
    first = add_urls(["https://a.example.com/x", "https://b.example.com/y"], "2026-11-01", path)
    second = add_urls(["https://b.example.com/y", "https://c.example.com/z", "https://c.example.com/z"],
                      "2026-11-02", path)
    assert first["new_urls"] == 2
    assert second["new_urls"] == 1
    rows = load_history(path)
    assert len(rows) == 3
    by_url = {r["url"]: r["collected_on"] for r in rows}
    assert by_url["https://b.example.com/y"] == "2026-11-01"
    assert by_url["https://c.example.com/z"] == "2026-11-02"


def test_split_platform_separates_free_hosts():
    records = [
        {"url": "https://login.netlify.app/verify"},
        {"url": "https://secure.paypal-demo.example.com/x"},
        {"url": "https://my-site.vercel.app/a"},
    ]
    platform, other = split_platform(records)
    assert [r["url"] for r in platform] == [
        "https://login.netlify.app/verify", "https://my-site.vercel.app/a",
    ]
    assert [r["url"] for r in other] == ["https://secure.paypal-demo.example.com/x"]
