const names = { "uses-effect": "Uses effect", "uses-card": "Uses card", "belongs-to": "Belongs to", "uses-asset": "Uses asset" };

export default function RelatedContent({ data, domain, id, onInspect }) {
  if (!data) return <p className="admin-note">Related content is not available yet.</p>;
  const graph = data.draft || data.current || data;
  const nodes = graph.nodes || [], edges = graph.edges || [];
  const current = nodes.find((node) => node.domain === domain && node.id === id);
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const related = current ? edges.filter((edge) => edge.from === current.key || edge.to === current.key).map((edge) => ({ edge, incoming: edge.to === current.key, node: byKey.get(edge.from === current.key ? edge.to : edge.from) })) : [];
  const unique = related.filter((entry, index) => related.findIndex((other) => other.node?.key === entry.node?.key && other.incoming === entry.incoming && other.edge.kind === entry.edge.kind) === index);
  const renderLinks = (entries) => <ul>{entries.map(({ edge, node, incoming }, index) => <li key={`${node?.key || index}:${edge.kind}:${incoming}`}><span>{incoming ? "Used by" : names[edge.kind] || edge.kind?.replaceAll("-", " ") || "Related"}</span>{node && !node.missing ? onInspect ? <button type="button" onClick={() => onInspect(node.domain, node.id)}>{node.label || node.id}</button> : <strong>{node.label || node.id}</strong> : <span>Reference unavailable{node?.id ? ` · ${node.id}` : ""}</span>}{edge.status && edge.status !== "unchanged" && <small>{edge.status === "added" ? "Added in draft" : "Removed in draft"}</small>}</li>)}</ul>;
  return <div className="design-related">
    {!unique.length ? <p className="admin-note">No authored references for this object.</p> : renderLinks(unique.slice(0, 6))}
    {unique.length > 6 && <details key={`${domain}:${id}`} className="design-related-more"><summary>Show all references ({unique.length})</summary>{renderLinks(unique.slice(6))}</details>}
    <p className="admin-note">{typeof data.coverage === "string" ? data.coverage : "Authored content only. Player-owned decks and historical matches are outside this index."}</p>
  </div>;
}
