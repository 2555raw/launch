/**
 * Grid Dijkstra for ground troops. Walls are passable at a cost proportional to their health so
 * units will go around light walls and bash through when the detour is longer — the behaviour
 * players expect from this genre.
 */

export interface GridCell {
  /** 0 = open, 1 = solid building (impassable), 2 = wall (passable at cost) */
  kind: 0 | 1 | 2;
  wallCost: number;
  wallId: string | null;
}

export interface PathResult {
  /** tile centres from the start (exclusive) to the goal (inclusive) */
  path: Array<{ x: number; y: number }>;
  /** first wall that lies on the path, if any */
  firstWall: { x: number; y: number; wallId: string } | null;
}

class MinHeap {
  private a: Array<{ k: number; v: number }> = [];
  push(k: number, v: number) {
    const a = this.a;
    a.push({ k, v });
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].k <= a[i].k) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): { k: number; v: number } | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].k < a[m].k) m = l;
        if (r < a.length && a[r].k < a[m].k) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

export function findPath(grid: GridCell[], gridSize: number, sx: number, sy: number, goals: Set<number>): PathResult | null {
  const n = gridSize * gridSize;
  const start = sy * gridSize + sx;
  if (start < 0 || start >= n) return null;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  dist[start] = 0;
  heap.push(0, start);
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.4142],
    [1, -1, 1.4142],
    [-1, 1, 1.4142],
    [-1, -1, 1.4142],
  ];
  let found = -1;
  while (heap.size) {
    const { k, v } = heap.pop()!;
    if (k > dist[v]) continue;
    if (goals.has(v)) {
      found = v;
      break;
    }
    const cx = v % gridSize;
    const cy = (v - cx) / gridSize;
    for (const [dx, dy, w] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const ni = ny * gridSize + nx;
      const cell = grid[ni];
      if (cell.kind === 1 && !goals.has(ni)) continue;
      // no diagonal corner cutting through solids
      if (dx !== 0 && dy !== 0) {
        const a = grid[cy * gridSize + nx];
        const b = grid[ny * gridSize + cx];
        if (a.kind !== 0 || b.kind !== 0) continue;
      }
      const stepCost = w + (cell.kind === 2 ? cell.wallCost : 0);
      const nd = dist[v] + stepCost;
      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = v;
        heap.push(nd, ni);
      }
    }
  }
  if (found < 0) return null;
  const path: Array<{ x: number; y: number }> = [];
  let cur = found;
  while (cur !== start && cur >= 0) {
    const x = cur % gridSize;
    path.push({ x, y: (cur - x) / gridSize });
    cur = prev[cur];
  }
  path.reverse();
  let firstWall: PathResult['firstWall'] = null;
  for (const p of path) {
    const cell = grid[p.y * gridSize + p.x];
    if (cell.kind === 2 && cell.wallId) {
      firstWall = { x: p.x, y: p.y, wallId: cell.wallId };
      break;
    }
  }
  return { path, firstWall };
}
