import Phaser from 'phaser';
import {
  generateAllTextures,
  PALETTES,
  darken,
  tileRand,
  type CharacterPalette,
} from './texture-factory';

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
  detail: string;
}

interface IsoCharacter {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Sprite;
  gridX: number;
  gridY: number;
  screenX: number;
  screenY: number;
  palette: CharacterPalette;
  currentWP: number;
  waypoints: { gx: number; gy: number }[];
  bobOffset: number;
  label: string;
  isMoving: boolean;
  emoteSprite: Phaser.GameObjects.Sprite | null;
}

interface Decoration {
  type: 'tree' | 'flower' | 'lamp' | 'fountain';
  gridX: number;
  gridY: number;
}

// ─── Scene ────────────────────────────────────────────────────
export class MainScene extends Phaser.Scene {
  private readonly TILE_W = 64;
  private readonly TILE_H = 32;
  private readonly GRID_SIZE = 10;
  private centerX = 0;
  private offsetY = 0;

  private buildings: IsoBuilding[] = [];
  private characters: IsoCharacter[] = [];
  private decorations: Decoration[] = [];
  private currentDay = 1;

  // Containers for depth sorting
  private groundContainer!: Phaser.GameObjects.Container;
  private buildingContainer!: Phaser.GameObjects.Container;
  private decoContainer!: Phaser.GameObjects.Container;
  private charContainer!: Phaser.GameObjects.Container;
  private uiContainer!: Phaser.GameObjects.Container;
  private particleGfx!: Phaser.GameObjects.Graphics;
  private tooltipContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // No external assets — all textures generated procedurally
  }

  create(): void {
    const { width, height } = this.scale;
    this.centerX = width / 2;
    this.offsetY = 60;

    this.cameras.main.setBackgroundColor('#fef9f0');

    // Generate all sprite textures
    generateAllTextures(this);

    // Create depth-ordered containers
    this.groundContainer = this.add.container(0, 0).setDepth(0);
    this.decoContainer = this.add.container(0, 0).setDepth(1);
    this.buildingContainer = this.add.container(0, 0).setDepth(2);
    this.charContainer = this.add.container(0, 0).setDepth(3);
    this.particleGfx = this.add.graphics().setDepth(4);
    this.tooltipContainer = this.add.container(0, 0).setDepth(50);
    this.uiContainer = this.add.container(0, 0).setDepth(100);

    this.placeGroundTiles();
    this.createDecorations();
    this.placeDecorations();
    this.createBuildings();
    this.drawBuildings();
    this.createCharacters();
    this.drawUIOverlay(width);
    this.createAmbientParticles(width, height);
    this.setupInput();
    this.animateCharacters();
    this.startEmoteSystem();
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

  // ─── Ground tiles (sprites) ───────────────────────────────────
  private placeGroundTiles(): void {
    const walkwaySet = new Set<string>();
    for (let x = 0; x < this.GRID_SIZE; x++) walkwaySet.add(`${x},4`);
    for (let y = 0; y < this.GRID_SIZE; y++) walkwaySet.add(`4,${y}`);
    for (let x = 2; x < 8; x++) walkwaySet.add(`${x},7`);
    for (let y = 4; y < 8; y++) walkwaySet.add(`7,${y}`);

    for (let gx = 0; gx < this.GRID_SIZE; gx++) {
      for (let gy = 0; gy < this.GRID_SIZE; gy++) {
        const { x: sx, y: sy } = this.toScreen(gx, gy);
        const isWalk = walkwaySet.has(`${gx},${gy}`);

        // Pick variant based on tile position
        const rand = tileRand(gx, gy, 0);
        let textureKey: string;
        if (isWalk) {
          const variant = Math.floor(rand * 3);
          textureKey = `tile-walk-${variant}`;
        } else {
          const variant = Math.floor(rand * 4);
          textureKey = `tile-grass-${variant}`;
        }

        // Place tile sprite — texture origin is top-center of diamond
        const tile = this.add.sprite(sx, sy, textureKey);
        tile.setOrigin(0.5, 0);
        this.groundContainer.add(tile);
      }
    }
  }

  // ─── Buildings (Graphics — complex isometric shapes) ──────────
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
    const sorted = [...this.buildings].sort(
      (a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY),
    );
    for (const b of sorted) {
      const gfx = this.make.graphics({ x: 0, y: 0 }, false);
      this.drawIsoBuilding(gfx, b);
      gfx.setDepth(this.isoDepth(b.gridX + b.tilesW, b.gridY + b.tilesH));
      this.buildingContainer.add(gfx);
    }
  }

  private drawIsoBuilding(g: Phaser.GameObjects.Graphics, b: IsoBuilding): void {
    const tl = this.toScreen(b.gridX, b.gridY);
    const tr = this.toScreen(b.gridX + b.tilesW, b.gridY);
    const br = this.toScreen(b.gridX + b.tilesW, b.gridY + b.tilesH);
    const bl = this.toScreen(b.gridX, b.gridY + b.tilesH);
    const wh = b.wallHeight;

    // Shadow
    g.fillStyle(0x000000, 0.08);
    g.beginPath();
    g.moveTo(tl.x, tl.y + 4);
    g.lineTo(tr.x + 4, tr.y + 4);
    g.lineTo(br.x + 4, br.y + 6);
    g.lineTo(bl.x, bl.y + 6);
    g.closePath();
    g.fillPath();

    // Left face
    g.fillStyle(b.wallLeft, 1);
    g.beginPath();
    g.moveTo(tl.x, tl.y - wh);
    g.lineTo(bl.x, bl.y - wh);
    g.lineTo(bl.x, bl.y);
    g.lineTo(tl.x, tl.y);
    g.closePath();
    g.fillPath();
    this.drawWallBricks(g, tl, bl, wh, b.wallLeft);
    g.lineStyle(1, darken(b.wallLeft, 40), 0.4);
    g.beginPath();
    g.moveTo(tl.x, tl.y - wh); g.lineTo(bl.x, bl.y - wh);
    g.lineTo(bl.x, bl.y); g.lineTo(tl.x, tl.y);
    g.closePath();
    g.strokePath();

    // Right face
    g.fillStyle(b.wallRight, 1);
    g.beginPath();
    g.moveTo(bl.x, bl.y - wh);
    g.lineTo(br.x, br.y - wh);
    g.lineTo(br.x, br.y);
    g.lineTo(bl.x, bl.y);
    g.closePath();
    g.fillPath();
    this.drawWallBricks(g, bl, br, wh, b.wallRight);
    g.lineStyle(1, darken(b.wallRight, 40), 0.4);
    g.beginPath();
    g.moveTo(bl.x, bl.y - wh); g.lineTo(br.x, br.y - wh);
    g.lineTo(br.x, br.y); g.lineTo(bl.x, bl.y);
    g.closePath();
    g.strokePath();

    // Roof
    g.fillStyle(b.roofColor, 1);
    g.beginPath();
    g.moveTo(tl.x, tl.y - wh);
    g.lineTo(tr.x, tr.y - wh);
    g.lineTo(br.x, br.y - wh);
    g.lineTo(bl.x, bl.y - wh);
    g.closePath();
    g.fillPath();
    this.drawRoofPattern(g, tl, tr, br, bl, wh, b.roofColorDark);
    g.lineStyle(1, b.roofColorDark, 0.5);
    g.beginPath();
    g.moveTo(tl.x, tl.y - wh); g.lineTo(tr.x, tr.y - wh);
    g.lineTo(br.x, br.y - wh); g.lineTo(bl.x, bl.y - wh);
    g.closePath();
    g.strokePath();

    // Building-specific details
    switch (b.detail) {
      case 'house': this.drawHouseDetails(g, b, tl, tr, bl, br, wh); break;
      case 'kitchen': this.drawKitchenDetails(g, b, tl, tr, bl, br, wh); break;
      case 'bank': this.drawBankDetails(g, b, tl, tr, bl, br, wh); break;
      case 'warehouse': this.drawWarehouseDetails(g, b, tl, tr, bl, br, wh); break;
      case 'rest': this.drawRestAreaDetails(g, b, tl, tr, bl, br, wh); break;
      case 'hospital': this.drawHospitalDetails(g, b, tl, tr, bl, br, wh); break;
    }
  }

  private drawWallBricks(
    g: Phaser.GameObjects.Graphics,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    wh: number,
    wallColor: number,
  ): void {
    g.lineStyle(1, darken(wallColor, 12), 0.15);
    const rows = Math.floor(wh / 8);
    for (let i = 1; i <= rows; i++) {
      const t = i / (rows + 1);
      g.beginPath();
      g.moveTo(p1.x, p1.y - wh + wh * t);
      g.lineTo(p2.x, p2.y - wh + wh * t);
      g.strokePath();
    }
  }

  private drawRoofPattern(
    g: Phaser.GameObjects.Graphics,
    tl: { x: number; y: number },
    tr: { x: number; y: number },
    _br: { x: number; y: number },
    bl: { x: number; y: number },
    wh: number,
    roofDark: number,
  ): void {
    g.lineStyle(1, roofDark, 0.2);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const x1 = tl.x + (bl.x - tl.x) * t;
      const y1 = tl.y - wh + (bl.y - tl.y) * t;
      const x2 = tr.x + (_br.x - tr.x) * t;
      const y2 = tr.y - wh + (_br.y - tr.y) * t;
      g.beginPath();
      g.moveTo(x1, y1); g.lineTo(x2, y2);
      g.strokePath();
    }
  }

  // ─── Building Detail Methods ──────────────────────────────────
  private drawHouseDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x705838, 1);
    g.fillRect(doorCX - 5, doorCY - wh * 0.48, 10, wh * 0.44);
    g.fillStyle(0x8b6f47, 1);
    g.fillRect(doorCX - 4, doorCY - wh * 0.46, 8, wh * 0.4);
    g.lineStyle(1, 0x705838, 0.4);
    g.strokeRect(doorCX - 3, doorCY - wh * 0.44, 3, wh * 0.16);
    g.strokeRect(doorCX, doorCY - wh * 0.44, 3, wh * 0.16);
    g.strokeRect(doorCX - 3, doorCY - wh * 0.24, 3, wh * 0.16);
    g.strokeRect(doorCX, doorCY - wh * 0.24, 3, wh * 0.16);
    g.fillStyle(0xffd700, 1);
    g.fillCircle(doorCX + 2, doorCY - wh * 0.28, 1.5);

    const winLX = (tl.x + bl.x) / 2;
    const winLY = (tl.y + bl.y) / 2 - wh * 0.55;
    g.fillStyle(0xff9eae, 0.8);
    g.fillRect(winLX - 8, winLY - 1, 3, 10);
    g.fillRect(winLX + 5, winLY - 1, 3, 10);
    g.fillStyle(0x87ceeb, 0.8);
    g.fillRect(winLX - 5, winLY, 10, 8);
    g.lineStyle(1, 0x6a5040, 0.7);
    g.strokeRect(winLX - 5, winLY, 10, 8);
    g.beginPath();
    g.moveTo(winLX, winLY); g.lineTo(winLX, winLY + 8);
    g.moveTo(winLX - 5, winLY + 4); g.lineTo(winLX + 5, winLY + 4);
    g.strokePath();
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(winLX - 4, winLY + 1, 3, 2);
    g.fillStyle(0x8b6040, 1);
    g.fillRect(winLX - 5, winLY + 8, 10, 2);
    const fcolors = [0xff6680, 0xff9eae, 0xffcc44];
    for (let i = 0; i < 3; i++) {
      g.fillStyle(fcolors[i], 0.9);
      g.fillCircle(winLX - 3 + i * 3, winLY + 7, 1.5);
    }

    const chimneyX = (tl.x + tr.x) / 2 + 5;
    const chimneyY = (tl.y + tr.y) / 2 - wh - 2;
    g.fillStyle(0xb0856a, 1);
    g.fillRect(chimneyX - 3, chimneyY - 10, 6, 12);
    g.fillStyle(0xa07858, 1);
    g.fillRect(chimneyX - 3, chimneyY - 7, 6, 1);
    g.fillRect(chimneyX - 3, chimneyY - 4, 6, 1);
    g.fillStyle(0xc9a088, 1);
    g.fillRect(chimneyX - 4, chimneyY - 11, 8, 3);
    g.fillStyle(0xdddddd, 0.35);
    g.fillCircle(chimneyX, chimneyY - 14, 3);
    g.fillStyle(0xdddddd, 0.25);
    g.fillCircle(chimneyX - 2, chimneyY - 18, 2.5);
    g.fillStyle(0xdddddd, 0.15);
    g.fillCircle(chimneyX + 1, chimneyY - 21, 2);

    g.fillStyle(0xc0a888, 1);
    g.fillRect(doorCX - 5, doorCY - wh * 0.05, 10, 2);
  }

  private drawKitchenDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xffeebb, 0.15);
      g.fillCircle(wx, wy + 4, 8);
      g.fillStyle(0xffeebb, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x8b6f47, 0.7);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.beginPath();
      g.moveTo(wx, wy); g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4); g.lineTo(wx + 5, wy + 4);
      g.strokePath();
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(wx - 4, wy + 1, 2, 2);
    }
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = bl.x + (br.x - bl.x) * t;
      const wy = bl.y + (br.y - bl.y) * t - wh * 0.55;
      g.fillStyle(0xffeebb, 0.15);
      g.fillCircle(wx, wy + 4, 8);
      g.fillStyle(0xffeebb, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x8b6f47, 0.7);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.beginPath();
      g.moveTo(wx, wy); g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4); g.lineTo(wx + 5, wy + 4);
      g.strokePath();
      g.fillStyle(0xffffff, 0.25);
      g.fillRect(wx - 4, wy + 1, 2, 2);
    }

    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0xff6644, 0.7);
    g.fillTriangle(doorCX - 10, doorCY - wh * 0.5, doorCX + 10, doorCY - wh * 0.5, doorCX, doorCY - wh * 0.55);
    g.fillStyle(0xcc4422, 0.5);
    g.fillRect(doorCX - 10, doorCY - wh * 0.5, 20, 2);
    g.fillStyle(0x8b6040, 1);
    g.fillRect(doorCX - 6, doorCY - wh * 0.48, 12, wh * 0.43);
    g.lineStyle(1, 0x6a4530, 0.6);
    g.strokeRect(doorCX - 6, doorCY - wh * 0.48, 12, wh * 0.43);
    g.fillStyle(0xffeebb, 0.7);
    g.fillRect(doorCX - 4, doorCY - wh * 0.44, 8, 6);

    const chimneyX = tr.x - 8;
    const chimneyY = tr.y - wh - 2;
    g.fillStyle(0xa06848, 1);
    g.fillRect(chimneyX - 3, chimneyY - 12, 6, 14);
    g.fillStyle(0x906038, 1);
    g.fillRect(chimneyX - 3, chimneyY - 8, 6, 1);
    g.fillStyle(0xb87858, 1);
    g.fillRect(chimneyX - 4, chimneyY - 13, 8, 3);
    g.fillStyle(0xeeeeee, 0.3);
    g.fillCircle(chimneyX, chimneyY - 16, 3.5);
    g.fillCircle(chimneyX + 2, chimneyY - 20, 3);
    g.fillCircle(chimneyX - 1, chimneyY - 24, 2.5);
    g.fillCircle(chimneyX + 1, chimneyY - 27, 2);
    g.fillCircle(chimneyX - 2, chimneyY - 30, 1.5);

    const flagX = (tl.x + tr.x) / 2;
    const flagY = (tl.y + tr.y) / 2 - wh;
    g.lineStyle(1, 0x6a4530, 1);
    g.beginPath();
    g.moveTo(flagX, flagY); g.lineTo(flagX, flagY - 10);
    g.strokePath();
    g.fillStyle(0xff6644, 1);
    g.fillTriangle(flagX, flagY - 10, flagX + 6, flagY - 8, flagX, flagY - 6);

    const barrelX = doorCX + 12;
    const barrelY = doorCY - 2;
    g.fillStyle(0x8b6040, 1);
    g.fillEllipse(barrelX, barrelY - 4, 7, 8);
    g.fillStyle(0x705030, 1);
    g.fillRect(barrelX - 3.5, barrelY - 2, 7, 1);
    g.fillRect(barrelX - 3.5, barrelY - 6, 7, 1);
    g.fillStyle(0xa07850, 1);
    g.fillEllipse(barrelX, barrelY - 8, 6, 3);
  }

  private drawBankDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    for (let i = 0; i < 3; i++) {
      const t = 0.2 + i * 0.3;
      const cx = bl.x + (br.x - bl.x) * t;
      const cy = bl.y + (br.y - bl.y) * t;
      g.fillStyle(0xe8e0d0, 1);
      g.fillRect(cx - 2, cy - wh * 0.85, 4, wh * 0.8);
      g.fillStyle(0xf0ece0, 1);
      g.fillRect(cx - 1, cy - wh * 0.85, 1, wh * 0.8);
      g.fillStyle(0xffd700, 0.8);
      g.fillRect(cx - 3, cy - wh * 0.87, 6, 3);
      g.fillRect(cx - 3, cy - wh * 0.08, 6, 3);
    }

    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      const wx = tl.x + (bl.x - tl.x) * t;
      const wy = tl.y + (bl.y - tl.y) * t - wh * 0.55;
      g.fillStyle(0xf0e8a0, 0.8);
      g.fillRect(wx - 5, wy, 10, 10);
      g.fillStyle(0xf0e8a0, 0.8);
      g.beginPath();
      g.arc(wx, wy, 5, Math.PI, 0);
      g.fillPath();
      g.lineStyle(1, 0xc8b040, 0.6);
      g.strokeRect(wx - 5, wy, 10, 10);
      g.beginPath();
      g.arc(wx, wy, 5, Math.PI, 0);
      g.strokePath();
      g.fillStyle(0xffffff, 0.2);
      g.fillRect(wx - 4, wy + 1, 2, 3);
    }

    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0xc8a040, 1);
    g.fillRect(doorCX - 7, doorCY - wh * 0.5, 14, wh * 0.45);
    g.lineStyle(1, 0xa08030, 0.8);
    g.strokeRect(doorCX - 7, doorCY - wh * 0.5, 14, wh * 0.45);
    g.fillStyle(0xd8b050, 1);
    g.beginPath();
    g.arc(doorCX, doorCY - wh * 0.5, 7, Math.PI, 0);
    g.fillPath();
    g.fillStyle(0xffd700, 1);
    g.fillCircle(doorCX - 2, doorCY - wh * 0.28, 1.5);
    g.fillCircle(doorCX + 2, doorCY - wh * 0.28, 1.5);

    const coinX = (tl.x + br.x) / 2;
    const coinY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0xffd700, 1);
    g.fillCircle(coinX, coinY - 2, 5);
    g.fillStyle(0xe8c200, 1);
    g.fillCircle(coinX, coinY - 2, 3);
    g.fillStyle(0xfff0a0, 1);
    g.fillCircle(coinX - 1, coinY - 3, 1);
    g.lineStyle(1, 0xc8a000, 1);
    g.beginPath();
    g.moveTo(coinX, coinY - 5); g.lineTo(coinX, coinY + 1);
    g.strokePath();

    g.fillStyle(0xe0d8c8, 1);
    g.fillRect(doorCX - 8, doorCY - wh * 0.06, 16, 2);
    g.fillStyle(0xd0c8b8, 1);
    g.fillRect(doorCX - 9, doorCY - wh * 0.03, 18, 2);
  }

  private drawWarehouseDetails(
    g: Phaser.GameObjects.Graphics, b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    g.lineStyle(1, darken(b.wallLeft, 20), 0.3);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.beginPath();
      g.moveTo(tl.x, tl.y - wh + wh * t);
      g.lineTo(bl.x, bl.y - wh + wh * t);
      g.strokePath();
    }
    for (let i = 1; i < 3; i++) {
      const t = i / 3;
      const x1 = tl.x + (bl.x - tl.x) * t;
      const y1 = tl.y + (bl.y - tl.y) * t;
      g.beginPath();
      g.moveTo(x1, y1 - wh); g.lineTo(x1, y1);
      g.strokePath();
    }
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      g.beginPath();
      g.moveTo(bl.x, bl.y - wh + wh * t);
      g.lineTo(br.x, br.y - wh + wh * t);
      g.strokePath();
    }

    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x6a5438, 1);
    g.fillRect(doorCX - 10, doorCY - wh * 0.65, 20, wh * 0.6);
    g.lineStyle(1, 0x504028, 0.7);
    g.strokeRect(doorCX - 10, doorCY - wh * 0.65, 20, wh * 0.6);
    g.beginPath();
    g.moveTo(doorCX - 10, doorCY - wh * 0.65);
    g.lineTo(doorCX + 10, doorCY - wh * 0.05);
    g.moveTo(doorCX + 10, doorCY - wh * 0.65);
    g.lineTo(doorCX - 10, doorCY - wh * 0.05);
    g.strokePath();
    g.fillStyle(0x888888, 1);
    g.fillRect(doorCX - 1, doorCY - wh * 0.35, 2, 4);

    this.drawCrate(g, br.x + 6, br.y - 4, 10, 8, 0xa08050);
    this.drawCrate(g, br.x + 14, br.y - 2, 8, 6, 0x907840);
    this.drawCrate(g, br.x + 8, br.y - 12, 8, 7, 0xb09060);

    g.fillStyle(0xc8b888, 1);
    g.fillEllipse(bl.x - 8, bl.y - 3, 8, 6);
    g.fillStyle(0xb8a878, 1);
    g.fillEllipse(bl.x - 8, bl.y - 6, 6, 3);
  }

  private drawCrate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    g.fillStyle(color, 1);
    g.fillRect(x - w / 2, y - h, w, h);
    g.lineStyle(1, darken(color, 30), 0.6);
    g.strokeRect(x - w / 2, y - h, w, h);
    g.beginPath();
    g.moveTo(x, y - h); g.lineTo(x, y);
    g.moveTo(x - w / 2, y - h / 2); g.lineTo(x + w / 2, y - h / 2);
    g.strokePath();
  }

  private drawRestAreaDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    const drawCurtainWindow = (wx: number, wy: number) => {
      g.fillStyle(0xb0eedd, 0.8);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0x68b8a8, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.fillStyle(0x96ddd0, 0.7);
      g.fillRect(wx - 5, wy, 3, 8);
      g.fillRect(wx + 2, wy, 3, 8);
      g.fillStyle(0x888888, 0.6);
      g.fillRect(wx - 6, wy - 1, 12, 1);
      g.fillStyle(0xffffff, 0.2);
      g.fillRect(wx - 1, wy + 1, 2, 2);
    };
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      drawCurtainWindow(tl.x + (bl.x - tl.x) * t, tl.y + (bl.y - tl.y) * t - wh * 0.55);
      drawCurtainWindow(bl.x + (br.x - bl.x) * t, bl.y + (br.y - bl.y) * t - wh * 0.55);
    }

    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0x68b8a8, 1);
    g.fillRect(doorCX - 5, doorCY - wh * 0.45, 10, wh * 0.4);
    g.lineStyle(1, 0x508878, 0.6);
    g.strokeRect(doorCX - 5, doorCY - wh * 0.45, 10, wh * 0.4);
    g.fillStyle(0xb0eedd, 0.6);
    g.fillRect(doorCX - 3, doorCY - wh * 0.42, 6, 5);

    const drawPottedPlant = (px: number, py: number) => {
      g.fillStyle(0x8b6040, 1);
      g.fillRect(px - 3, py - 4, 6, 5);
      g.fillStyle(0x705030, 1);
      g.fillRect(px - 2, py - 4, 4, 1);
      g.fillStyle(0x4caf50, 1);
      g.fillCircle(px, py - 7, 4);
      g.fillStyle(0x66bb6a, 1);
      g.fillCircle(px - 2, py - 9, 3);
      g.fillCircle(px + 2, py - 8, 3);
      g.fillStyle(0x7ecc7e, 0.6);
      g.fillCircle(px + 1, py - 10, 2);
    };
    drawPottedPlant(doorCX + 10, doorCY - wh * 0.08);
    drawPottedPlant(doorCX - 10, doorCY - wh * 0.08);

    const flowerColors = [0xff9eae, 0xffd700, 0xff8a4c, 0xffb3c1, 0xc8a0ff];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const fx = bl.x - 10 + Math.cos(angle) * 10;
      const fy = bl.y + 3 + Math.sin(angle) * 4;
      g.fillStyle(0x4caf50, 0.6);
      g.fillRect(fx, fy, 1, 2);
      g.fillStyle(flowerColors[i % flowerColors.length], 0.9);
      g.fillCircle(fx, fy - 1, 2);
      g.fillStyle(0xffee58, 0.8);
      g.fillCircle(fx, fy - 1, 0.8);
    }

    const roofCX = (tl.x + br.x) / 2;
    const roofCY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0x4caf50, 0.35);
    g.fillCircle(roofCX - 6, roofCY + 1, 3);
    g.fillCircle(roofCX + 6, roofCY - 1, 3);
    g.fillCircle(roofCX, roofCY - 3, 2.5);
    g.fillStyle(0xff9eae, 0.4);
    g.fillCircle(roofCX - 4, roofCY, 1);
    g.fillCircle(roofCX + 4, roofCY - 2, 1);
  }

  private drawHospitalDetails(
    g: Phaser.GameObjects.Graphics, _b: IsoBuilding,
    tl: { x: number; y: number }, _tr: { x: number; y: number },
    bl: { x: number; y: number }, br: { x: number; y: number },
    wh: number,
  ): void {
    const drawCleanWindow = (wx: number, wy: number) => {
      g.fillStyle(0xd0eeff, 0.9);
      g.fillRect(wx - 5, wy, 10, 8);
      g.lineStyle(1, 0xaabbcc, 0.6);
      g.strokeRect(wx - 5, wy, 10, 8);
      g.beginPath();
      g.moveTo(wx, wy); g.lineTo(wx, wy + 8);
      g.moveTo(wx - 5, wy + 4); g.lineTo(wx + 5, wy + 4);
      g.strokePath();
      g.fillStyle(0xffffff, 0.3);
      g.fillRect(wx - 4, wy + 1, 2, 2);
    };
    for (let i = 0; i < 2; i++) {
      const t = 0.3 + i * 0.4;
      drawCleanWindow(tl.x + (bl.x - tl.x) * t, tl.y + (bl.y - tl.y) * t - wh * 0.55);
      drawCleanWindow(bl.x + (br.x - bl.x) * t, bl.y + (br.y - bl.y) * t - wh * 0.55);
    }

    const doorCX = (bl.x + br.x) / 2;
    const doorCY = (bl.y + br.y) / 2;
    g.fillStyle(0xdddddd, 1);
    g.fillRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);
    g.lineStyle(1, 0xbbbbbb, 0.6);
    g.strokeRect(doorCX - 6, doorCY - wh * 0.45, 12, wh * 0.4);
    g.beginPath();
    g.moveTo(doorCX, doorCY - wh * 0.45);
    g.lineTo(doorCX, doorCY - wh * 0.05);
    g.strokePath();
    g.fillStyle(0xd0eeff, 0.6);
    g.fillRect(doorCX - 5, doorCY - wh * 0.42, 4, 5);
    g.fillRect(doorCX + 1, doorCY - wh * 0.42, 4, 5);

    const crossX = (tl.x + br.x) / 2;
    const crossY = (tl.y + br.y) / 2 - wh;
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(crossX, crossY, 7);
    g.fillStyle(0xff4444, 1);
    g.fillRect(crossX - 2, crossY - 6, 4, 12);
    g.fillRect(crossX - 6, crossY - 2, 12, 4);

    const wallCrossX = (bl.x + br.x) / 2;
    const wallCrossY = (bl.y + br.y) / 2 - wh * 0.78;
    g.fillStyle(0xff4444, 0.7);
    g.fillRect(wallCrossX - 1.5, wallCrossY - 4, 3, 8);
    g.fillRect(wallCrossX - 4, wallCrossY - 1.5, 8, 3);

    g.fillStyle(0x88bbcc, 0.6);
    g.fillRect(doorCX - 7, doorCY - wh * 0.05, 14, 2);
  }

  // ─── Decorations (sprites) ────────────────────────────────────
  private createDecorations(): void {
    this.decorations = [
      { type: 'tree', gridX: 0, gridY: 0 },
      { type: 'tree', gridX: 9, gridY: 0 },
      { type: 'tree', gridX: 0, gridY: 9 },
      { type: 'tree', gridX: 9, gridY: 9 },
      { type: 'tree', gridX: 3, gridY: 3 },
      { type: 'tree', gridX: 8, gridY: 3 },
      { type: 'tree', gridX: 3, gridY: 6 },
      { type: 'flower', gridX: 0, gridY: 3 },
      { type: 'flower', gridX: 3, gridY: 0 },
      { type: 'flower', gridX: 9, gridY: 6 },
      { type: 'flower', gridX: 8, gridY: 9 },
      { type: 'flower', gridX: 0, gridY: 6 },
      { type: 'lamp', gridX: 4, gridY: 2 },
      { type: 'lamp', gridX: 4, gridY: 6 },
      { type: 'lamp', gridX: 4, gridY: 9 },
      { type: 'lamp', gridX: 2, gridY: 4 },
      { type: 'lamp', gridX: 6, gridY: 4 },
      { type: 'fountain', gridX: 4, gridY: 4 },
    ];
  }

  private placeDecorations(): void {
    const sorted = [...this.decorations].sort(
      (a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY),
    );
    for (const d of sorted) {
      const { x: sx, y: sy } = this.toScreen(d.gridX, d.gridY);
      const baseY = sy + this.TILE_H / 2;
      const depth = this.isoDepth(d.gridX, d.gridY) + 5;

      switch (d.type) {
        case 'tree': {
          // Shadow
          const shadow = this.add.sprite(sx, baseY + 2, 'shadow-tree');
          shadow.setOrigin(0.5, 0.5).setDepth(depth - 1);
          this.decoContainer.add(shadow);
          // Tree — pick variant based on position
          const variant = Math.floor(tileRand(d.gridX, d.gridY, 100) * 3);
          const treeKeys = ['tree-oak', 'tree-pine', 'tree-fruit'];
          const tree = this.add.sprite(sx, baseY, treeKeys[variant]);
          tree.setOrigin(16 / 32, 45 / 52).setDepth(depth);
          this.decoContainer.add(tree);
          break;
        }
        case 'flower': {
          const flower = this.add.sprite(sx, baseY, 'deco-flower');
          flower.setOrigin(0.5, 10 / 16).setDepth(depth);
          this.decoContainer.add(flower);
          break;
        }
        case 'lamp': {
          const lamp = this.add.sprite(sx, baseY, 'deco-lamp');
          lamp.setOrigin(0.5, 30 / 36).setDepth(depth);
          this.decoContainer.add(lamp);
          break;
        }
        case 'fountain': {
          const fountain = this.add.sprite(sx, baseY, 'deco-fountain');
          fountain.setOrigin(0.5, 18 / 28).setDepth(depth);
          this.decoContainer.add(fountain);
          break;
        }
      }
    }
  }

  // ─── Characters (sprite-based with animation) ─────────────────
  private createCharacters(): void {
    const charDefs = [
      {
        label: 'Blue',
        waypoints: [
          { gx: 2, gy: 3 }, { gx: 4, gy: 3 }, { gx: 4, gy: 6 },
          { gx: 7, gy: 6 }, { gx: 7, gy: 4 }, { gx: 4, gy: 4 },
          { gx: 2, gy: 4 }, { gx: 2, gy: 3 },
        ],
      },
      {
        label: 'Orange',
        waypoints: [
          { gx: 5, gy: 3 }, { gx: 5, gy: 4 }, { gx: 7, gy: 4 },
          { gx: 7, gy: 7 }, { gx: 4, gy: 7 }, { gx: 4, gy: 4 },
          { gx: 5, gy: 4 }, { gx: 5, gy: 3 },
        ],
      },
      {
        label: 'Green',
        waypoints: [
          { gx: 3, gy: 7 }, { gx: 4, gy: 7 }, { gx: 4, gy: 4 },
          { gx: 2, gy: 4 }, { gx: 2, gy: 7 }, { gx: 3, gy: 7 },
        ],
      },
    ];

    for (const def of charDefs) {
      const startPos = this.toScreen(def.waypoints[0].gx + 0.5, def.waypoints[0].gy + 0.5);
      const palette = PALETTES[def.label];
      const nameKey = def.label.toLowerCase();

      // Shadow sprite (stays at ground level)
      const shadow = this.add.sprite(startPos.x, startPos.y + 3, 'shadow-char');
      shadow.setOrigin(0.5, 0.5);
      this.charContainer.add(shadow);

      // Character sprite
      const sprite = this.add.sprite(startPos.x, startPos.y, `char-${nameKey}-0`);
      sprite.setOrigin(12 / 24, 40 / 46); // foot position
      this.charContainer.add(sprite);

      const ch: IsoCharacter = {
        sprite,
        shadow,
        gridX: def.waypoints[0].gx,
        gridY: def.waypoints[0].gy,
        screenX: startPos.x,
        screenY: startPos.y,
        palette,
        currentWP: 0,
        waypoints: def.waypoints,
        bobOffset: 0,
        label: def.label,
        isMoving: false,
        emoteSprite: null,
      };

      this.characters.push(ch);

      // Bob animation — only moves the character sprite, shadow stays
      this.tweens.add({
        targets: ch,
        bobOffset: -2,
        duration: 500 + Math.random() * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          ch.sprite.setY(ch.screenY + ch.bobOffset);
          ch.sprite.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 8);
          ch.shadow.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 7);
        },
      });
    }
  }

  // ─── Character Movement ───────────────────────────────────────
  private animateCharacters(): void {
    for (let i = 0; i < this.characters.length; i++) {
      this.time.delayedCall(i * 800, () => {
        this.moveCharacterToNextWP(this.characters[i], i);
      });
    }
  }

  private moveCharacterToNextWP(ch: IsoCharacter, index: number): void {
    const nextIdx = (ch.currentWP + 1) % ch.waypoints.length;
    const nextWP = ch.waypoints[nextIdx];
    const target = this.toScreen(nextWP.gx + 0.5, nextWP.gy + 0.5);
    const speed = 1800 + index * 300;
    const nameKey = ch.label.toLowerCase();

    ch.isMoving = true;
    // Start walk animation
    ch.sprite.play(`char-${nameKey}-walk`);

    this.tweens.add({
      targets: ch,
      screenX: target.x,
      screenY: target.y,
      duration: speed,
      ease: 'Linear',
      onUpdate: () => {
        ch.gridX = nextWP.gx;
        ch.gridY = nextWP.gy;
        ch.sprite.setX(ch.screenX);
        ch.sprite.setY(ch.screenY + ch.bobOffset);
        ch.shadow.setPosition(ch.screenX, ch.screenY + 3);
        ch.sprite.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 8);
        ch.shadow.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 7);
      },
      onComplete: () => {
        ch.currentWP = nextIdx;
        ch.gridX = nextWP.gx;
        ch.gridY = nextWP.gy;
        ch.isMoving = false;
        // Stop walk animation, show idle frame
        ch.sprite.stop();
        ch.sprite.setTexture(`char-${nameKey}-0`);

        const pause = 400 + Math.random() * 800;
        this.time.delayedCall(pause, () => {
          this.moveCharacterToNextWP(ch, index);
        });
      },
    });
  }

  // ─── Emote System (sprite-based) ─────────────────────────────
  private startEmoteSystem(): void {
    this.time.addEvent({
      delay: 4000,
      callback: () => this.triggerRandomEmote(),
      callbackScope: this,
      loop: true,
    });
  }

  private triggerRandomEmote(): void {
    const ch = this.characters[Math.floor(Math.random() * this.characters.length)];
    if (ch.emoteSprite) return;

    const emotes = ['heart', 'music', 'star', 'zzz', 'happy'];
    const emoteKey = emotes[Math.floor(Math.random() * emotes.length)];

    const emoteSprite = this.add.sprite(ch.screenX, ch.screenY - 38, `emote-${emoteKey}`);
    emoteSprite.setOrigin(0.5, 1).setDepth(this.isoDepth(ch.gridX, ch.gridY) + 9);
    this.charContainer.add(emoteSprite);
    ch.emoteSprite = emoteSprite;

    this.tweens.add({
      targets: emoteSprite,
      y: ch.screenY - 52,
      alpha: 0,
      duration: 2200,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        emoteSprite.setX(ch.screenX);
        emoteSprite.setDepth(this.isoDepth(ch.gridX, ch.gridY) + 9);
      },
      onComplete: () => {
        emoteSprite.destroy();
        ch.emoteSprite = null;
      },
    });
  }

  // ─── UI Overlay ───────────────────────────────────────────────
  private drawUIOverlay(width: number): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xfef9f0, 0.92);
    g.fillRoundedRect(4, 4, width - 8, 34, 6);
    g.lineStyle(2, 0xe8d0b0, 1);
    g.strokeRoundedRect(4, 4, width - 8, 34, 6);
    g.lineStyle(1, 0xd4b898, 0.5);
    g.strokeRoundedRect(6, 6, width - 12, 30, 5);
    g.fillStyle(0xd4b898, 1);
    g.fillRect(10, 10, 2, 2);
    g.fillRect(width - 12, 10, 2, 2);
    g.fillRect(10, 30, 2, 2);
    g.fillRect(width - 12, 30, 2, 2);
    g.setDepth(100);
    this.uiContainer.add(g);

    const iconG = this.make.graphics({ x: 0, y: 0 }, false);
    const ix = 16;
    const iy = 16;
    iconG.fillStyle(0xff9eae, 1);
    iconG.fillTriangle(ix, iy - 4, ix - 5, iy, ix + 5, iy);
    iconG.fillStyle(0xe8d5be, 1);
    iconG.fillRect(ix - 4, iy, 8, 6);
    iconG.fillStyle(0x8b6f47, 1);
    iconG.fillRect(ix - 1, iy + 2, 3, 4);
    iconG.fillStyle(0x87ceeb, 0.8);
    iconG.fillRect(ix + 2, iy + 1, 2, 2);
    iconG.setDepth(101);
    this.uiContainer.add(iconG);

    const villageText = this.add.text(28, 21, 'Tiny Traders Village', {
      fontSize: '10px',
      color: '#6a5040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);
    this.uiContainer.add(villageText);

    const dayText = this.add.text(width / 2, 21, `Day ${this.currentDay}`, {
      fontSize: '11px',
      color: '#c8a040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(101);
    this.uiContainer.add(dayText);

    const sunG = this.make.graphics({ x: 0, y: 0 }, false);
    const sunX = width - 70;
    const sunY = 21;
    sunG.fillStyle(0xffd700, 1);
    sunG.fillCircle(sunX, sunY, 5);
    sunG.fillStyle(0xffe44d, 1);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      sunG.fillRect(sunX + Math.cos(angle) * 7 - 1, sunY + Math.sin(angle) * 7 - 1, 2, 2);
    }
    sunG.fillStyle(0xffee88, 0.6);
    sunG.fillCircle(sunX - 1, sunY - 1, 2);
    sunG.setDepth(101);
    this.uiContainer.add(sunG);

    const weatherText = this.add.text(width - 14, 21, 'AM', {
      fontSize: '9px',
      color: '#c8a060',
      fontFamily: 'monospace',
    }).setOrigin(1, 0.5).setDepth(101);
    this.uiContainer.add(weatherText);
  }

  // ─── Ambient Particles (Graphics — per-frame updates) ─────────
  private createAmbientParticles(width: number, height: number): void {
    const sparkles: { x: number; y: number; phase: number; speed: number; size: number }[] = [];
    for (let i = 0; i < 10; i++) {
      sparkles.push({
        x: 40 + Math.random() * (width - 80),
        y: 50 + Math.random() * (height - 80),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 1.5,
        size: 1 + Math.random() * 1.5,
      });
    }

    const leaves: { x: number; y: number; vx: number; vy: number; rot: number; size: number; color: number }[] = [];
    const leafColors = [0x7ec07a, 0x8edd88, 0x6aaa66, 0xa0d088];
    for (let i = 0; i < 6; i++) {
      leaves.push({
        x: Math.random() * width,
        y: 50 + Math.random() * (height - 80),
        vx: 0.2 + Math.random() * 0.3,
        vy: 0.1 + Math.random() * 0.2,
        rot: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 2,
        color: leafColors[i % leafColors.length],
      });
    }

    const butterflies: { x: number; y: number; phase: number; baseX: number; baseY: number; wingPhase: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const bx = 80 + Math.random() * (width - 160);
      const by = 80 + Math.random() * (height - 160);
      butterflies.push({
        x: bx, y: by, baseX: bx, baseY: by,
        phase: Math.random() * Math.PI * 2,
        wingPhase: Math.random() * Math.PI * 2,
      });
    }

    const pg = this.particleGfx;

    this.tweens.addCounter({
      from: 0, to: 1,
      duration: 4000,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        pg.clear();
        const time = this.time.now * 0.001;

        for (const sp of sparkles) {
          const alpha = 0.3 + 0.4 * Math.sin(time * sp.speed + sp.phase);
          const cx = sp.x + Math.sin(time * 0.3 + sp.phase) * 10;
          const cy = sp.y + Math.cos(time * 0.2 + sp.phase) * 8;
          pg.fillStyle(0xffffff, alpha);
          pg.fillRect(cx - sp.size, cy - 0.5, sp.size * 2, 1);
          pg.fillRect(cx - 0.5, cy - sp.size, 1, sp.size * 2);
          pg.fillStyle(0xfff8c0, alpha * 0.5);
          const ds = sp.size * 0.5;
          pg.fillRect(cx - ds, cy - ds, ds, ds);
          pg.fillRect(cx, cy, ds, ds);
        }

        for (const l of leaves) {
          l.x += l.vx;
          l.y += l.vy + Math.sin(time + l.rot) * 0.3;
          l.rot += 0.02;
          if (l.x > width + 10) l.x = -10;
          if (l.y > height + 10) l.y = 40;
          pg.fillStyle(l.color, 0.45);
          pg.fillEllipse(l.x, l.y, l.size * 2, l.size);
          pg.fillStyle(darken(l.color, 20), 0.25);
          pg.fillRect(l.x - l.size * 0.5, l.y - 0.5, l.size, 1);
        }

        for (const bf of butterflies) {
          bf.phase += 0.008;
          bf.wingPhase += 0.15;
          bf.x = bf.baseX + Math.sin(bf.phase) * 30;
          bf.y = bf.baseY + Math.cos(bf.phase * 0.7) * 15;
          const wingOpen = Math.abs(Math.sin(bf.wingPhase));
          const wingW = 2 + wingOpen * 2;
          pg.fillStyle(0x333333, 0.6);
          pg.fillRect(bf.x - 0.5, bf.y - 1, 1, 3);
          pg.fillStyle(0xffaacc, 0.5 + wingOpen * 0.2);
          pg.fillEllipse(bf.x - wingW, bf.y, wingW, 2);
          pg.fillEllipse(bf.x + wingW, bf.y, wingW, 2);
          pg.fillStyle(0xff88aa, 0.4);
          pg.fillCircle(bf.x - wingW * 0.6, bf.y, 0.8);
          pg.fillCircle(bf.x + wingW * 0.6, bf.y, 0.8);
        }
      },
    });
  }

  // ─── Input ────────────────────────────────────────────────────
  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const { x, y } = pointer;
      if (y < 42) return;
      this.tooltipContainer.removeAll(true);

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
    const tl = this.toScreen(b.gridX, b.gridY);
    const tr = this.toScreen(b.gridX + b.tilesW, b.gridY);
    const br = this.toScreen(b.gridX + b.tilesW, b.gridY + b.tilesH);
    const bl = this.toScreen(b.gridX, b.gridY + b.tilesH);
    const minY = Math.min(tl.y, tr.y) - b.wallHeight;
    const maxY = Math.max(bl.y, br.y);
    const minX = Math.min(tl.x, bl.x) - 5;
    const maxX = Math.max(tr.x, br.x) + 5;
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }

  private showBuildingTooltip(b: IsoBuilding): void {
    const center = this.toScreen(b.gridX + b.tilesW / 2, b.gridY + b.tilesH / 2);
    const tooltipY = center.y - b.wallHeight - 20;
    const bg = this.make.graphics({ x: 0, y: 0 }, false);
    const textContent = `${b.nameKR} (${b.name})`;
    const textWidth = textContent.length * 6 + 16;

    bg.fillStyle(0xfef9f0, 0.95);
    bg.fillRoundedRect(center.x - textWidth / 2, tooltipY - 10, textWidth, 20, 4);
    bg.lineStyle(1, 0xd4b898, 1);
    bg.strokeRoundedRect(center.x - textWidth / 2, tooltipY - 10, textWidth, 20, 4);
    bg.fillStyle(0xfef9f0, 0.95);
    bg.fillTriangle(center.x - 4, tooltipY + 10, center.x + 4, tooltipY + 10, center.x, tooltipY + 15);
    bg.setDepth(51);
    this.tooltipContainer.add(bg);

    const text = this.add.text(center.x, tooltipY, textContent, {
      fontSize: '9px',
      color: '#6a5040',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(52);
    this.tooltipContainer.add(text);

    this.time.delayedCall(2500, () => {
      this.tooltipContainer.removeAll(true);
    });
  }

  private showPlacementHint(x: number, y: number): void {
    const { gx, gy } = this.toGrid(x, y);
    if (gx < 0 || gx >= this.GRID_SIZE || gy < 0 || gy >= this.GRID_SIZE) return;

    for (const b of this.buildings) {
      if (gx >= b.gridX && gx < b.gridX + b.tilesW && gy >= b.gridY && gy < b.gridY + b.tilesH) return;
    }

    const { x: sx, y: sy } = this.toScreen(gx, gy);
    const centerY = sy + this.TILE_H / 2;

    const highlight = this.make.graphics({ x: 0, y: 0 }, false);
    highlight.fillStyle(0x4caf50, 0.2);
    highlight.beginPath();
    highlight.moveTo(sx, sy);
    highlight.lineTo(sx + this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.lineTo(sx, sy + this.TILE_H);
    highlight.lineTo(sx - this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.closePath();
    highlight.fillPath();
    highlight.lineStyle(1, 0x4caf50, 0.4);
    highlight.beginPath();
    highlight.moveTo(sx, sy);
    highlight.lineTo(sx + this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.lineTo(sx, sy + this.TILE_H);
    highlight.lineTo(sx - this.TILE_W / 2, sy + this.TILE_H / 2);
    highlight.closePath();
    highlight.strokePath();
    highlight.setDepth(50);
    this.tooltipContainer.add(highlight);

    const plus = this.add.text(sx, centerY - 4, '+', {
      fontSize: '16px',
      color: '#4caf50',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51);
    this.tooltipContainer.add(plus);

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

  // ─── Update loop ──────────────────────────────────────────────
  update(): void {
    // Character depth sorting is handled in tweens
    // Walk animation is handled by Phaser's animation system
    // No per-frame redraw needed — sprites handle everything
  }
}
