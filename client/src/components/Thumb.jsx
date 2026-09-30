const GOLD = "#e2b649";

const shapes = [
  // 0: stacked printed layers
  () => [0, 1, 2, 3, 4, 5].map((i) => (
    <rect key={i} x={60 + i * 4} y={150 - i * 18} width={200 - i * 8} height="12" rx="6" fill="none" stroke={GOLD} strokeWidth="2" />
  )),
  // 1: gantry frame
  () => (
    <g fill="none" stroke={GOLD} strokeWidth="2">
      <path d="M60 170V60h200v110M60 60h200M60 90h200" />
      <rect x="140" y="90" width="40" height="30" />
      <path d="M160 120v40" strokeDasharray="4 4" />
    </g>
  ),
  // 2: tower
  () => (
    <g fill="none" stroke={GOLD} strokeWidth="2">
      <path d="M120 170V50h80v120zM120 80h80M120 110h80M120 140h80M160 50V30" />
    </g>
  ),
  // 3: digital twin nodes
  () => (
    <g fill="none" stroke={GOLD} strokeWidth="2">
      <path d="M80 150l60-60 50 30 50-70M140 90v60M190 120v40" />
      {[[80, 150], [140, 90], [190, 120], [240, 50]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="7" fill="#16181d" />
      ))}
    </g>
  ),
  // 4: brick courses
  () => [0, 1, 2, 3].map((r) =>
    [0, 1, 2, 3].map((c) => (
      <rect key={`${r}${c}`} x={70 + c * 45 + (r % 2 ? 22 : 0)} y={60 + r * 28} width="42" height="24"
        fill="none" stroke={GOLD} strokeWidth="2" />
    ))
  ),
];

export default function Thumb({ index }) {
  const Shape = shapes[index % shapes.length];
  return (
    <svg viewBox="0 0 320 200" className="thumb" role="img" aria-label="Blueprint illustration" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id={`g${index}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(226,182,73,.16)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="200" fill="#16181d" />
      <rect width="320" height="200" fill={`url(#g${index})`} />
      <Shape />
    </svg>
  );
}