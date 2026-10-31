from pathlib import Path

from src.ingest.urlhaus import parse_feed


def test_parse_feed_skips_comments(tmp_path: Path):
    sample = tmp_path / "sample.csv"
    sample.write_text(
        "# comment line\n"
        "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter\n"
        '1,2026-10-30 10:00:00,http://evil.example/a.exe,online,,malware_download,"exe",link,r1\n',
        encoding="utf-8",
    )
    rows = parse_feed(sample)
    assert len(rows) == 1
    assert rows[0]["url"] == "http://evil.example/a.exe"
    assert rows[0]["threat"] == "malware_download"
