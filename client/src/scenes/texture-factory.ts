import Phaser from 'phaser';

// ─── Types ──────────────────────────────────────────────────────
export interface CharacterPalette {
  hair: number;
  hairDark: number;
  hairHighlight: number;
  skin: number;
  skinShadow: number;
  blush: number;
  eyeColor: number;
  outfit: number;
  outfitDark: number;
  outfitLight: number;
  outfitAccent: number;
  shoe: number;
}

// ─── Palettes ───────────────────────────────────────────────────
export const PALETTES: Record<string, CharacterPalette> = {
  Blue: {
    hair: 0x3b5998, hairDark: 0x2a4070, hairHighlight: 0x5b79b8,
    skin: 0xffdbb8, skinShadow: 0xf0c8a0, blush: 0xffaaaa,
    eyeColor: 0x1a1a3a,
    outfit: 0x4488dd, outfitDark: 0x3366bb, outfitLight: 0x88bbff,
    outfitAccent: 0xffd700, shoe: 0x554433,
  },
  Orange: {
    hair: 0x8b5e3c, hairDark: 0x6b4020, hairHighlight: 0xb08060,
    skin: 0xffd8b0, skinShadow: 0xf0c098, blush: 0xffbbbb,
    eyeColor: 0x2a1a0a,
    outfit: 0xff8844, outfitDark: 0xdd6622, outfitLight: 0xffcc88,
    outfitAccent: 0xffffff, shoe: 0x443322,
  },
  Green: {
    hair: 0x4a9e4a, hairDark: 0x357035, hairHighlight: 0x70c070,
    skin: 0xffd0a8, skinShadow: 0xf0b890, blush: 0xffaaaa,
    eyeColor: 0x1a2a1a,
    outfit: 0x44aa66, outfitDark: 0x338855, outfitLight: 0x88cc88,
    outfitAccent: 0xffee44, shoe: 0x443322,
  },
};

