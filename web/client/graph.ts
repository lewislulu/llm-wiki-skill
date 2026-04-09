import * as d3force from "d3-force";
import * as d3sel from "d3-selection";
import * as d3zoom from "d3-zoom";
import * as d3drag from "d3-drag";

export interface GraphNode extends d3force.SimulationNodeDatum {
  id: string;
  label: string;
  path: string;
  group: string;
  degree: number;
  title: string | null;
}

export interface GraphEdge extends d3force.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphOptions {
  onNodeClick?: (node: GraphNode) => void;
}

/**
 * Force-directed knowledge graph rendered to an SVG element.
 *
 * Ambient-motion tuning:
 *   - alphaTarget stays above zero so the simulation never cools all the way
 *   - alphaDecay is very small so the initial spread takes its time
 *   - a custom "noise" force adds a tiny random velocity perturbation each
 *     tick, making the layout perpetually breathe even after it settles
 *
 * Visual touches:
 *   - links are curved arcs, not straight lines
 *   - each node has a blurred halo behind it (SVG Gaussian blur filter)
 *     colored by category
 *   - staggered fade-in entry animation driven by inline animation-delay
 *   - highlighted edges get an animated stroke-dashoffset "flow" effect
 *     via CSS, plus a soft drop-shadow glow
 */
