import Phaser from 'phaser';

// Returns a clamped UI scale factor based on current viewport vs. base size.
export function getUiScale(scale, options = {}) {
  const {
    baseWidth = 1366,
    baseHeight = 768,
    min = 0.65,
    max = 1.2,
  } = options;

  const raw = Math.min(scale.width / baseWidth, scale.height / baseHeight);
  return Phaser.Math.Clamp(raw, min, max);
}

// Helper to bind/unbind resize handlers with automatic cleanup.
export function attachResize(scene, handler) {
  scene.scale.on('resize', handler, scene);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', handler, scene);
  });
}