// ─── Color Helpers ──────────────────────────────────────────────
export function darken(c: number, amount: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) - amount);
  const g = Math.max(0, ((c >> 8) & 0xff) - amount);
  const b = Math.max(0, (c & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, amount: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + amount);
  const g = Math.min(255, ((c >> 8) & 0xff) + amount);
  const b = Math.min(255, (c & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

export function tileRand(gx: number, gy: number, seed: number): number {
  const n = Math.sin(gx * 12.9898 + gy * 78.233 + seed * 43.831) * 43758.5453;
  return n - Math.floor(n);
}

// ─── Constants ──────────────────────────────────────────────────
const PX = 2;
const TILE_W = 64;
const TILE_H = 32;

// Character texture dimensions (at PX=2 screen scale)
const CHAR_TEX_W = 24;
const CHAR_TEX_H = 46;
const CHAR_BX = 12; // center X in texture
const CHAR_BY = 40; // foot Y in texture

// ─── Main Entry Point ───────────────────────────────────────────
export function generateAllTextures(scene: Phaser.Scene): void {
  generateGroundTextures(scene);
  generateCharacterTextures(scene);
  generateShadowTexture(scene);
  generateTreeTextures(scene);
  generateDecorationTextures(scene);
  generateEmoteTextures(scene);
  createCharacterAnimations(scene);
}

// ─── Ground Tile Textures ───────────────────────────────────────
function generateGroundTextures(scene: Phaser.Scene): void {
  const grassColors = [0xa8d5a2, 0x9ecf96, 0xb2dba8, 0xa0cd98];
  const walkColors = [0xe8d5b8, 0xdcc9a8, 0xe0cfb0];

  // 4 grass variants
  for (let v = 0; v < 4; v++) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const baseColor = grassColors[v % grassColors.length];

    // Diamond fill
    g.fillStyle(baseColor, 1);
    g.beginPath();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(1, 0x90b88a, 0.15);
    g.beginPath();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.strokePath();

    // Grass blade details (unique per variant)
    const cx = TILE_W / 2;
    const cy = TILE_H / 2;
    const numBlades = 5 + v * 2;
    for (let i = 0; i < numBlades; i++) {
      const seed = v * 100 + i;
      const rx = (Math.sin(seed * 1.7) * 0.5) * (TILE_W / 2) * 0.7;
      const ry = (Math.cos(seed * 2.3) * 0.5) * (TILE_H / 2) * 0.5;
      if (Math.abs(rx) / (TILE_W / 2) + Math.abs(ry) / (TILE_H / 2) < 0.7) {
        const shade = 10 + (i * 7) % 20;
        g.fillStyle(darken(baseColor, shade), 0.6);
        g.fillRect(cx + rx, cy + ry - 1, 1, 2);
      }
    }

    // Light highlight (variants 1, 3)
    if (v % 2 === 1) {
      g.fillStyle(0xc8eec2, 0.5);
      g.fillRect(cx + 5, cy - 3, 1, 1);
    }

    // Wildflower (variant 3 only)
    if (v === 3) {
      const flowerCols = [0xff9eae, 0xffd700, 0xffb3c1, 0x88c0ff, 0xc8a0ff];
      const fc = flowerCols[v % flowerCols.length];
      g.fillStyle(0x68a060, 0.7);
      g.fillRect(cx + 3, cy + 1, 1, 2);
      g.fillStyle(fc, 0.85);
      g.fillRect(cx + 2, cy, 3, 2);
      g.fillStyle(0xffee58, 0.9);
      g.fillRect(cx + 3, cy, 1, 1);
    }

    g.generateTexture(`tile-grass-${v}`, TILE_W, TILE_H);
    g.destroy();
  }

  // 3 walkway variants
  for (let v = 0; v < 3; v++) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const baseColor = walkColors[v % walkColors.length];

    // Diamond fill
    g.fillStyle(baseColor, 1);
    g.beginPath();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.fillPath();

    // Outline
    g.lineStyle(1, 0xc8b898, 0.15);
    g.beginPath();
    g.moveTo(TILE_W / 2, 0);
    g.lineTo(TILE_W, TILE_H / 2);
    g.lineTo(TILE_W / 2, TILE_H);
    g.lineTo(0, TILE_H / 2);
    g.closePath();
    g.strokePath();

    // Cobblestone pattern
    const cx = TILE_W / 2;
    const cy = TILE_H / 2;
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    for (let i = -2; i <= 2; i++) {
      for (let j = -1; j <= 1; j++) {
        const ox = i * 10 + (j % 2) * 5;
        const oy = j * 6;
        if (Math.abs(ox) / hw + Math.abs(oy) / hh < 0.7) {
          const shade = ((i + j + v) % 2 === 0) ? 8 : 14;
          g.fillStyle(darken(baseColor, shade), 0.25);
          g.fillRect(cx + ox - 3, cy + oy - 1, 6, 3);
          g.fillStyle(lighten(baseColor, 10), 0.15);
          g.fillRect(cx + ox - 3, cy + oy - 1, 6, 1);
        }
      }
    }

    // Pebbles
    for (let i = 0; i < 3; i++) {
      const px = (Math.sin((v + 1) * 3.7 + i * 2.1) * 0.5) * 20;
      const py = (Math.cos((v + 1) * 4.3 + i * 1.7) * 0.5) * 8;
      if (Math.abs(px) / hw + Math.abs(py) / hh < 0.6) {
        g.fillStyle(0xc8b090, 0.3);
        g.fillRect(cx + px, cy + py, 2, 1);
      }
    }

    g.generateTexture(`tile-walk-${v}`, TILE_W, TILE_H);
    g.destroy();
  }
}

// ─── Character Textures ─────────────────────────────────────────
function generateCharacterTextures(scene: Phaser.Scene): void {
  const names = ['Blue', 'Orange', 'Green'];
  for (const name of names) {
    const p = PALETTES[name];
    for (let frame = 0; frame < 4; frame++) {
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      drawCharacterFrame(g, p, name, frame, CHAR_BX, CHAR_BY);
      g.generateTexture(`char-${name.toLowerCase()}-${frame}`, CHAR_TEX_W, CHAR_TEX_H);
      g.destroy();
    }
  }
}

function drawCharacterFrame(
  g: Phaser.GameObjects.Graphics,
  p: CharacterPalette,
  label: string,
  frame: number,
  bx: number,
  by: number,
): void {
  const s = PX;
  const d = (col: number, row: number, color: number, alpha = 1) => {
    g.fillStyle(color, alpha);
    g.fillRect(bx + col * s, by - row * s, s, s);
  };

  // ─── SHOES (row 1) ──────────────────────
  if (frame === 1) {
    d(-2, 1, p.shoe); d(1, 1, p.shoe);
  } else if (frame === 3) {
    d(-1, 1, p.shoe); d(2, 1, p.shoe);
  } else {
    d(-1, 1, p.shoe); d(1, 1, p.shoe);
  }

  // ─── LEGS (rows 2-3) ────────────────────
  if (frame === 1) {
    d(-2, 3, p.outfitDark); d(-2, 2, p.outfitDark);
    d(1, 3, p.outfitDark); d(1, 2, p.outfitDark);
  } else if (frame === 3) {
    d(-1, 3, p.outfitDark); d(-1, 2, p.outfitDark);
    d(2, 3, p.outfitDark); d(2, 2, p.outfitDark);
  } else if (frame === 2) {
    d(-1, 3, p.outfitDark); d(0, 3, p.outfitDark);
    d(-1, 2, p.outfitDark); d(0, 2, p.outfitDark);
  } else {
    d(-1, 3, p.outfitDark); d(-1, 2, p.outfitDark);
    d(1, 3, p.outfitDark); d(1, 2, p.outfitDark);
  }

  // ─── BODY (rows 4-7) ────────────────────
  for (let c = -2; c <= 1; c++) d(c, 4, p.outfit);
  for (let c = -2; c <= 1; c++) d(c, 5, p.outfit);
  d(-1, 5, p.outfitDark); d(0, 5, p.outfitDark);
  for (let c = -2; c <= 1; c++) d(c, 6, p.outfit);
  d(-1, 6, p.outfitLight); d(0, 6, p.outfitLight);
  for (let c = -2; c <= 1; c++) d(c, 7, p.outfit);
  d(-1, 7, p.outfitLight); d(0, 7, p.outfitLight);

  // ─── ARMS (animate with walk) ───────────
  if (frame === 1) {
    d(-3, 6, p.outfit); d(-3, 5, p.skin);
    d(2, 4, p.outfit); d(2, 3, p.skin);
  } else if (frame === 3) {
    d(-3, 4, p.outfit); d(-3, 3, p.skin);
    d(2, 6, p.outfit); d(2, 5, p.skin);
  } else {
    d(-3, 5, p.outfit); d(-3, 4, p.skin);
    d(2, 5, p.outfit); d(2, 4, p.skin);
  }

  // ─── NECK (row 8) ───────────────────────
  d(-1, 8, p.skin); d(0, 8, p.skin);

  // ─── HEAD (rows 9-15) ───────────────────
  d(-1, 9, p.skin); d(0, 9, 0xdd7777); d(1, 9, p.skin);
  d(-2, 10, p.blush, 0.6); d(-1, 10, p.skin);
  d(0, 10, p.skin); d(1, 10, p.blush, 0.6);
  d(-3, 11, p.hairDark);
  d(-2, 11, p.skin);
  d(-1, 11, p.eyeColor);
  d(0, 11, p.skin);
  d(1, 11, p.eyeColor);
  d(2, 11, p.skin);

  // Eye highlights
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(bx + (-1) * s + 1, by - 11 * s, 1, 1);
  g.fillRect(bx + 1 * s + 1, by - 11 * s, 1, 1);

  d(-3, 12, p.hair);
  for (let c = -2; c <= 1; c++) d(c, 12, p.skin);
  d(2, 12, p.hair);
  d(-3, 13, p.hairDark);
  for (let c = -2; c <= 1; c++) d(c, 13, p.hair);
  d(2, 13, p.hairDark);
  for (let c = -2; c <= 1; c++) d(c, 14, p.hair);
  d(-1, 14, p.hairHighlight);
  d(-1, 15, p.hairDark); d(0, 15, p.hairDark);

  // ─── Character-specific accessories ─────
  if (label === 'Blue') {
    d(-1, 7, p.outfitAccent); d(0, 7, p.outfitAccent);
    d(0, 6, p.outfitAccent);
  } else if (label === 'Orange') {
    d(-2, 15, p.outfitAccent); d(-1, 15, p.outfitAccent);
    d(0, 15, p.outfitAccent); d(1, 15, p.outfitAccent);
    d(-1, 16, p.outfitAccent); d(0, 16, p.outfitAccent);
  } else if (label === 'Green') {
    d(2, 14, p.outfitAccent);
    d(1, 15, 0xff6680);
    d(2, 15, p.outfitAccent);
    d(3, 15, 0xff6680);
    d(2, 16, 0xff6680);
  }
}

// ─── Shadow Texture ─────────────────────────────────────────────
function generateShadowTexture(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 0.12);
  g.fillEllipse(8, 3, 14, 5);
  g.generateTexture('shadow-char', 16, 6);
  g.destroy();

  // Building shadow (small)
  const g2 = scene.make.graphics({ x: 0, y: 0 }, false);
  g2.fillStyle(0x000000, 0.08);
  g2.fillEllipse(10, 3, 18, 7);
  g2.generateTexture('shadow-tree', 20, 8);
  g2.destroy();
}

