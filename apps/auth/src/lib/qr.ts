interface VersionSpec {
  ecPerBlock: number;
  blocks: readonly (readonly [count: number, dataCodewords: number])[];
  alignment: readonly number[];
}

const VERSIONS: Readonly<Record<number, VersionSpec>> = {
  1: { ecPerBlock: 10, blocks: [[1, 16]], alignment: [] },
  2: { ecPerBlock: 16, blocks: [[1, 28]], alignment: [6, 18] },
  3: { ecPerBlock: 26, blocks: [[1, 44]], alignment: [6, 22] },
  4: { ecPerBlock: 18, blocks: [[2, 32]], alignment: [6, 26] },
  5: { ecPerBlock: 24, blocks: [[2, 43]], alignment: [6, 30] },
  6: { ecPerBlock: 16, blocks: [[4, 27]], alignment: [6, 34] },
  7: { ecPerBlock: 18, blocks: [[4, 31]], alignment: [6, 22, 38] },
  8: { ecPerBlock: 22, blocks: [[2, 38], [2, 39]], alignment: [6, 24, 42] },
  9: { ecPerBlock: 22, blocks: [[3, 36], [2, 37]], alignment: [6, 26, 46] },
  10: { ecPerBlock: 26, blocks: [[4, 43], [1, 44]], alignment: [6, 28, 50] },
};

const MAX_VERSION = 10;
const FORMAT_LEVEL_M = 0;

function dataCapacity(spec: VersionSpec): number {
  return spec.blocks.reduce((total, [count, size]) => total + count * size, 0);
}

function bit(value: number, index: number): boolean {
  return ((value >>> index) & 1) === 1;
}

function gfMultiply(a: number, b: number): number {
  let result = 0;
  for (let i = 7; i >= 0; i--) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((b >>> i) & 1) * a;
  }
  return result;
}

function reedSolomonDivisor(degree: number): number[] {
  const result: number[] = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j] ?? 0, root);
      if (j + 1 < degree) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] = (result[index] ?? 0) ^ gfMultiply(coefficient, factor);
    });
  }
  return result;
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function chooseVersion(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const spec = VERSIONS[version];
    if (!spec) continue;
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + byteLength * 8 <= dataCapacity(spec) * 8) return version;
  }
  throw new RangeError("Contenu trop long pour le QR code");
}

function buildDataCodewords(bytes: readonly number[], version: number, spec: VersionSpec): number[] {
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => {
    push(byte, 8);
  });
  const capacityBits = dataCapacity(spec) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((acc, value) => (acc << 1) | value, 0));
  }
  for (let pad = 0xec; codewords.length < dataCapacity(spec); pad ^= 0xec ^ 0x11) codewords.push(pad);
  return codewords;
}

function interleave(data: readonly number[], spec: VersionSpec): number[] {
  const divisor = reedSolomonDivisor(spec.ecPerBlock);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const [count, size] of spec.blocks) {
    for (let i = 0; i < count; i++) {
      const block = data.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      ecBlocks.push(reedSolomonRemainder(block, divisor));
    }
  }
  const result: number[] = [];
  const longest = Math.max(...dataBlocks.map((block) => block.length));
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) {
      const value = block[i];
      if (value !== undefined) result.push(value);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (const block of ecBlocks) result.push(block[i] ?? 0);
  }
  return result;
}

class Matrix {
  readonly modules: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }

  setFunction(x: number, y: number, dark: boolean): void {
    const column = this.modules[y];
    const lock = this.reserved[y];
    if (!column || !lock) return;
    column[x] = dark;
    lock[x] = true;
  }

  isDark(x: number, y: number): boolean {
    return this.modules[y]?.[x] ?? false;
  }
}

function drawFinder(matrix: Matrix, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < matrix.size && y >= 0 && y < matrix.size) matrix.setFunction(x, y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(matrix: Matrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) matrix.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
}

