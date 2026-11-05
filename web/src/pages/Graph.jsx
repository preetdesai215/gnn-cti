import { useEffect, useMemo, useState } from "react";
import {
  Background, Controls, MiniMap, ReactFlow, useEdgesState, useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X } from "lucide-react";
import { getGraph } from "../api/client";
import { ENTITY_TYPES } from "../data/demo";
import {
  EntityBadge, ErrorBlock, LoadingBlock, PageHeader, SimulatedBanner, StatusBadge,
} from "../components/common";

// Column per entity type, so the graph reads left (actors) to right (IPs)
const COLUMN = { actor: 0, malware: 1, file: 2, url: 3, domain: 4, ip: 5 };
const STATUS_RING = { malicious: "#ff4d6d", suspicious: "#ff9f1c", benign: "#39ff88" };

function layout(nodes) {
  const rowCount = {};
  return nodes.map((n) => {
    const row = rowCount[n.type] || 0;
    rowCount[n.type] = row + 1;
    return { ...n, position: { x: COLUMN[n.type] * 240, y: row * 110 + (COLUMN[n.type] % 2) * 40 } };
  });
}

function toFlowNode(n) {
  const color = ENTITY_TYPES[n.type].color;
  return {
    id: n.id,
    position: n.position,
    data: {
      entity: n,
      label: (
        <div className="text-left">
          <p className="text-[10px] uppercase tracking-wider" style={{ color }}>{ENTITY_TYPES[n.type].label}</p>
          <p className="max-w-[180px] truncate font-mono text-xs text-slate-100">{n.value}</p>
          <p className="text-[11px] text-slate-400">risk {n.risk}</p>
        </div>
      ),
    },
    style: {
      background: "rgba(10,20,40,0.9)",
      color: "#e2e8f0",
      border: `1.5px solid ${STATUS_RING[n.status]}`,
      borderRadius: 14,
      padding: "8px 10px",
      boxShadow: n.status === "malicious" ? `0 0 18px -4px ${STATUS_RING[n.status]}` : `0 0 10px -6px ${color}`,
      width: 200,
    },
  };
}

export default function Graph() {
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [visibleTypes, setVisibleTypes] = useState(Object.keys(ENTITY_TYPES));
  const [minRisk, setMinRisk] = useState(0);
  const [selected, setSelected] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    getGraph().then(setGraph).catch((e) => setError(e.message));
  }, []);

  // Apply filters: type visibility and minimum risk. Edges are kept only if both ends are visible.
  useEffect(() => {
    if (!graph) return;
    const shown = graph.nodes.filter((n) => visibleTypes.includes(n.type) && n.risk >= minRisk);
    const shownIds = new Set(shown.map((n) => n.id));
    setNodes(layout(shown).map(toFlowNode));
    setEdges(
      graph.edges
        .filter((e) => shownIds.has(e.source) && shownIds.has(e.target))
        .map((e) => {
          const risky = graph.nodes.find((n) => n.id === e.source)?.status === "malicious" ||
            graph.nodes.find((n) => n.id === e.target)?.status === "malicious";
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.relation,
            animated: risky,
            labelStyle: { fill: "#94a3b8", fontSize: 10 },
            labelBgStyle: { fill: "#050b18" },
            style: { stroke: risky ? "#ff4d6d" : "#22d3ee", strokeWidth: risky ? 2 : 1.2, opacity: 0.8 },
          };
        })
    );
  }, [graph, visibleTypes, minRisk, setNodes, setEdges]);

  const selectedRelations = useMemo(() => {
    if (!selected || !graph) return [];
    return graph.edges
      .filter((e) => e.source === selected.id || e.target === selected.id)
      .map((e) => {
        const otherId = e.source === selected.id ? e.target : e.source;
        return { relation: e.relation, entity: graph.nodes.find((n) => n.id === otherId) };
      });
  }, [selected, graph]);

  const toggleType = (key) =>
    setVisibleTypes((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  if (error) return <ErrorBlock message={`Could not load graph: ${error}`} />;

  return (
    <>
      <PageHeader
        eyebrow="Graph visualization"
        title="Threat Relationship Graph"
        description="Click a node for details. Drag to rearrange, scroll or use the controls to zoom. Red edges touch malicious entities."
      />
      <SimulatedBanner />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="glass space-y-5 p-4">
          <div>
            <p className="label-eyebrow mb-3">Entity types</p>
            <div className="space-y-2">
              {Object.entries(ENTITY_TYPES).map(([key, t]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    {t.label}
                  </span>
                  <input
                    type="checkbox"
                    className="accent-cyan-400"
                    checked={visibleTypes.includes(key)}
                    onChange={() => toggleType(key)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="label-eyebrow mb-2">Minimum risk: {minRisk}</p>
            <input
              type="range" min={0} max={100} value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="w-full accent-emerald-400"
              aria-label="Minimum risk score"
            />
          </div>

          <div className="space-y-1 text-xs text-slate-400">
            <p className="flex items-center gap-2"><span className="h-0.5 w-6 bg-red-400" /> Edge touching a malicious node (animated)</p>
            <p className="flex items-center gap-2"><span className="h-0.5 w-6 bg-cyan-400" /> Other relationship</p>
          </div>

          {selected ? (
            <div className="rounded-xl border border-cyan-400/20 bg-navy-900/60 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <EntityBadge type={selected.type} />
                <button aria-label="Close details" onClick={() => setSelected(null)} className="rounded p-1 hover:bg-white/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="break-all font-mono text-xs text-slate-100">{selected.value}</p>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-400">Risk score</span>
                <span className="font-bold text-white">{selected.risk}/100</span>
              </div>
              <div className="mt-2"><StatusBadge status={selected.status} /></div>
              <p className="label-eyebrow mb-2 mt-4">Relationships</p>
              <ul className="space-y-2 text-xs">
                {selectedRelations.map((r, i) => (
                  <li key={i} className="flex flex-col">
                    <span className="text-neon-cyan">{r.relation}</span>
                    <span className="break-all font-mono text-slate-300">{r.entity?.value}</span>
                  </li>
                ))}
                {selectedRelations.length === 0 && <li className="text-slate-500">No relationships in this view.</li>}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a node to see its details.</p>
          )}
        </aside>

        <div className="glass h-[70vh] min-h-[460px] overflow-hidden p-0">
          {graph ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelected(node.data.entity)}
              onPaneClick={() => setSelected(null)}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1e3a5f" gap={24} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => ENTITY_TYPES[n.data?.entity?.type]?.color || "#64748b"} />
            </ReactFlow>
          ) : <div className="p-6"><LoadingBlock /></div>}
        </div>
      </div>
    </>
  );
}
