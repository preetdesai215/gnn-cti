from src.models.baseline import build_dataset, train_and_evaluate
from src.models.features import FEATURE_NAMES, url_features


def test_features_plain_domain():
    f = url_features("https://www.example.com/index.html?x=1")
    assert f["is_ip_host"] == 0
    assert f["uses_https"] == 1
    assert f["num_subdomains"] == 1  # www + example + com -> 1 extra label
    assert f["tld_length"] == 3


def test_features_ip_host():
    f = url_features("http://203.0.113.5:8080/a.exe")
    assert f["is_ip_host"] == 1
    assert f["num_subdomains"] == 0
    assert f["has_port"] == 1


def test_features_unparseable_returns_none():
    assert url_features("http://") is None


def test_build_dataset_is_temporal_for_malicious():
    mal = [{"url": f"http://bad{i}.example/x", "first_seen": f"2026-10-{i+1:02d} 00:00:00"}
           for i in range(10)]
    ben = [f"site{i}.example" for i in range(10)]
    df = build_dataset(mal, ben, test_fraction=0.2)
    mal_df = df[df["label"] == 1]
    # Every malicious training row must be older than every malicious test row.
    assert mal_df[mal_df["split"] == "train"]["first_seen"].max() < \
           mal_df[mal_df["split"] == "test"]["first_seen"].min()
    assert set(FEATURE_NAMES).issubset(df.columns)


def test_train_and_evaluate_runs():
    mal = [{"url": f"http://{'a1b2c3' * 3}{i}.xyz/login?id={i}", "first_seen": f"2026-10-{i+1:02d}"}
           for i in range(40)]
    ben = [f"site{i}.com" for i in range(40)]
    df = build_dataset(mal, ben)
    m = train_and_evaluate(df)
    assert m["n_train"] > 0 and m["n_test"] > 0
    assert 0.0 <= m["pr_auc"] <= 1.0


def test_host_only_features_exclude_path_and_scheme():
    from src.models.features import HOST_FEATURE_NAMES
    banned = {"path_length", "query_length", "uses_https", "url_length", "path_entropy",
              "num_dots", "num_special", "has_port"}
    assert set(HOST_FEATURE_NAMES).isdisjoint(banned)
    assert set(HOST_FEATURE_NAMES).issubset(FEATURE_NAMES)
