import { useEffect, useRef } from "react";
import { Network, DataSet } from "vis-network/standalone";

const COLORS = {
  ego: { background: "#2d6cdf", border: "#1a4fa0", font: { color: "#fff" } },
  internal: { background: "#3b8a4e", border: "#2a6338", font: { color: "#fff" } },
  external: { background: "#c08a14", border: "#8a6310", font: { color: "#fff" } },
  externo: { background: "#c0392b", border: "#922b21", font: { color: "#fff" } },
  campus: { background: "#6b46c1", border: "#4c3290", font: { color: "#fff" } },
  selected: { background: "#2d6cdf", border: "#1a4fa0", size: 28 },
  default: { background: "#9ca3af", border: "#6b7280" },
};

export default function NetworkGraph({ nodes, edges, onNodeClick, height = 300, type = "ego" }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !nodes || nodes.length === 0) return;

    const visNodes = new DataSet(
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        title: n.title || n.label,
        value: n.value || 10,
        color: n.selected ? COLORS.selected : (COLORS[n.group] || COLORS.default),
        font: { size: 11, color: "#1f2328" },
        borderWidth: n.selected ? 3 : 1,
      }))
    );

    const visEdges = new DataSet(
      edges.map((e, i) => ({
        id: i,
        from: e.from,
        to: e.to,
        value: e.value || 1,
        title: e.title || "",
        color: { color: "#cfd4da", highlight: "#2d6cdf" },
        smooth: { type: "continuous" },
      }))
    );

    const options = {
      nodes: { shape: "dot", scaling: { min: 8, max: 30 }, font: { size: 11 } },
      edges: { scaling: { min: 1, max: 6 }, smooth: { enabled: true, type: "continuous" } },
      physics: {
        stabilization: { iterations: 150 },
        barnesHut: { gravitationalConstant: -6000, springLength: 120 },
      },
      interaction: { hover: true, tooltipDelay: 150 },
      layout: { improvedLayout: true },
    };

    networkRef.current = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);

    if (onNodeClick) {
      networkRef.current.on("click", (params) => {
        if (params.nodes.length > 0) onNodeClick(params.nodes[0]);
      });
    }

    return () => { networkRef.current?.destroy(); networkRef.current = null; };
  }, [nodes, edges]);

  return (
    <div ref={containerRef}
      style={{ width: "100%", height, border: "1px solid var(--line2)", borderRadius: 8, background: "#fafbfc", overflow: "hidden" }}
    />
  );
}
