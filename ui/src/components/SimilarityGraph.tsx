import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Image as ImageType } from "@/lib/api";

interface Edge {
  source: number;
  target: number;
  score: number;
}

interface SimilarityGraphProps {
  groups: Array<{
    group_id: number;
    similarity_score: number;
    images: ImageType[];
  }>;
  maxEdges?: number;
}

export function SimilarityGraph({ groups, maxEdges = 80 }: SimilarityGraphProps) {
  const nodesMap = new Map<number, ImageType>();
  const edges: Edge[] = [];

  groups.forEach((g) => {
    g.images.forEach((img) => {
      nodesMap.set(img.id, img);
    });
    for (let i = 0; i < g.images.length; i++) {
      for (let j = i + 1; j < g.images.length; j++) {
        edges.push({
          source: g.images[i].id,
          target: g.images[j].id,
          score: g.similarity_score,
        });
      }
    }
  });

  const nodes = Array.from(nodesMap.values());
  if (nodes.length === 0) return null;

  // 按相似度取前 N 条边，避免过度拥挤
  edges.sort((a, b) => b.score - a.score);
  const clippedEdges = edges.slice(0, maxEdges);

  // 环形布局
  const width = 900;
  const height = 520;
  const radius = Math.min(width, height) / 2 - 80;
  const centerX = width / 2;
  const centerY = height / 2;

  const positioned = nodes.map((n, idx) => {
    const angle = (2 * Math.PI * idx) / nodes.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { ...n, x, y };
  });

  const posMap = new Map<number, { x: number; y: number }>();
  positioned.forEach((p) => posMap.set(p.id, { x: p.x!, y: p.y! }));

  const getColor = (score: number) => {
    const t = Math.max(0, Math.min(1, score));
    // 从淡灰到主色
    const r = Math.round(200 - 80 * t);
    const g = Math.round(220 - 120 * t);
    const b = Math.round(255 - 180 * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>图片关系图谱</CardTitle>
        <CardDescription>节点为图片，连线表示同组相似度</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto">
          <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img">
            {/* edges */}
            {clippedEdges.map((e, idx) => {
              const a = posMap.get(e.source);
              const b = posMap.get(e.target);
              if (!a || !b) return null;
              const strokeWidth = 1 + e.score * 4;
              return (
                <line
                  key={idx}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={getColor(e.score)}
                  strokeWidth={strokeWidth}
                  strokeOpacity={0.8}
                >
                  <title>{`相似度 ${Math.round(e.score * 100)}%`}</title>
                </line>
              );
            })}

            {/* nodes */}
            {positioned.map((n) => (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`} >
                <circle r={24} fill="#0ea5e9" fillOpacity={0.1} stroke="#0ea5e9" strokeWidth={1.5} />
                <image
                  href={n.public_url || "/placeholder.svg"}
                  x={-18}
                  y={-18}
                  width={36}
                  height={36}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="circle(18px at 18px 18px)"
                />
                <title>{n.filename}</title>
              </g>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