// ─── Tree Textures ──────────────────────────────────────────────
const TREE_W = 32;
const TREE_H = 52;
const TREE_CX = 16;
const TREE_BASE_Y = 45;

function generateTreeTextures(scene: Phaser.Scene): void {
  // Oak tree
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = TREE_CX;
    const baseY = TREE_BASE_Y;

    // Trunk with bark
    g.fillStyle(0x8b6f47, 1);
    g.fillRect(cx - 2, baseY - 20, 5, 20);
    g.fillStyle(darken(0x8b6f47, 15), 0.5);
    g.fillRect(cx - 1, baseY - 16, 1, 3);
    g.fillRect(cx + 1, baseY - 10, 1, 2);
    g.fillRect(cx - 1, baseY - 6, 1, 2);
    g.fillStyle(lighten(0x8b6f47, 15), 0.3);
    g.fillRect(cx + 2, baseY - 18, 1, 16);

    // Canopy layers
    g.fillStyle(0x4a9844, 1);
    g.fillCircle(cx, baseY - 24, 12);
    g.fillStyle(0x5ab854, 1);
    g.fillCircle(cx - 4, baseY - 27, 9);
    g.fillCircle(cx + 5, baseY - 26, 9);
    g.fillStyle(0x6ac864, 1);
    g.fillCircle(cx, baseY - 30, 8);
    g.fillCircle(cx - 6, baseY - 24, 6);
    g.fillCircle(cx + 6, baseY - 25, 6);
    g.fillStyle(0x8ee088, 0.5);
    g.fillCircle(cx - 3, baseY - 32, 3);
    g.fillCircle(cx + 4, baseY - 30, 2);
    g.fillStyle(0x3a8834, 0.3);
    g.fillCircle(cx, baseY - 20, 8);

    g.generateTexture('tree-oak', TREE_W, TREE_H);
    g.destroy();
  }

  // Pine tree
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = TREE_CX;
    const baseY = TREE_BASE_Y;

    g.fillStyle(0x8b6f47, 1);
    g.fillRect(cx - 2, baseY - 20, 5, 20);
    g.fillStyle(darken(0x8b6f47, 15), 0.5);
    g.fillRect(cx - 1, baseY - 14, 1, 3);
    g.fillStyle(lighten(0x8b6f47, 15), 0.3);
    g.fillRect(cx + 2, baseY - 18, 1, 16);

    g.fillStyle(0x2a7840, 1);
    g.fillTriangle(cx, baseY - 38, cx - 10, baseY - 22, cx + 10, baseY - 22);
    g.fillStyle(0x3a8848, 1);
    g.fillTriangle(cx, baseY - 32, cx - 12, baseY - 16, cx + 12, baseY - 16);
    g.fillStyle(0x4a9850, 1);
    g.fillTriangle(cx, baseY - 26, cx - 13, baseY - 10, cx + 13, baseY - 10);
    g.fillStyle(0x8ee088, 0.4);
    g.fillCircle(cx - 4, baseY - 26, 2);
    g.fillCircle(cx + 5, baseY - 20, 2);
    g.fillCircle(cx, baseY - 35, 2);

    g.generateTexture('tree-pine', TREE_W, TREE_H);
    g.destroy();
  }

  // Fruit tree
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = TREE_CX;
    const baseY = TREE_BASE_Y;

    g.fillStyle(0x7a5f3c, 1);
    g.fillRect(cx - 2, baseY - 20, 5, 20);
    g.fillStyle(darken(0x7a5f3c, 15), 0.5);
    g.fillRect(cx - 1, baseY - 14, 1, 3);
    g.fillStyle(lighten(0x7a5f3c, 15), 0.3);
    g.fillRect(cx + 2, baseY - 18, 1, 16);

    g.fillStyle(0x5ab054, 1);
    g.fillCircle(cx, baseY - 23, 11);
    g.fillStyle(0x6ac064, 1);
    g.fillCircle(cx - 3, baseY - 26, 8);
    g.fillCircle(cx + 4, baseY - 25, 8);
    g.fillStyle(0x7ad074, 1);
    g.fillCircle(cx, baseY - 28, 7);
    g.fillStyle(0x90e08a, 0.5);
    g.fillCircle(cx - 2, baseY - 30, 3);
    // Fruits
    g.fillStyle(0xff4444, 0.9);
    g.fillCircle(cx - 5, baseY - 22, 2);
    g.fillCircle(cx + 6, baseY - 24, 2);
    g.fillCircle(cx + 1, baseY - 19, 2);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(cx - 5.5, baseY - 22.5, 0.8);
    g.fillCircle(cx + 5.5, baseY - 24.5, 0.8);

    g.generateTexture('tree-fruit', TREE_W, TREE_H);
    g.destroy();
  }
}

