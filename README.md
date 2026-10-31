# GNN-Based Cyber Threat Intelligence Analysis

A knowledge graph of threat indicators (IP addresses, domains, URLs, malware hashes)
built from public threat feeds, with a feature-only baseline and a Graph Neural Network
for threat entity classification and suspicious relationship prediction.

## Status

- [x] Project structure
- [ ] Data ingestion (abuse.ch URLhaus)
- [x] Knowledge graph construction (URL → domain/IP hosted_on edges)
- [x] Feature-only baseline (Random Forest, URL features; run with python -m src.models.baseline)
- [ ] GNN model (GraphSAGE / R-GCN)
- [ ] Evaluation (temporal split, PR-AUC)
- [ ] Explainability and demo app

## Setup

```bash
conda create -n gnn-cti python=3.11 -y
conda activate gnn-cti
pip install -r requirements.txt
```

## Layout

```
data/raw/        downloaded feeds (timestamped, not committed)
data/processed/  normalized tables and graph files
src/ingest/      feed download and parsing
src/graph/       knowledge graph construction
src/models/      baseline and GNN models
src/evaluation/  metrics and splits
app/             Streamlit demo
tests/           unit tests
```

## Data sources and licensing

Feeds are downloaded from their public endpoints. Check each provider's terms before
redistributing data. Raw malicious URLs and samples are not included in this repository.

## Limitations

Threat feeds contain false positives and stale labels. Results depend on feed quality and
collection date.
