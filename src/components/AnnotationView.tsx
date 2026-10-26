import type { Annotation } from "../data/model";
export default function AnnotationView({ items }: { items: Annotation[] }) {
  return (
    <>
      {items.map((a) =>
        a.kind === "text" ? (
          <text
            key={a.id}
            x={a.x}
            y={a.y}
            fill={a.color}
            fontSize={a.size}
            fontFamily="sans-serif"
            dominantBaseline="hanging"
            style={{ whiteSpace: "pre" }}
          >
            {a.text}
          </text>
        ) : (
          <polyline
            key={a.id}
            points={a.points.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={a.color}
            strokeWidth={a.size}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </>
  );
}
