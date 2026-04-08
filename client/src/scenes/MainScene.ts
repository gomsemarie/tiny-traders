import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload(): void {
    // Phase 2: 도트 스프라이트 에셋 로드
  }

  create(): void {
    const { width, height } = this.scale;

    // 배경 그리드 표시 (Phase 2에서 시설 그리드로 교체)
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0xdde1e7, 0.5);

    const gridSize = 32;
    for (let x = 0; x <= width; x += gridSize) {
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
    }
    graphics.strokePath();

    // 타이틀 텍스트
    this.add
      .text(width / 2, height / 2 - 20, '🏘️ Tiny Traders', {
        fontSize: '28px',
        color: '#334155',
        fontFamily: 'Inter, system-ui, sans-serif',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'Phase 0 — 프로젝트 셋업 완료!', {
        fontSize: '14px',
        color: '#94a3b8',
        fontFamily: 'Inter, system-ui, sans-serif',
      })
      .setOrigin(0.5);
  }

  update(): void {
    // Phase 2: 캐릭터 이동, 시설 인터랙션
  }
}
