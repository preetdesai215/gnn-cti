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
- [x] Frontend dashboard (React, simulated data); backend still to do
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

## Web dashboard (frontend)

A React dashboard in `web/` presents the project. All data is simulated: indicators use reserved
names (`.example`, `.test`, `.invalid`) and documentation IP ranges, and each page is labeled as
demo data. Pages: landing, dashboard, interactive graph, indicator analysis, GNN model, alerts,
reports (print to PDF), and about.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in web/dist
```

Data access goes through `web/src/api/client.js`. Replace the simulated functions there with
calls to the FastAPI backend once it exists.

## Daily automation

`scripts/daily_update.sh` downloads the URLhaus feed, adds new URLs to the history, and reruns
the evaluation. It only changes the history if the download succeeds.

Setup (once), in WSL:

```bash
echo 'URLHAUS_FEED_URL="https://urlhaus-api.abuse.ch/v2/files/exports/YOUR-KEY/recent.csv"' > ~/.gnn-cti.env
chmod 600 ~/.gnn-cti.env
chmod +x ~/projects/gnn-cti/scripts/daily_update.sh
~/projects/gnn-cti/scripts/daily_update.sh      # run once by hand to test
```

Logs go to `data/processed/logs/daily_YYYYMMDD.log`. The key is kept in `~/.gnn-cti.env`, outside the project.

Scheduling options:

- **Windows Task Scheduler (recommended, runs when the PC is on):** create a daily task that runs
  `wsl.exe -d Ubuntu -- /home/YOURNAME/projects/gnn-cti/scripts/daily_update.sh`.
- **cron inside WSL:** `sudo apt install -y cron && sudo service cron start`, then `crontab -e` and add
  `0 8 * * * /home/YOURNAME/projects/gnn-cti/scripts/daily_update.sh`. Cron only runs while WSL is running.
