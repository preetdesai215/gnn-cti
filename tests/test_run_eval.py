from src.models.run_eval import SHARED_HOSTING, split_platform


def test_split_platform_separates_shared_hosting():
    records = [
        {"url": "https://raw.githubusercontent.com/x/y/z.exe", "first_seen": ""},
        {"url": "https://evil-login.example.com/a", "first_seen": ""},
        {"url": "https://user.workers.dev/p", "first_seen": ""},
    ]
    platform, other = split_platform(records)
    assert len(platform) == 2
    assert len(other) == 1
    assert other[0]["url"].startswith("https://evil-login")


def test_shared_hosting_list_has_no_empty_entries():
    assert all(d and "." in d for d in SHARED_HOSTING)