function drawFormat(matrix: Matrix, mask: number): void {
  const data = (FORMAT_LEVEL_M << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const size = matrix.size;
  for (let i = 0; i <= 5; i++) matrix.setFunction(8, i, bit(bits, i));
  matrix.setFunction(8, 7, bit(bits, 6));
  matrix.setFunction(8, 8, bit(bits, 7));
  matrix.setFunction(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) matrix.setFunction(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) matrix.setFunction(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) matrix.setFunction(8, size - 15 + i, bit(bits, i));
  matrix.setFunction(8, size - 8, true);
}

function drawVersion(matrix: Matrix, version: number): void {
  if (version < 7) return;
  let remainder = version;
  for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  const bits = (version << 12) | remainder;
  for (let i = 0; i < 18; i++) {
    const a = matrix.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    matrix.setFunction(a, b, bit(bits, i));
    matrix.setFunction(b, a, bit(bits, i));
  }
}

function drawFunctionPatterns(matrix: Matrix, version: number, spec: VersionSpec): void {
  const size = matrix.size;
  for (let i = 0; i < size; i++) {
    matrix.setFunction(6, i, i % 2 === 0);
    matrix.setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(matrix, 3, 3);
  drawFinder(matrix, size - 4, 3);
  drawFinder(matrix, 3, size - 4);
  const positions = spec.alignment;
  const last = positions.length - 1;
  positions.forEach((cx, i) => {
    positions.forEach((cy, j) => {
      const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
      if (!corner) drawAlignment(matrix, cx, cy);
    });
  });
  drawFormat(matrix, 0);
  drawVersion(matrix, version);
}

function placeCodewords(matrix: Matrix, codewords: readonly number[]): void {
  const size = matrix.size;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vertical : vertical;
        if (!matrix.reserved[y]?.[x] && index < codewords.length * 8) {
          const row = matrix.modules[y];
          if (row) row[x] = bit(codewords[index >>> 3] ?? 0, 7 - (index & 7));
          index++;
        }
      }
    }
  }
}

function maskApplies(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0;
    default:
      return ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0;
  }
}

function applyMask(matrix: Matrix, mask: number): void {
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.reserved[y]?.[x] && maskApplies(mask, x, y)) {
        const row = matrix.modules[y];
        if (row) row[x] = !row[x];
      }
    }
  }
}

const FINDER_LIKE = [true, false, true, true, true, false, true];

function lineRuns(line: readonly boolean[]): number {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      run++;
    } else {
      if (run >= 5) penalty += 3 + (run - 5);
      run = 1;
    }
  }
  for (let i = 0; i + 7 <= line.length; i++) {
    if (!FINDER_LIKE.every((value, k) => line[i + k] === value)) continue;
    const before = line.slice(Math.max(0, i - 4), i);
    const after = line.slice(i + 7, i + 11);
    const lightBefore = before.length === 4 && before.every((value) => !value);
    const lightAfter = after.length === 4 && after.every((value) => !value);
    if (lightBefore || lightAfter) penalty += 40;
  }
  return penalty;
}

function penaltyOf(matrix: Matrix): number {
  const size = matrix.size;
  let penalty = 0;
  let dark = 0;
  for (let y = 0; y < size; y++) {
    const row = matrix.modules[y] ?? [];
    penalty += lineRuns(row);
    dark += row.filter(Boolean).length;
  }
  for (let x = 0; x < size; x++) penalty += lineRuns(matrix.modules.map((row) => row[x] ?? false));
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const value = matrix.isDark(x, y);
      if (value === matrix.isDark(x + 1, y) && value === matrix.isDark(x, y + 1) && value === matrix.isDark(x + 1, y + 1)) penalty += 3;
    }
  }
  const total = size * size;
  penalty += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return penalty;
}

export function encodeQr(text: string): boolean[][] {
  const bytes = utf8Bytes(text);
  const version = chooseVersion(bytes.length);
  const spec = VERSIONS[version];
  if (!spec) throw new RangeError("Version de QR code inconnue");
  const codewords = interleave(buildDataCodewords(bytes, version, spec), spec);
  const matrix = new Matrix(version * 4 + 17);
  drawFunctionPatterns(matrix, version, spec);
  placeCodewords(matrix, codewords);
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(matrix, mask);
    drawFormat(matrix, mask);
    const penalty = penaltyOf(matrix);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    applyMask(matrix, mask);
  }
  applyMask(matrix, bestMask);
  drawFormat(matrix, bestMask);
  return matrix.modules.map((row) => row.slice());
}