export function renderGraph(
  svgEl: SVGSVGElement,
  data: GraphData,
  opts: GraphOptions = {},
): () => void {
  const svg = d3sel.select(svgEl);
  svg.selectAll("*").remove();

  const width = svgEl.clientWidth || 1200;
  const height = svgEl.clientHeight || 800;
  svg.attr("viewBox", `0 0 ${width} ${height}`);

  // ── Defs: Gaussian blur filter (for halos) + vignette gradient ─────────
  const defs = svg.append("defs");
  defs
    .append("filter")
    .attr("id", "graph-node-glow")
    .attr("x", "-150%")
    .attr("y", "-150%")
    .attr("width", "400%")
    .attr("height", "400%")
    .append("feGaussianBlur")
    .attr("stdDeviation", 6);

  const vignette = defs
    .append("radialGradient")
    .attr("id", "graph-bg-vignette")
    .attr("cx", "50%")
    .attr("cy", "50%")
    .attr("r", "70%");
  vignette.append("stop").attr("offset", "0%").attr("stop-color", "rgba(0,0,0,0)");
  vignette.append("stop").attr("offset", "100%").attr("stop-color", "rgba(0,0,0,0.45)");

  svg
    .append("rect")
    .attr("class", "graph-bg")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "url(#graph-bg-vignette)");

  // ── Layers ──────────────────────────────────────────────────────────────
  const root = svg.append("g").attr("class", "graph-root");
  const linkLayer = root.append("g").attr("class", "links");
  const nodeLayer = root.append("g").attr("class", "nodes");

  // ── Data prep ───────────────────────────────────────────────────────────
  const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
  const links: GraphEdge[] = data.edges.map((e) => ({ ...e }));

  // Seed initial positions in a tight ring so the entry animation spreads
  // outward naturally instead of popping in.
  for (const n of nodes) {
    const angle = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 30;
    n.x = width / 2 + Math.cos(angle) * r;
    n.y = height / 2 + Math.sin(angle) * r;
  }

  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const e of data.edges) {
    const s = typeof e.source === "string" ? e.source : e.source.id;
    const t = typeof e.target === "string" ? e.target : e.target.id;
    adjacency.get(s)?.add(t);
    adjacency.get(t)?.add(s);
  }

  const radius = (n: GraphNode) => 6 + Math.sqrt(n.degree) * 2.6;

  // ── Simulation ──────────────────────────────────────────────────────────
  const sim = d3force
    .forceSimulation<GraphNode>(nodes)
    .force(
      "link",
      d3force
        .forceLink<GraphNode, GraphEdge>(links)
        .id((d) => d.id)
        .distance(170)
        .strength(0.22),
    )
    .force(
      "charge",
      d3force.forceManyBody<GraphNode>().strength(-650).distanceMax(900),
    )
    .force("center", d3force.forceCenter(width / 2, height / 2))
    .force(
      "collision",
      d3force.forceCollide<GraphNode>().radius((d) => radius(d) + 14).strength(0.9),
    )
    .force("x", d3force.forceX(width / 2).strength(0.02))
    .force("y", d3force.forceY(height / 2).strength(0.02))
    .alphaDecay(0.005)
    .velocityDecay(0.28)
    .alphaTarget(0.015);

  // Perpetual ambient noise: tiny random velocity added every tick. The
  // velocity decay in the simulation means these settle into a gentle
  // bounded jitter rather than nodes flying off.
  sim.force("noise", () => {
    for (const n of nodes) {
      if (n.fx != null) continue;
      n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * 0.09;
      n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * 0.09;
    }
  });

  // ── Links: curved arcs ──────────────────────────────────────────────────
  const linkSel = linkLayer
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("fill", "none")
    .attr("stroke-linecap", "round");

  // ── Nodes: outer g gets d3 translate, inner g gets CSS entry animation ─
  const nodeSel = nodeLayer
    .selectAll<SVGGElement, GraphNode>("g.node")
    .data(nodes)
    .enter()
    .append("g")
    .attr(
      "class",
      (d) => `node group-${sanitizeGroup(d.group)}${d.degree >= 5 ? " big" : ""}`,
    );

  const nodeInner = nodeSel
    .append("g")
    .attr("class", "node-inner")
    .style("animation-delay", (_d, i) => `${Math.min(900, i * 18)}ms`);

  // Halo (blurred via Gaussian filter, colored per-group via CSS)
  nodeInner
    .append("circle")
    .attr("class", "node-halo")
    .attr("r", (d) => radius(d) * 2.8)
    .attr("filter", "url(#graph-node-glow)");

  // Main circle
  nodeInner
    .append("circle")
    .attr("class", "node-main")
    .attr("r", (d) => radius(d));

  // Label
  nodeInner
    .append("text")
    .attr("dy", (d) => -radius(d) - 8)
    .attr("text-anchor", "middle")
    .text((d) => d.title || d.label);

  // ── Drag ────────────────────────────────────────────────────────────────
  const dragBehavior = d3drag
    .drag<SVGGElement, GraphNode>()
    .on("start", (event, d) => {
      if (!event.active) sim.alphaTarget(0.15).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on("drag", (event, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on("end", (event, d) => {
      if (!event.active) sim.alphaTarget(0.015); // back to ambient
      d.fx = null;
      d.fy = null;
    });
  nodeSel.call(dragBehavior);

  // ── Zoom / pan ──────────────────────────────────────────────────────────
  const zoomBehavior = d3zoom
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 4])
    .on("zoom", (event) => {
      root.attr("transform", event.transform.toString());
    });
  svg.call(zoomBehavior);

  // ── Hover ───────────────────────────────────────────────────────────────
  nodeSel
    .on("mouseenter", function (_event, d) {
      const neighbors = adjacency.get(d.id) ?? new Set();
      nodeSel.classed("dim", (n) => n.id !== d.id && !neighbors.has(n.id));
      nodeSel.classed("highlight", (n) => n.id === d.id || neighbors.has(n.id));
      linkSel.classed("dim", (l) => {
        const s = (l.source as GraphNode).id ?? (l.source as unknown as string);
        const t = (l.target as GraphNode).id ?? (l.target as unknown as string);
        return s !== d.id && t !== d.id;
      });
      linkSel.classed("highlight", (l) => {
        const s = (l.source as GraphNode).id ?? (l.source as unknown as string);
        const t = (l.target as GraphNode).id ?? (l.target as unknown as string);
        return s === d.id || t === d.id;
      });
    })
    .on("mouseleave", () => {
      nodeSel.classed("dim", false).classed("highlight", false);
      linkSel.classed("dim", false).classed("highlight", false);
    })
    .on("click", (_event, d) => {
      opts.onNodeClick?.(d);
    });

  // ── Tick ────────────────────────────────────────────────────────────────
  sim.on("tick", () => {
    linkSel.attr("d", (d) => {
      const s = d.source as GraphNode;
      const t = d.target as GraphNode;
      if (s.x == null || s.y == null || t.x == null || t.y == null) return "";
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.hypot(dx, dy);
      const dr = Math.max(dist * 1.8, 1); // curve radius — larger = gentler arc
      return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
    });

    nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });

  return () => {
    sim.stop();
    svg.selectAll("*").remove();
  };
}

function sanitizeGroup(g: string): string {
  if (g === "concepts" || g === "entities" || g === "summaries") return g;
  return "other";
}
