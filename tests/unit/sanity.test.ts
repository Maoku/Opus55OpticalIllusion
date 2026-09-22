import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

describe('three.js', () => {
  it('ESM としてインポートできる', () => {
    const v = new THREE.Vector3(1, 2, 2);
    expect(v.length()).toBe(3);
  });
});