// ─── Decoration Textures ────────────────────────────────────────
function generateDecorationTextures(scene: Phaser.Scene): void {
  // Flower patch (30×16)
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = 15;
    const baseY = 10;
    const colors = [0xff9eae, 0xffd700, 0xffb3c1, 0xff8a4c, 0x7ecfc0, 0xc8a0ff];

    g.fillStyle(0x8ec986, 0.6);
    g.fillEllipse(cx, baseY, 14, 6);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const r = 4 + (i % 2) * 2;
      const fx = cx + Math.cos(angle) * r;
      const fy = baseY + Math.sin(angle) * (r * 0.4) - 2;

      g.lineStyle(1, 0x48a040, 0.8);
      g.beginPath();
      g.moveTo(fx, fy + 3);
      g.lineTo(fx, fy - 1);
      g.strokePath();

      if (i % 2 === 0) {
        g.fillStyle(0x58b050, 0.6);
        g.fillEllipse(fx + 1.5, fy + 1, 2, 1);
      }

      const pc = colors[i % colors.length];
      if (i % 3 === 0) {
        g.fillStyle(pc, 0.8);
        g.fillCircle(fx - 1.5, fy - 2, 1.5);
        g.fillCircle(fx + 1.5, fy - 2, 1.5);
        g.fillCircle(fx, fy - 3.5, 1.5);
        g.fillCircle(fx, fy - 0.5, 1.5);
      } else {
        g.fillStyle(pc, 1);
        g.fillCircle(fx, fy - 2, 2);
      }
      g.fillStyle(0xffee58, 1);
      g.fillCircle(fx, fy - 2, 1);
    }

    g.generateTexture('deco-flower', 30, 16);
    g.destroy();
  }

  // Lamp post (18×36)
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = 9;
    const baseY = 30;

    g.fillStyle(0x555555, 1);
    g.fillRect(cx - 2, baseY - 2, 4, 3);
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(cx - 1, baseY - 22, 2, 20);
    g.fillStyle(0x666666, 0.5);
    g.fillRect(cx, baseY - 22, 1, 20);
    g.fillStyle(0x555555, 1);
    g.fillRect(cx - 4, baseY - 22, 8, 2);
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(cx - 4, baseY - 28, 8, 2);
    g.fillStyle(0xfff8e0, 0.95);
    g.fillRect(cx - 3, baseY - 26, 6, 4);
    g.fillStyle(0xffee88, 0.6);
    g.fillRect(cx - 2, baseY - 25, 4, 2);
    g.fillStyle(0xfff8c0, 0.12);
    g.fillCircle(cx, baseY - 24, 10);
    g.fillStyle(0xfff8c0, 0.06);
    g.fillCircle(cx, baseY - 24, 16);

    g.generateTexture('deco-lamp', 18, 36);
    g.destroy();
  }

  // Fountain (38×28)
  {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const cx = 19;
    const baseY = 18;

    g.fillStyle(0xc0c0c0, 0.9);
    g.fillEllipse(cx, baseY + 1, 30, 13);
    g.fillStyle(0x88c0e8, 0.65);
    g.fillEllipse(cx, baseY, 26, 11);
    g.fillStyle(0xa0d8f0, 0.4);
    g.fillEllipse(cx - 3, baseY - 1, 10, 4);
    g.lineStyle(2, 0xa0a0a0, 0.8);
    g.strokeEllipse(cx, baseY + 1, 30, 13);

    g.fillStyle(0xc0c0c0, 1);
    g.fillRect(cx - 2, baseY - 14, 4, 14);
    g.fillStyle(0xd0d0d0, 0.5);
    g.fillRect(cx, baseY - 14, 1, 14);
    g.fillStyle(0xb0b0b0, 1);
    g.fillEllipse(cx, baseY - 14, 10, 4);
    g.fillStyle(0x88c0e8, 0.8);
    g.fillEllipse(cx, baseY - 14.5, 8, 3);
    g.fillStyle(0xa8d8f8, 0.5);
    g.fillEllipse(cx - 1, baseY - 15, 4, 1.5);

    g.lineStyle(1, 0x88c0e8, 0.5);
    g.beginPath();
    g.arc(cx - 6, baseY - 12, 6, -Math.PI * 0.7, -Math.PI * 0.2);
    g.strokePath();
    g.beginPath();
    g.arc(cx + 6, baseY - 12, 6, -Math.PI * 0.8, -Math.PI * 0.3);
    g.strokePath();

    g.fillStyle(0xa0d8f0, 0.5);
    g.fillCircle(cx - 8, baseY - 6, 1.5);
    g.fillCircle(cx + 8, baseY - 7, 1.5);
    g.fillCircle(cx - 5, baseY - 4, 1);
    g.fillCircle(cx + 6, baseY - 3, 1);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(cx + 3, baseY - 15, 1);
    g.fillCircle(cx - 4, baseY + 1, 1);
    g.fillCircle(cx + 7, baseY - 1, 0.8);

    g.generateTexture('deco-fountain', 38, 28);
    g.destroy();
  }
}

