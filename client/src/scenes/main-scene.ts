import Phaser from 'phaser';

// ─── Interfaces ───────────────────────────────────────────────
interface IsoBuilding {
  gridX: number;
  gridY: number;
  tilesW: number;
  tilesH: number;
  wallHeight: number;
  name: string;
  nameKR: string;
  roofColor: number;
  roofColorDark: number;
  wallLeft: number;
  wallRight: number;
  detail: string; // 'house' | 'kitchen' | 'bank' | 'warehouse' | 'rest' | 'hospital'
}

interface IsoCharacter {
  gfx: Phaser.GameObjects.Graphics;
  gridX: number;
  gridY: number;
  screenX: number;
  screenY: number;
  color: number;
  colorDark: number;
  colorLight: number;
  skinColor: number;
  currentWP: number;
  waypoints: { gx: number; gy: number }[];
  bobOffset: number;
  label: string;
}

interface Decoration {
  type: 'tree' | 'flower' | 'lamp' | 'fountain';
  gridX: number;
  gridY: number;
}

// ─── Color helpers ────────────────────────────────────────────
function darken(c: number, amount: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) - amount);
  const g = Math.max(0, ((c >> 8) & 0xff) - amount);
  const b = Math.max(0, (c & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

// ─── Scene ────────────────────────────────────────────────────
export class MainScene extends Phaser.Scene {
  // Grid constants
  private readonly TILE_W = 64;
  private readonly TILE_H = 32;
  private readonly GRID_SIZE = 10;
  private centerX = 0;
  private offsetY = 0;

  // State
  private buildings: IsoBuilding[] = [];
  private characters: IsoCharacter[] = [];
  private decorations: Decoration[] = [];
  private currentDay = 1;

  // Layers
  private groundGfx!: Phaser.GameObjects.Graphics;
  private buildingContainer!: Phaser.GameObjects.Container;
  private decoContainer!: Phaser.GameObjects.Container;
  private uiContainer!: Phaser.GameObjects.Container;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private tooltipContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // All procedural - no assets to load
  }

  create(): void {
    const { width, height } = this.scale;
    this.centerX = width / 2;
    this.offsetY = 60;

    this.cameras.main.setBackgroundColor('#fef9f0');

    // Create layered containers for depth
    this.groundGfx = this.add.graphics().setDepth(0);
    this.decoContainer = this.add.container(0, 0).setDepth(1);
    this.buildingContainer = this.add.container(0, 0).setDepth(2);
    this.particleGfx = this.add.graphics().setDepth(4);
    this.tooltipContainer = this.add.container(0, 0).setDepth(50);
    this.uiContainer = this.add.container(0, 0).setDepth(100);

    this.drawGround();
    this.createDecorations();
    this.drawDecorations();
    this.createBuildings();
    this.drawBuildings();
    this.createCharacters();
    this.drawUIOverlay(width);
    this.createAmbientParticles(width, height);
    this.setupInput();
    this.animateCharacters();
  }

  // ─── Coordinate conversion ────────────────────────────────────
  private toScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: (gx - gy) * (this.TILE_W / 2) + this.centerX,
      y: (gx + gy) * (this.TILE_H / 2) + this.offsetY,
    };
  }

  private toGrid(screenX: number, screenY: number): { gx: number; gy: number } {
    const sx = screenX - this.centerX;
    const sy = screenY - this.offsetY;
    const gx = (sx / (this.TILE_W / 2) + sy / (this.TILE_H / 2)) / 2;
    const gy = (sy / (this.TILE_H / 2) - sx / (this.TILE_W / 2)) / 2;
    return { gx: Math.floor(gx), gy: Math.floor(gy) };
  }

  private isoDepth(gx: number, gy: number): number {
    return (gx + gy) * 10;
  }

  // ─── Ground tiles ─────────────────────────────────────────────
  private drawGround(): void {
    const g = this.groundGfx;
    g.clear();

    // Walkway positions (set for a nice path network)
    const walkwaySet = new Set<string>();
    // Horizontal path at row 4
    for (let x = 0; x < this.GRID_SIZE; x++) walkwaySet.add(`${x},4`);
    // Vertical path at col 4
    for (let y = 0; y < this.GRID_SIZE; y++) walkwaySet.add(`4,${y}`);
    // Cross path at row 7
    for (let x = 2; x < 8; x++) walkwaySet.add(`${x},7`);
    // Extra connector
    for (let y = 4; y < 8; y++) walkwaySet.add(`7,${y}`);

    const grassColors = [0xa8d5a2, 0x8ec986, 0xb8deb2];
    const walkColors = [0xe8d5b8, 0xdcc9a8];

    for (let gx = 0; gx < this.GRID_SIZE; gx++) {
      for (let gy = 0; gy < this.GRID_SIZE; gy++) {
        const { x: sx, y: sy } = this.toScreen(gx, gy);
        const isWalk = walkwaySet.has(`${gx},${gy}`);
        const colorIdx = (gx * 3 + gy * 7) % (isWalk ? walkColors.length : grassColors.length);
        const color = isWalk ? walkColors[colorIdx] : grassColors[colorIdx];

        // Draw diamond tile
        g.fillStyle(color, 1);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + this.TILE_W / 2, sy + this.TILE_H / 2);
        g.lineTo(sx, sy + this.TILE_H);
        g.lineTo(sx - this.TILE_W / 2, sy + this.TILE_H / 2);
        g.closePath();
        g.fillPath();

        // Subtle outline
        g.lineStyle(1, 0x90b88a, 0.15);
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + this.TILE_W / 2, sy + this.TILE_H / 2);
        g.lineTo(sx, sy + this.TILE_H);
        g.lineTo(sx - this.TILE_W / 2, sy + this.TILE_H / 2);
        g.closePath();
        g.strokePath();
      }
    }
  }

  // ─── Buildings ────────────────────────────────────────────────
  private createBuildings(): void {
    this.buildings = [
      {
        gridX: 1, gridY: 1, tilesW: 1, tilesH: 1, wallHeight: 28,
        name: 'House', nameKR: '집',
        roofColor: 0xff9eae, roofColorDark: 0xe88898,
        wallLeft: 0xd4c0a8, wallRight: 0xe8d5be,
        detail: 'house',
      },
      {
        gridX: 5, gridY: 1, tilesW: 2, tilesH: 2, wallHeight: 38,
        name: 'Kitchen', nameKR: '주방',
        roofColor: 0xff8a4c, roofColorDark: 0xe87040,
        wallLeft: 0xd4a878, wallRight: 0xe8c090,
        detail: 'kitchen',
      },
      {
        gridX: 1, gridY: 5, tilesW: 2, tilesH: 1, wallHeight: 34,
        name: 'Bank', nameKR: '은행',
        roofColor: 0xffd700, roofColorDark: 0xe8c200,
        wallLeft: 0xd8d0c0, wallRight: 0xf0e8d8,
        detail: 'bank',
      },
      {
        gridX: 5, gridY: 5, tilesW: 3, tilesH: 1, wallHeight: 30,
        name: 'Warehouse', nameKR: '물류센터',
        roofColor: 0x8b6f47, roofColorDark: 0x755d3a,
        wallLeft: 0x907860, wallRight: 0xa89078,
        detail: 'warehouse',
      },
      {
        gridX: 1, gridY: 8, tilesW: 2, tilesH: 2, wallHeight: 32,
        name: 'Rest Area', nameKR: '휴식시설',
        roofColor: 0x7ecfc0, roofColorDark: 0x68b8a8,
        wallLeft: 0xb8d0c8, wallRight: 0xd0e0d8,
        detail: 'rest',
      },
      {
        gridX: 6, gridY: 8, tilesW: 2, tilesH: 1, wallHeight: 36,
        name: 'Hospital', nameKR: '정신병원',
        roofColor: 0xffffff, roofColorDark: 0xe8e8e8,
        wallLeft: 0xd8d8d8, wallRight: 0xf0f0f0,
        detail: 'hospital',
      },
    ];
  }

  private drawBuildings(): void {
    // Sort buildings by depth (back to front)
    const sorted = [...this.buildings].sort(
      (a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY)
    );

    for (const b of sorted) {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      this.drawIsoBuilding(gfx, b);
      gfx.setDepth(this.isoDepth(b.gridX + b.tilesW, b.gridY + b.tilesH));
      this.buildingContainer.add(gfx);
    }
  }

  private drawIsoBuilding(g: Phaser.GameObjects.Graphics, b: IsoBuilding): void {
    // Compute the 4 base corners of the building footprint in screen space
    const topLeft = this.toScreen(b.gridX, b.gridY);
    const topRight = this.toScreen(b.gridX + b.tilesW, b.gridY);
    const bottomRight = this.toScreen(b.gridX + b.tilesW, b.gridY + b.tilesH);
    const bottomLeft = this.toScreen(b.gridX, b.gridY + b.tilesH);

    const wh = b.wallHeight;

    // ─── Shadow beneath building ─────────────────────────────
    g.fillStyle(0x000000, 0.08);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y + 4);
    g.lineTo(topRight.x + 4, topRight.y + 4);
    g.lineTo(bottomRight.x + 4, bottomRight.y + 6);
    g.lineTo(bottomLeft.x, bottomLeft.y + 6);
    g.closePath();
    g.fillPath();

    // ─── Left face (parallelogram) ───────────────────────────
    g.fillStyle(b.wallLeft, 1);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y - wh);         // top-left raised
    g.lineTo(bottomLeft.x, bottomLeft.y - wh);    // bottom-left raised
    g.lineTo(bottomLeft.x, bottomLeft.y);          // bottom-left ground
    g.lineTo(topLeft.x, topLeft.y);                // top-left ground
    g.closePath();
    g.fillPath();

    // Left face outline
    g.lineStyle(1, darken(b.wallLeft, 40), 0.4);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y - wh);
    g.lineTo(bottomLeft.x, bottomLeft.y - wh);
    g.lineTo(bottomLeft.x, bottomLeft.y);
    g.lineTo(topLeft.x, topLeft.y);
    g.closePath();
    g.strokePath();

    // ─── Right face (parallelogram) ──────────────────────────
    g.fillStyle(b.wallRight, 1);
    g.beginPath();
    g.moveTo(bottomLeft.x, bottomLeft.y - wh);    // front-left raised
    g.lineTo(bottomRight.x, bottomRight.y - wh);   // front-right raised
    g.lineTo(bottomRight.x, bottomRight.y);         // front-right ground
    g.lineTo(bottomLeft.x, bottomLeft.y);           // front-left ground
    g.closePath();
    g.fillPath();

    // Right face outline
    g.lineStyle(1, darken(b.wallRight, 40), 0.4);
    g.beginPath();
    g.moveTo(bottomLeft.x, bottomLeft.y - wh);
    g.lineTo(bottomRight.x, bottomRight.y - wh);
    g.lineTo(bottomRight.x, bottomRight.y);
    g.lineTo(bottomLeft.x, bottomLeft.y);
    g.closePath();
    g.strokePath();

    // ─── Top face (roof diamond) ─────────────────────────────
    g.fillStyle(b.roofColor, 1);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y - wh);           // left
    g.lineTo(topRight.x, topRight.y - wh);          // top
    g.lineTo(bottomRight.x, bottomRight.y - wh);    // right
    g.lineTo(bottomLeft.x, bottomLeft.y - wh);      // bottom
    g.closePath();
    g.fillPath();

    // Roof outline
    g.lineStyle(1, b.roofColorDark, 0.5);
    g.beginPath();
    g.moveTo(topLeft.x, topLeft.y - wh);
    g.lineTo(topRight.x, topRight.y - wh);
    g.lineTo(bottomRight.x, bottomRight.y - wh);
    g.lineTo(bottomLeft.x, bottomLeft.y - wh);
    g.closePath();
    g.strokePath();

    // ─── Details per building type ───────────────────────────
    switch (b.detail) {
      case 'house':
        this.drawHouseDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
      case 'kitchen':
        this.drawKitchenDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
      case 'bank':
        this.drawBankDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
      case 'warehouse':
        this.drawWarehouseDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
      case 'rest':
        this.drawRestAreaDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
      case 'hospital':
        this.drawHospitalDetails(g, b, topLeft, topRight, bottomLeft, bottomRight, wh);
        break;
    }
  }

  private drawHouseDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Door on right (front) face
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x8b6f47, 1);
    g.fillRect(doorCX - 4, doorCY - wh * 0.45, 8, wh * 0.4);
    // Door knob
    g.fillStyle(0xffd700, 1);
    g.fillCircle(doorCX + 2, doorCY - wh * 0.28, 1.5);

    // Window on left face
    const winLX = (tl.x + bl.x) / 2;
    const winLY = (tl.y + bl.y) / 2 - wh * 0.55;
    g.fillStyle(0x87ceeb, 0.8);
    g.fillRect(winLX - 5, winLY, 10, 8);
    g.lineStyle(1, 0x6a5040, 0.6);
    g.strokeRect(winLX - 5, winLY, 10, 8);
    // Window cross
    g.beginPath();
    g.moveTo(winLX, winLY);
    g.lineTo(winLX, winLY + 8);
    g.moveTo(winLX - 5, winLY + 4);
    g.lineTo(winLX + 5, winLY + 4);
    g.strokePath();

    // Chimney on roof
    const chimneyX = (tl.x + tr.x) / 2 + 5;
    const chimneyY = (tl.y + tr.y) / 2 - wh - 2;
    g.fillStyle(0xb0856a, 1);
    g.fillRect(chimneyX - 3, chimneyY - 10, 6, 12);
    g.fillStyle(0xc9a088, 1);
    g.fillRect(chimneyX - 4, chimneyY - 11, 8, 3);

    // Smoke puffs
    g.fillStyle(0xdddddd, 0.4);
    g.fillCircle(chimneyX, chimneyY - 14, 3);
    g.fillCircle(chimneyX - 2, chimneyY - 18, 2.5);
    g.fillCircle(chimneyX + 1, chimneyY - 21, 2);
  }

  private drawKitchenDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Two windows on left face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xffeebb, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x8b6f47, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      // Cross
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4);
      g.lineTo(wx + 5, wy + 4);
      g.strokePath();
    }

    // Two windows on right (front) face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = bl.x + (br.x - bl.x) * t;
      const wy = bl.y + (br.y - bl.y) * t - wh * 0.55;
      g.fillStyle(0xffeebb, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x8b6f47, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4);
      g.lineTo(wx + 5, wy + 4);
      g.strokePath();
    }

    // Big door on front face
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x8b6040, 1);
    g.fillRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);
    g.lineStyle(1, 0x6a4530, 0.6);
    g.strokeRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);

    // Chimney with steam
    const chimneyX = tr.x - 8;
    const chimneyY = tr.y - wh - 2;
    g.fillStyle(0xa06848, 1);
    g.fillRect(chimneyX - 3, chimneyY - 12, 6, 14);
    g.fillStyle(0xb87858, 1);
    g.fillRect(chimneyX - 4, chimneyY - 13, 8, 3);

    // Steam puffs (more than house)
    g.fillStyle(0xeeeeee, 0.35);
    g.fillCircle(chimneyX, chimneyY - 16, 3.5);
    g.fillCircle(chimneyX + 2, chimneyY - 20, 3);
    g.fillCircle(chimneyX - 1, chimneyY - 24, 2.5);
    g.fillCircle(chimneyX + 1, chimneyY - 27, 2);

    // Roof decoration: small flag
    const flagX = (tl.x + tr.x) / 2;
    const flagY = (tl.y + tr.y) / 2 - wh;
    g.lineStyle(1, 0x6a4530, 1);
    g.beginPath();
    g.moveTo(flagX, flagY);
    g.lineTo(flagX, flagY - 10);
    g.strokePath();
    g.fillStyle(0xff6644, 1);
    g.fillTriangle(flagX, flagY - 10, flagX + 6, flagY - 8, flagX, flagY - 6);
  }

  private drawBankDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Columns on the front (right) face
    for (let i = 0; i < 3; i++) {
      const t = 0.2 + i * 0.3;
      const cx = bl.x + (br.x - bl.x) * t;
      const cy = bl.y + (br.y - bl.y) * t;
      // Column
      g.fillStyle(0xe8e0d0, 1);
      g.fillRect(cx - 2, cy - wh * 0.85, 4, wh * 0.8);
      // Column capital
      g.fillStyle(0xffd700, 0.8);
      g.fillRect(cx - 3, cy - wh * 0.87, 6, 3);
      // Column base
      g.fillRect(cx - 3, cy - wh * 0.08, 6, 3);
    }

    // Windows on left face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xf0e8a0, 0.8);
      g.fillRect(wx - 5, wy, 10, 10);
      g.lineStyle(1, 0xc8b040, 0.6);
      g.strokeRect(wx - 5, wy, 10, 10);
      // Arch top
      g.beginPath();
      g.arc(wx, wy, 5, Math.PI, 0);
      g.strokePath();
    }

    // Grand door
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0xc8a040, 1);
    g.fillRect(doorCX - 7, doorCY - wh * 0.5, 14, wh * 0.45);
    g.lineStyle(1, 0xa08030, 0.8);
    g.strokeRect(doorCX - 7, doorCY - wh * 0.5, 14, wh * 0.45);
    // Door arch
    g.beginPath();
    g.arc(doorCX, doorCY - wh * 0.5, 7, Math.PI, 0);
    g.fillStyle(0xd8b050, 1);
    g.fillPath();

    // Gold coin symbol on roof
    const coinX = (tl.x + br.x) / 2;
    const coinY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0xffd700, 1);
    g.fillCircle(coinX, coinY - 2, 5);
    g.fillStyle(0xe8c200, 1);
    g.fillCircle(coinX, coinY - 2, 3);
    // Dollar sign
    g.lineStyle(1, 0xc8a000, 1);
    g.beginPath();
    g.moveTo(coinX, coinY - 5);
    g.lineTo(coinX, coinY + 1);
    g.strokePath();
  }

  private drawWarehouseDetails(
    g: Phaser.GameObjects.Graphics, b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Wooden plank lines on left face
    g.lineStyle(1, darken(b.wallLeft, 20), 0.3);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.beginPath();
      g.moveTo(tl.x, tl.y - wh + (wh * t));
      g.lineTo(bl.x, bl.y - wh + (wh * t));
      g.strokePath();
    }

    // Wooden plank lines on right face
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.beginPath();
      g.moveTo(bl.x, bl.y - wh + (wh * t));
      g.lineTo(br.x, br.y - wh + (wh * t));
      g.strokePath();
    }

    // Large door (warehouse gate)
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x6a5438, 1);
    g.fillRect(doorCX - 10, doorCY - wh * 0.65, 20, wh * 0.6);
    g.lineStyle(1, 0x504028, 0.7);
    g.strokeRect(doorCX - 10, doorCY - wh * 0.65, 20, wh * 0.6);
    // Cross brace on door
    g.beginPath();
    g.moveTo(doorCX - 10, doorCY - wh * 0.65);
    g.lineTo(doorCX + 10, doorCY - wh * 0.05);
    g.moveTo(doorCX + 10, doorCY - wh * 0.65);
    g.lineTo(doorCX - 10, doorCY - wh * 0.05);
    g.strokePath();

    // Small crate next to building
    const crateX = br.x + 6;
    const crateY = br.y - 4;
    g.fillStyle(0xa08050, 1);
    g.fillRect(crateX - 5, crateY - 8, 10, 8);
    g.lineStyle(1, 0x705830, 0.6);
    g.strokeRect(crateX - 5, crateY - 8, 10, 8);
    g.beginPath();
    g.moveTo(crateX, crateY - 8);
    g.lineTo(crateX, crateY);
    g.moveTo(crateX - 5, crateY - 4);
    g.lineTo(crateX + 5, crateY - 4);
    g.strokePath();
  }

  private drawRestAreaDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Windows on left face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xb0eedd, 0.8);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x68b8a8, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      // Curtain tops
      g.fillStyle(0x96ddd0, 0.6);
      g.fillRect(wx - 5, wy, 10, 2);
    }

    // Windows on front face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = bl.x + (br.x - bl.x) * t;
      const wy = bl.y + (br.y - bl.y) * t - wh * 0.55;
      g.fillStyle(0xb0eedd, 0.8);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x68b8a8, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.fillStyle(0x96ddd0, 0.6);
      g.fillRect(wx - 5, wy, 10, 2);
    }

    // Door with a plant beside it
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x68b8a8, 1);
    g.fillRect(doorCX - 5, doorCY - wh * 0.45, 10, wh * 0.4);
    g.lineStyle(1, 0x508878, 0.6);
    g.strokeRect(doorCX - 5, doorCY - wh * 0.45, 10, wh * 0.4);

    // Small potted plant near door
    const plantX = doorCX + 10;
    const plantY = doorCY - wh * 0.08;
    g.fillStyle(0x8b6040, 1);
    g.fillRect(plantX - 3, plantY - 4, 6, 5);
    g.fillStyle(0x4caf50, 1);
    g.fillCircle(plantX, plantY - 7, 4);
    g.fillStyle(0x66bb6a, 1);
    g.fillCircle(plantX - 2, plantY - 9, 3);
    g.fillCircle(plantX + 2, plantY - 8, 3);

    // Flower patches near building base
    const flowerColors = [0xff9eae, 0xffd700, 0xff8a4c, 0xffb3c1];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const fx = bl.x - 10 + Math.cos(angle) * 8;
      const fy = bl.y + 3 + Math.sin(angle) * 4;
      g.fillStyle(flowerColors[i % flowerColors.length], 0.9);
      g.fillCircle(fx, fy, 2);
    }

    // Roof garden feel - small leaf symbols on roof
    const roofCX = (tl.x + br.x) / 2;
    const roofCY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0x4caf50, 0.4);
    g.fillCircle(roofCX - 5, roofCY + 1, 3);
    g.fillCircle(roofCX + 5, roofCY - 1, 3);
    g.fillCircle(roofCX, roofCY - 3, 2.5);
  }

  private drawHospitalDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number
  ): void {
    // Windows on left face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xd0eeff, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0xaabbcc, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      // Cross
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4);
      g.lineTo(wx + 5, wy + 4);
      g.strokePath();
    }

    // Windows on front face
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = bl.x + (br.x - bl.x) * t;
      const wy = bl.y + (br.y - bl.y) * t - wh * 0.55;
      g.fillStyle(0xd0eeff, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0xaabbcc, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4);
      g.lineTo(wx + 5, wy + 4);
      g.strokePath();
    }

    // Door
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0xdddddd, 1);
    g.fillRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);
    g.lineStyle(1, 0xbbbbbb, 0.6);
    g.strokeRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);
    // Double door line
    g.beginPath();
    g.moveTo(doorCX, doorCY - wh * 0.45);
    g.lineTo(doorCX, doorCY - wh * 0.05);
    g.strokePath();

    // Red cross on roof
    const crossX = (tl.x + br.x) / 2;
    const crossY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0xff6b6b, 1);
    g.fillRect(crossX - 2, crossY - 6, 4, 12);
    g.fillRect(crossX - 6, crossY - 2, 12, 4);

    // Red cross on front wall (visible)
    const wallCrossX = (bl.x + br.x) / 2;
    const wallCrossY = (bl.y + br.y) / 2 - wh * 0.78;
    g.fillStyle(0xff6b6b, 0.8);
    g.fillRect(wallCrossX - 1.5, wallCrossY - 4, 3, 8);
    g.fillRect(wallCrossX - 4, wallCrossY - 1.5, 8, 3);
  }

  // ─── Decorations ──────────────────────────────────────────────
  private createDecorations(): void {
    this.decorations = [
      // Trees
      { type: 'tree', gridX: 0, gridY: 0 },
      { type: 'tree', gridX: 9, gridY: 0 },
      { type: 'tree', gridX: 0, gridY: 9 },
      { type: 'tree', gridX: 9, gridY: 9 },
      { type: 'tree', gridX: 3, gridY: 3 },
      { type: 'tree', gridX: 8, gridY: 3 },
      { type: 'tree', gridX: 3, gridY: 6 },
      // Flowers
      { type: 'flower', gridX: 0, gridY: 3 },
      { type: 'flower', gridX: 3, gridY: 0 },
      { type: 'flower', gridX: 9, gridY: 6 },
      { type: 'flower', gridX: 8, gridY: 9 },
      { type: 'flower', gridX: 0, gridY: 6 },
      // Lamps
      { type: 'lamp', gridX: 4, gridY: 2 },
      { type: 'lamp', gridX: 4, gridY: 6 },
      { type: 'lamp', gridX: 4, gridY: 9 },
      { type: 'lamp', gridX: 2, gridY: 4 },
      { type: 'lamp', gridX: 6, gridY: 4 },
      // Fountain
      { type: 'fountain', gridX: 4, gridY: 4 },
    ];
  }

  private drawDecorations(): void {
    // Sort decorations by depth
    const sorted = [...this.decorations].sort(
      (a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY)
    );

    for (const d of sorted) {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      const { x: sx, y: sy } = this.toScreen(d.gridX, d.gridY);
      const depth = this.isoDepth(d.gridX, d.gridY) + 5;

      switch (d.type) {
        case 'tree':
          this.drawTree(gfx, sx, sy);
          break;
        case 'flower':
          this.drawFlowerPatch(gfx, sx, sy);
          break;
        case 'lamp':
          this.drawLampPost(gfx, sx, sy);
          break;
        case 'fountain':
          this.drawFountain(gfx, sx, sy);
          break;
      }

      gfx.setDepth(depth);
      this.decoContainer.add(gfx);
    }
  }

  private drawTree(g: Phaser.GameObjects.Graphics, sx: number, sy: number): void {
    const baseY = sy + this.TILE_H / 2;

    // Shadow
    g.fillStyle(0x000000, 0.06);
    g.fillEllipse(sx, baseY + 2, 16, 6);

    // Trunk
    g.fillStyle(0x8b6f47, 1);
    g.fillRect(sx - 2, baseY - 18, 4, 18);

    // Foliage layers (round canopy, isometric style)
    g.fillStyle(0x5ba84c, 1);
    g.fillCircle(sx, baseY - 22, 10);
    g.fillStyle(0x6ec45e, 1);
    g.fillCircle(sx - 3, baseY - 25, 8);
    g.fillCircle(sx + 3, baseY - 24, 8);
    g.fillStyle(0x7ed66e, 1);
    g.fillCircle(sx, baseY - 28, 7);

    // Highlights
    g.fillStyle(0x9ee88e, 0.5);
    g.fillCircle(sx - 2, baseY - 30, 3);
  }

  private drawFlowerPatch(g: Phaser.GameObjects.Graphics, sx: number, sy: number): void {
    const baseY = sy + this.TILE_H / 2;
    const colors = [0xff9eae, 0xffd700, 0xffb3c1, 0xff8a4c, 0x7ecfc0];

    // Small grass base
    g.fillStyle(0x8ec986, 0.6);
    g.fillEllipse(sx, baseY, 14, 6);

    // Flowers
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3;
      const r = 4 + (i % 2) * 2;
      const fx = sx + Math.cos(angle) * r;
      const fy = baseY + Math.sin(angle) * (r * 0.4) - 2;

      // Stem
      g.lineStyle(1, 0x4caf50, 0.8);
      g.beginPath();
      g.moveTo(fx, fy + 2);
      g.lineTo(fx, fy - 1);
      g.strokePath();

      // Petal
      g.fillStyle(colors[i % colors.length], 1);
      g.fillCircle(fx, fy - 2, 2);

      // Center
      g.fillStyle(0xffee58, 1);
      g.fillCircle(fx, fy - 2, 1);
    }
  }

  private drawLampPost(g: Phaser.GameObjects.Graphics, sx: number, sy: number): void {
    const baseY = sy + this.TILE_H / 2;

    // Shadow
    g.fillStyle(0x000000, 0.05);
    g.fillEllipse(sx, baseY + 1, 8, 3);

    // Post
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(sx - 1, baseY - 20, 2, 20);

    // Lamp base
    g.fillStyle(0x5a5a5a, 1);
    g.fillRect(sx - 3, baseY - 21, 6, 2);

    // Lamp glass
    g.fillStyle(0xfff8e0, 0.9);
    g.fillRect(sx - 3, baseY - 26, 6, 5);

    // Lamp top
    g.fillStyle(0x4a4a4a, 1);
    g.fillRect(sx - 4, baseY - 27, 8, 2);

    // Glow
    g.fillStyle(0xfff8c0, 0.15);
    g.fillCircle(sx, baseY - 23, 8);
  }

  private drawFountain(g: Phaser.GameObjects.Graphics, sx: number, sy: number): void {
    const baseY = sy + this.TILE_H / 2;

    // Base pool (isometric ellipse)
    g.fillStyle(0xc0d8e8, 0.7);
    g.fillEllipse(sx, baseY, 28, 12);

    // Water surface
    g.fillStyle(0x88c0e8, 0.6);
    g.fillEllipse(sx, baseY - 1, 24, 10);

    // Stone rim
    g.lineStyle(2, 0xa0a0a0, 0.8);
    g.strokeEllipse(sx, baseY, 28, 12);

    // Center pillar
    g.fillStyle(0xc0c0c0, 1);
    g.fillRect(sx - 2, baseY - 14, 4, 14);

    // Top bowl
    g.fillStyle(0xb0b0b0, 1);
    g.fillEllipse(sx, baseY - 14, 10, 4);
    g.fillStyle(0x88c0e8, 0.8);
    g.fillEllipse(sx, baseY - 14.5, 8, 3);

    // Water streams (arcs)
    g.lineStyle(1, 0x88c0e8, 0.6);
    // Left stream
    g.beginPath();
    g.arc(sx - 6, baseY - 12, 6, -Math.PI * 0.7, -Math.PI * 0.2);
    g.strokePath();
    // Right stream
    g.beginPath();
    g.arc(sx + 6, baseY - 12, 6, -Math.PI * 0.8, -Math.PI * 0.3);
    g.strokePath();

    // Water droplets
    g.fillStyle(0xa0d8f0, 0.5);
    g.fillCircle(sx - 8, baseY - 6, 1.5);
    g.fillCircle(sx + 8, baseY - 7, 1.5);
    g.fillCircle(sx - 5, baseY - 4, 1);
    g.fillCircle(sx + 6, baseY - 3, 1);

    // Sparkle on water
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(sx + 3, baseY - 15, 1);
    g.fillCircle(sx - 4, baseY + 1, 1);
  }

  // ─── Characters ───────────────────────────────────────────────
  private createCharacters(): void {
    const charDefs = [
      {
        color: 0x4488dd, colorDark: 0x3366bb, colorLight: 0x66aaff,
        skinColor: 0xffe0c0, label: 'Blue',
        waypoints: [
          { gx: 2, gy: 3 }, { gx: 4, gy: 3 }, { gx: 4, gy: 6 },
          { gx: 7, gy: 6 }, { gx: 7, gy: 4 }, { gx: 4, gy: 4 },
          { gx: 2, gy: 4 }, { gx: 2, gy: 3 },
        ],
      },
      {
        color: 0xff8844, colorDark: 0xdd6622, colorLight: 0xffaa66,
        skinColor: 0xffd8b0, label: 'Orange',
        waypoints: [
          { gx: 5, gy: 3 }, { gx: 5, gy: 4 }, { gx: 7, gy: 4 },
          { gx: 7, gy: 7 }, { gx: 4, gy: 7 }, { gx: 4, gy: 4 },
          { gx: 5, gy: 4 }, { gx: 5, gy: 3 },
        ],
      },
      {
        color: 0x44aa66, colorDark: 0x338855, colorLight: 0x66cc88,
        skinColor: 0xffd0a8, label: 'Green',
        waypoints: [
          { gx: 3, gy: 7 }, { gx: 4, gy: 7 }, { gx: 4, gy: 4 },
          { gx: 2, gy: 4 }, { gx: 2, gy: 7 }, { gx: 3, gy: 7 },
        ],
      },
    ];

    for (const def of charDefs) {
      const startPos = this.toScreen(def.waypoints[0].gx + 0.5, def.waypoints[0].gy + 0.5);
      const gfx = this.add.graphics();

      const ch: IsoCharacter = {
        gfx,
        gridX: def.waypoints[0].gx,
        gridY: def.waypoints[0].gy,
        screenX: startPos.x,
        screenY: startPos.y,
        color: def.color,
        colorDark: def.colorDark,
        colorLight: def.colorLight,
        skinColor: def.skinColor,
        currentWP: 0,
        waypoints: def.waypoints,
        bobOffset: 0,
        label: def.label,
      };

      this.characters.push(ch);
      this.drawCharacter(ch);

      // Bob animation
      this.tweens.add({
        targets: ch,
        bobOffset: -2,
        duration: 500 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => this.drawCharacter(ch),
      });
    }
  }

  private drawCharacter(ch: IsoCharacter): void {
    const g = ch.gfx;
    g.clear();

    const x = ch.screenX;
    const y = ch.screenY + ch.bobOffset;

    // Update depth based on approximate grid position
    g.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 8);

    // Shadow
    g.fillStyle(0x000000, 0.1);
    g.fillEllipse(x, ch.screenY + 2, 10, 4);

    // ─── Body (pixel art style using small rects) ──────────────
    const px = 1.5; // pixel size

    // Feet (2 small rects)
    g.fillStyle(ch.colorDark, 1);
    g.fillRect(x - 3 * px, y - 1 * px, 2 * px, 1 * px);
    g.fillRect(x + 1 * px, y - 1 * px, 2 * px, 1 * px);

    // Legs
    g.fillStyle(ch.color, 1);
    g.fillRect(x - 2 * px, y - 3 * px, 2 * px, 2 * px);
    g.fillRect(x + 0 * px, y - 3 * px, 2 * px, 2 * px);

    // Body (torso)
    g.fillStyle(ch.color, 1);
    g.fillRect(x - 3 * px, y - 7 * px, 6 * px, 4 * px);

    // Body lighter stripe
    g.fillStyle(ch.colorLight, 1);
    g.fillRect(x - 1 * px, y - 7 * px, 2 * px, 4 * px);

    // Arms
    g.fillStyle(ch.color, 1);
    g.fillRect(x - 4 * px, y - 6 * px, 1 * px, 3 * px);
    g.fillRect(x + 3 * px, y - 6 * px, 1 * px, 3 * px);

    // Hands
    g.fillStyle(ch.skinColor, 1);
    g.fillRect(x - 4 * px, y - 3 * px, 1 * px, 1 * px);
    g.fillRect(x + 3 * px, y - 3 * px, 1 * px, 1 * px);

    // Head (round - slightly larger than body for cute proportions)
    g.fillStyle(ch.skinColor, 1);
    g.fillRect(x - 3 * px, y - 12 * px, 6 * px, 5 * px);
    // Round top of head
    g.fillRect(x - 2 * px, y - 13 * px, 4 * px, 1 * px);

    // Hair
    g.fillStyle(ch.colorDark, 1);
    g.fillRect(x - 3 * px, y - 13 * px, 6 * px, 2 * px);
    g.fillRect(x - 4 * px, y - 12 * px, 1 * px, 2 * px);
    g.fillRect(x + 3 * px, y - 12 * px, 1 * px, 2 * px);

    // Eyes (cute dot eyes)
    g.fillStyle(0x2a2a2a, 1);
    g.fillRect(x - 2 * px, y - 10 * px, 1 * px, 1 * px);
    g.fillRect(x + 1 * px, y - 10 * px, 1 * px, 1 * px);

    // Blush (cute cheek marks)
    g.fillStyle(0xffaaaa, 0.5);
    g.fillRect(x - 3 * px, y - 9 * px, 1 * px, 1 * px);
    g.fillRect(x + 2 * px, y - 9 * px, 1 * px, 1 * px);

    // Mouth (small smile)
    g.fillStyle(0xcc8888, 1);
    g.fillRect(x - 0.5 * px, y - 8.5 * px, 1 * px, 0.5 * px);
  }

  private animateCharacters(): void {
    for (let i = 0; i < this.characters.length; i++) {
      this.time.delayedCall(i * 600, () => {
        this.moveCharacterToNextWP(this.characters[i], i);
      });
    }
  }

  private moveCharacterToNextWP(ch: IsoCharacter, index: number): void {
    const nextIdx = (ch.currentWP + 1) % ch.waypoints.length;
    const nextWP = ch.waypoints[nextIdx];
    const target = this.toScreen(nextWP.gx + 0.5, nextWP.gy + 0.5);
    const speed = 1800 + index * 300;

    this.tweens.add({
      targets: ch,
      screenX: target.x,
      screenY: target.y,
      duration: speed,
      ease: 'Linear',
      onUpdate: () => {
        // Update grid position estimate for depth sorting
        const approxGX = nextWP.gx;
        const approxGY = nextWP.gy;
        ch.gridX = approxGX;
        ch.gridY = approxGY;
        this.drawCharacter(ch);
      },
      onComplete: () => {
        ch.currentWP = nextIdx;
        ch.gridX = nextWP.gx;
        ch.gridY = nextWP.gy;
        this.moveCharacterToNextWP(ch, index);
      },
    });
  }

  // ─── UI Overlay ───────────────────────────────────────────────
  private drawUIOverlay(width: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    // Background bar - warm cream with slight transparency
    g.fillStyle(0xfef9f0, 0.92);
    g.fillRoundedRect(4, 4, width - 8, 34, 6);

    // Border (pixel art style - double border)
    g.lineStyle(2, 0xe8d0b0, 1);
    g.strokeRoundedRect(4, 4, width - 8, 34, 6);
    g.lineStyle(1, 0xd4b898, 0.5);
    g.strokeRoundedRect(6, 6, width - 12, 30, 5);

    // Small decorative dots at corners (pixel art feel)
    g.fillStyle(0xd4b898, 1);
    g.fillRect(10, 10, 2, 2);
    g.fillRect(width - 12, 10, 2, 2);
    g.fillRect(10, 30, 2, 2);
    g.fillRect(width - 12, 30, 2, 2);

    g.setDepth(100);
    this.uiContainer.add(g);

    // Village name (left)
    const villageText = this.add.text(20, 21, 'Tiny Traders Village', {
      fontSize: '10px',
      color: '#6a5040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);
    this.uiContainer.add(villageText);

    // Day counter (center)
    const dayText = this.add.text(width / 2, 21, `Day ${this.currentDay}`, {
      fontSize: '11px',
      color: '#c8a040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(101);
    this.uiContainer.add(dayText);

    // Sun icon (pixel art) + weather (right)
    const sunG = this.make.graphics({ x: 0, y: 0 }, false);
    const sunX = width - 70;
    const sunY = 21;
    // Sun body
    sunG.fillStyle(0xffd700, 1);
    sunG.fillCircle(sunX, sunY, 5);
    // Sun rays
    sunG.fillStyle(0xffe44d, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      sunG.fillRect(
        sunX + Math.cos(angle) * 7 - 1,
        sunY + Math.sin(angle) * 7 - 1,
        2, 2
      );
    }
    sunG.setDepth(101);
    this.uiContainer.add(sunG);

    const weatherText = this.add.text(width - 14, 21, 'AM', {
      fontSize: '9px',
      color: '#c8a060',
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(101);
    this.uiContainer.add(weatherText);
  }

  // ─── Ambient Particles ────────────────────────────────────────
  private createAmbientParticles(width: number, height: number): void {
    // Sparkle particles (floating stars)
    const sparkles: { x: number; y: number; phase: number; speed: number; size: number }[] = [];
    for (let i = 0; i < 8; i++) {
      sparkles.push({
        x: 40 + Math.random() * (width - 80),
        y: 50 + Math.random() * (height - 80),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        size: 1 + Math.random() * 1.5,
      });
    }

    // Leaf particles
    const leaves: { x: number; y: number; vx: number; vy: number; rot: number; size: number }[] = [];
    for (let i = 0; i < 5; i++) {
      leaves.push({
        x: Math.random() * width,
        y: 50 + Math.random() * (height - 80),
        vx: 0.2 + Math.random() * 0.3,
        vy: 0.1 + Math.random() * 0.2,
        rot: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 2,
      });
    }

    const g = this.particleGfx;

    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 4000,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        g.clear();
        const time = this.time.now * 0.001;

        // Draw sparkles (star shapes)
        for (const s of sparkles) {
          const alpha = 0.3 + 0.4 * Math.sin(time * s.speed + s.phase);
          const cx = s.x + Math.sin(time * 0.3 + s.phase) * 10;
          const cy = s.y + Math.cos(time * 0.2 + s.phase) * 8;

          // 4-pointed star
          g.fillStyle(0xffffff, alpha);
          g.fillRect(cx - s.size, cy - 0.5, s.size * 2, 1);
          g.fillRect(cx - 0.5, cy - s.size, 1, s.size * 2);
          // Diagonal points (smaller)
          g.fillStyle(0xfff8c0, alpha * 0.6);
          const ds = s.size * 0.6;
          g.fillRect(cx - ds * 0.7, cy - ds * 0.7, ds, ds);
          g.fillRect(cx + ds * 0.1, cy + ds * 0.1, ds * 0.5, ds * 0.5);
        }

        // Draw leaves
        for (const l of leaves) {
          l.x += l.vx;
          l.y += l.vy + Math.sin(time + l.rot) * 0.3;
          l.rot += 0.02;

          // Wrap around
          if (l.x > width + 10) l.x = -10;
          if (l.y > height + 10) l.y = 40;

          g.fillStyle(0x7ec07a, 0.4);
          g.save();
          // Simple leaf shape (oval)
          g.fillEllipse(l.x, l.y, l.size * 2, l.size);
          g.fillStyle(0x6aaa66, 0.3);
          g.fillEllipse(l.x + 0.5, l.y + 0.5, l.size * 1.5, l.size * 0.7);
          g.restore();
        }
      },
    });
  }

  // ─── Input ────────────────────────────────────────────────────
  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = pointer;

      // Ignore clicks on UI bar
      if (y < 42) return;

      // Clear previous tooltips
      this.tooltipContainer.removeAll(true);

      // Check buildings
      let clicked: IsoBuilding | null = null;
      for (const b of this.buildings) {
        if (this.isPointInBuilding(x, y, b)) {
          clicked = b;
          break;
        }
      }

      if (clicked) {
        this.showBuildingTooltip(clicked);
      } else {
        this.showPlacementHint(x, y);
      }
    });
  }

  private isPointInBuilding(px: number, py: number, b: IsoBuilding): boolean {
    // Check if point is within the building's isometric footprint (approximate)
    const tl = this.toScreen(b.gridX, b.gridY);
    const tr = this.toScreen(b.gridX + b.tilesW, b.gridY);
    const br = this.toScreen(b.gridX + b.tilesW, b.gridY + b.tilesH);
    const bl = this.toScreen(b.gridX, b.gridY + b.tilesH);

    // Extend upward for wall height
    const minY = Math.min(tl.y, tr.y) - b.wallHeight;
    const maxY = Math.max(bl.y, br.y);
    const minX = Math.min(tl.x, bl.x) - 5;
    const maxX = Math.max(tr.x, br.x) + 5;

    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }

  private showBuildingTooltip(b: IsoBuilding): void {
    const center = this.toScreen(
      b.gridX + b.tilesW / 2,
      b.gridY + b.tilesH / 2
    );
    const tooltipY = center.y - b.wallHeight - 20;

    // Tooltip background
    const bg = this.make.graphics({ x: 0, y: 0 }, false);
    const textContent = `${b.nameKR} (${b.name})`;
    const textWidth = textContent.length * 6 + 16;

    bg.fillStyle(0xfef9f0, 0.95);
    bg.fillRoundedRect(center.x - textWidth / 2, tooltipY - 10, textWidth, 20, 4);
    bg.lineStyle(1, 0xd4b898, 1);
    bg.strokeRoundedRect(center.x - textWidth / 2, tooltipY - 10, textWidth, 20, 4);

    // Small triangle pointer
    bg.fillStyle(0xfef9f0, 0.95);
    bg.fillTriangle(
      center.x - 4, tooltipY + 10,
      center.x + 4, tooltipY + 10,
      center.x, tooltipY + 15
    );

    bg.setDepth(51);
    this.tooltipContainer.add(bg);

    const text = this.add.text(center.x, tooltipY, textContent, {
      fontSize: '9px',
      color: '#6a5040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(52);
    this.tooltipContainer.add(text);

    // Auto-hide after 2.5s
    this.time.delayedCall(2500, () => {
      this.tooltipContainer.removeAll(true);
    });
  }

  private showPlacementHint(x: number, y: number): void {
    const { gx, gy } = this.toGrid(x, y);

    // Only show within grid bounds
    if (gx < 0 || gx >= this.GRID_SIZE || gy < 0 || gy >= this.GRID_SIZE) return;

    // Check if a building already occupies this tile
    for (const b of this.buildings) {
      if (
        gx >= b.gridX && gx < b.gridX + b.tilesW &&
        gy >= b.gridY && gy < b.gridY + b.tilesH
      ) {
        return;
      }
    }

    const { x: sx, y: sy } = this.toScreen(gx, gy);
    const centerY = sy + this.TILE_H / 2;

    // Highlight tile
    const highlight = this.make.graphics({ x: 0, y: 0 }, false);
    highlight.fillStyle(0x4caf50, 0.2);
    highlight.beginPath();
    highlight.moveTo(sx, sy);
    highlight.lineTo(sx + this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.lineTo(sx, sy + this.TILE_H);
    highlight.lineTo(sx - this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.closePath();
    highlight.fillPath();
    highlight.setDepth(50);
    this.tooltipContainer.add(highlight);

    // Plus icon
    const plus = this.add.text(sx, centerY - 4, '+', {
      fontSize: '16px',
      color: '#4caf50',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    this.tooltipContainer.add(plus);

    // Animate and remove
    this.tweens.add({
      targets: plus,
      y: centerY - 20,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tooltipContainer.removeAll(true);
      },
    });
  }

  update(): void {
    // Depth-sort characters each frame
    for (const ch of this.characters) {
      ch.gfx.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 8);
    }
  }
}
