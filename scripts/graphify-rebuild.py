"""Refresh graphify code graph + regenerate wiki.

Default-Tool fuer Recon: nach Code-Aenderungen aufrufen, dann nutzt die
KI graphify-out/wiki/index.md statt Raw-Files (Token-Spar).

Aufruf: py scripts/graphify-rebuild.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import networkx as nx
from graphify.watch import _rebuild_code
from graphify.wiki import to_wiki


def main() -> int:
    repo = Path(".").resolve()
    print(f"[1/2] Rebuilding code graph in {repo} ...")
    _rebuild_code(repo)

    graph_path = Path("graphify-out/graph.json")
    if not graph_path.exists():
        print("graph.json nicht gefunden — Rebuild fehlgeschlagen?", file=sys.stderr)
        return 1

    print("[2/2] Regenerating wiki articles ...")
    data = json.loads(graph_path.read_text(encoding="utf-8"))
    G: nx.DiGraph = nx.DiGraph()
    for n in data.get("nodes", []):
        attrs = {k: v for k, v in n.items() if k != "id"}
        G.add_node(n["id"], **attrs)
    for e in data.get("edges", []):
        attrs = {k: v for k, v in e.items() if k not in ("source", "target")}
        G.add_edge(e["source"], e["target"], **attrs)

    communities: dict[int, list[str]] = {}
    for node_id, attrs in G.nodes(data=True):
        c = int(attrs.get("community", 0))
        communities.setdefault(c, []).append(node_id)

    deg = dict(G.degree())
    top = sorted(deg.items(), key=lambda x: -x[1])[:10]
    god_nodes_data = [{"label": nid, "edges": d} for nid, d in top]

    written = to_wiki(G, communities, "graphify-out/wiki", god_nodes_data=god_nodes_data)
    print(f"Wiki: {written} articles in graphify-out/wiki/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
