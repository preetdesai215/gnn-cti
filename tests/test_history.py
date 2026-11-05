from src.ingest.history import add_feed, load_history, merge_snapshot


def test_merge_keeps_first_seen_and_skips_duplicates():
    history = [{"url": "http://a.example/x", "first_seen": "2026-11-01 00:00:00",
                "threat": "t", "tags": "", "collected_on": "2026-11-01"}]
    snapshot = [
        {"url": "http://a.example/x", "first_seen": "2026-11-05 00:00:00", "threat": "t", "tags": ""},
        {"url": "http://b.example/y", "first_seen": "2026-11-05 00:00:00", "threat": "t", "tags": ""},
    ]
    merged, new = merge_snapshot(history, snapshot, "2026-11-05")
    assert new == 1
    assert len(merged) == 2
    assert merged[0]["first_seen"] == "2026-11-01 00:00:00"  # original kept
    assert merged[1]["collected_on"] == "2026-11-05"


def test_add_feed_round_trip(tmp_path):
    feed = tmp_path / "feed.csv"
    feed.write_text(
        "# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter\n"
        '1,2026-11-05 10:00:00,http://c.example/z,online,,malware_download,"exe",l,r\n',
        encoding="utf-8",
    )
    store = tmp_path / "history.csv"
    first = add_feed(feed, store)
    second = add_feed(feed, store)
    assert first["new_urls"] == 1
    assert second["new_urls"] == 0
    assert len(load_history(store)) == 1