// ─── Emote Textures ─────────────────────────────────────────────
function generateEmoteTextures(scene: Phaser.Scene): void {
  const emoteTypes = ['heart', 'music', 'star', 'zzz', 'happy'];
  const W = 18;
  const H = 22;

  for (const emote of emoteTypes) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const ex = W / 2;
    const ey = H / 2 - 1;

    // Speech bubble
    g.fillStyle(0xffffff, 0.92);
    g.fillRoundedRect(ex - 7, ey - 7, 14, 14, 3);
    g.fillTriangle(ex - 2, ey + 6, ex + 2, ey + 6, ex, ey + 9);
    g.lineStyle(1, 0xcccccc, 0.5);
    g.strokeRoundedRect(ex - 7, ey - 7, 14, 14, 3);

    switch (emote) {
      case 'heart':
        g.fillStyle(0xff4466, 1);
        g.fillRect(ex - 4, ey - 3, 2, 2);
        g.fillRect(ex + 2, ey - 3, 2, 2);
        g.fillRect(ex - 5, ey - 1, 2, 2);
        g.fillRect(ex + 3, ey - 1, 2, 2);
        g.fillRect(ex - 4, ey + 1, 8, 2);
        g.fillRect(ex - 3, ey + 3, 6, 1);
        g.fillRect(ex - 1, ey + 4, 2, 1);
        g.fillStyle(0xff8899, 0.7);
        g.fillRect(ex - 3, ey - 2, 1, 1);
        break;
      case 'music':
        g.fillStyle(0x6688cc, 1);
        g.fillRect(ex - 1, ey - 4, 2, 7);
        g.fillRect(ex + 1, ey - 5, 2, 2);
        g.fillRect(ex + 2, ey - 4, 1, 1);
        g.fillCircle(ex - 1, ey + 3, 2);
        g.fillStyle(0x88aaee, 0.6);
        g.fillCircle(ex - 1, ey + 2, 1);
        break;
      case 'star':
        g.fillStyle(0xffcc00, 1);
        g.fillRect(ex - 1, ey - 4, 2, 2);
        g.fillRect(ex - 4, ey - 2, 8, 2);
        g.fillRect(ex - 3, ey, 6, 2);
        g.fillRect(ex - 2, ey + 2, 1, 1);
        g.fillRect(ex + 1, ey + 2, 1, 1);
        g.fillStyle(0xffee66, 0.7);
        g.fillRect(ex, ey - 1, 1, 1);
        break;
      case 'zzz':
        g.fillStyle(0x8888cc, 1);
        g.fillRect(ex - 3, ey - 3, 5, 1);
        g.fillRect(ex + 1, ey - 2, 1, 1);
        g.fillRect(ex, ey - 1, 1, 1);
        g.fillRect(ex - 1, ey, 1, 1);
        g.fillRect(ex - 3, ey + 1, 5, 1);
        g.fillStyle(0x8888cc, 0.6);
        g.fillRect(ex + 2, ey - 5, 3, 1);
        g.fillRect(ex + 3, ey - 4, 1, 1);
        g.fillRect(ex + 2, ey - 3, 3, 1);
        break;
      case 'happy':
        g.fillStyle(0xffcc00, 1);
        g.fillCircle(ex, ey, 5);
        g.fillStyle(0xe8b800, 1);
        g.fillCircle(ex, ey, 3.5);
        g.fillStyle(0xffcc00, 1);
        g.fillCircle(ex, ey - 0.5, 3);
        g.fillStyle(0x332200, 1);
        g.fillRect(ex - 2, ey - 2, 1, 1);
        g.fillRect(ex + 1, ey - 2, 1, 1);
        g.fillRect(ex - 2, ey + 1, 1, 1);
        g.fillRect(ex - 1, ey + 2, 3, 1);
        g.fillRect(ex + 2, ey + 1, 1, 1);
        break;
    }

    g.generateTexture(`emote-${emote}`, W, H);
    g.destroy();
  }
}

// ─── Phaser Animations ──────────────────────────────────────────
function createCharacterAnimations(scene: Phaser.Scene): void {
  const names = ['blue', 'orange', 'green'];
  for (const name of names) {
    scene.anims.create({
      key: `char-${name}-walk`,
      frames: [
        { key: `char-${name}-0` },
        { key: `char-${name}-1` },
        { key: `char-${name}-2` },
        { key: `char-${name}-3` },
      ],
      frameRate: 5,
      repeat: -1,
    });
  }
}
