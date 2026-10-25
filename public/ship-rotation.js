import * as T from './vendor/three.module.js';
export const MIN_ROTATION_SPEED=.25,MAX_ROTATION_SPEED=3;
export function rotationSpeed(value){const n=Number(value);return Number.isFinite(n)?T.MathUtils.clamp(n,MIN_ROTATION_SPEED,MAX_ROTATION_SPEED):1}
export function rotateShip(q,input,dt,multiplier=1){const finite=v=>Number.isFinite(v)?T.MathUtils.clamp(v,-1,1):0,pitch=finite(input.pitch),yaw=finite(input.yaw),roll=finite(input.roll),scale=Math.min(1,1/Math.max(Math.hypot(pitch,yaw,roll),1)),step=Math.max(0,Math.min(.1,dt))*rotationSpeed(multiplier)*scale;const turn=new T.Quaternion().setFromEuler(new T.Euler(pitch*step*.95,yaw*step*1.05,roll*step*1.05,'YXZ'));return q.multiply(turn).normalize()}
