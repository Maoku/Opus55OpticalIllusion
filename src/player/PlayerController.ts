import * as THREE from 'three';
import type { InputManager } from '../core/input';
import type { CollisionWorld } from '../world/collision';
import { EYE_HEIGHT, PLAYER_RADIUS } from '../world/layout';
import type { Settings } from '../app/store';

export const WALK_SPEED = 1.4;
export const RUN_SPEED = 2.5;
/** 速度が目標に近づく速さ（1/s）。加減速をなめらかにする */
const ACCEL = 7;
/** マウス 1px あたりの回転（rad） */
const LOOK_RATE = 0.0022;
const MAX_PITCH = THREE.MathUtils.degToRad(85);

export class PlayerController {
  /** 目の位置 */
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 0);
  yaw = 0;
  pitch = 0;
  private readonly velocity = new THREE.Vector2();

  constructor(
    private readonly collision: CollisionWorld,
    private readonly input: InputManager,
    private readonly getSettings: () => Settings,
  ) {}

  teleport(x: number, z: number, yaw = this.yaw, pitch = 0): void {
    const p = this.collision.resolve({ x, z }, PLAYER_RADIUS);
    this.position.set(p.x, EYE_HEIGHT, p.z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.velocity.set(0, 0);
  }

  /** 見ている方向（水平成分） */
  forward(target = new THREE.Vector3()): THREE.Vector3 {
    return target.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /** カメラの姿勢（yaw → pitch の順） */
  quaternion(target = new THREE.Quaternion()): THREE.Quaternion {
    return target.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  update(dt: number, enabled: boolean): void {
    const settings = this.getSettings();
    const look = this.input.consumeLook();
    if (enabled) {
      const k = LOOK_RATE * settings.mouseSensitivity;
      this.yaw -= look.dx * k;
      this.pitch -= look.dy * k * (settings.invertY ? -1 : 1);
      this.pitch = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
    }

    const move = enabled ? this.input.getMove() : { x: 0, y: 0, run: false };
    const speed = move.run ? RUN_SPEED : WALK_SPEED;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // 前方 (-sin, -cos)、右 (cos, -sin)
    const tx = (-sin * move.y + cos * move.x) * speed;
    const tz = (-cos * move.y - sin * move.x) * speed;
    const a = 1 - Math.exp(-ACCEL * dt);
    this.velocity.x += (tx - this.velocity.x) * a;
    this.velocity.y += (tz - this.velocity.y) * a;
    if (this.velocity.lengthSq() < 1e-6 && tx === 0 && tz === 0) {
      this.velocity.set(0, 0);
      return;
    }

    const next = this.collision.move(
      { x: this.position.x, z: this.position.z },
      { x: this.velocity.x * dt, z: this.velocity.y * dt },
      PLAYER_RADIUS,
    );
    // 壁に当たって進めなかった成分は速度からも取り除く
    if (dt > 0) {
      this.velocity.x = (next.x - this.position.x) / dt;
      this.velocity.y = (next.z - this.position.z) / dt;
    }
    this.position.x = next.x;
    this.position.z = next.z;
  }
}
