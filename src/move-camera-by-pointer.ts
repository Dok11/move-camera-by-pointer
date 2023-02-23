import { TransformNode } from '@babylonjs/core';
import { Behavior } from '@babylonjs/core/Behaviors/behavior';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';
import { Node } from '@babylonjs/core/node';
import { Nullable } from '@babylonjs/core/types';


export interface MoveCameraByPointerOptions {
  readonly directionForces?: [number, number] | number;
  readonly pointerElement?: HTMLElement | Document;
  readonly onBeforeUpdate?: (forces: [number, number]) => [number, number];
}


const defaultMoveCameraByPointerOptions: MoveCameraByPointerOptions = {
  directionForces: 0.03,
  pointerElement: document,
};


export class MoveCameraByPointer implements Behavior<Node> {
  public readonly name = 'MoveCameraByPointer';
  public isEnable = true;

  private options: MoveCameraByPointerOptions = defaultMoveCameraByPointerOptions;
  private camera: Nullable<FreeCamera> = null;
  private target: Nullable<Node> = null;
  private rotationTarget!: TransformNode;
  private targetAdditionalRotation = new Vector2(0, 0);


  constructor(options: MoveCameraByPointerOptions = defaultMoveCameraByPointerOptions) {
    this.options = { ...defaultMoveCameraByPointerOptions, ...options };
  }


  public init(): void {}


  public attach(target: Node): void {
    this.target = target;

    // Create a parent for target that can be rotated
    this.rotationTarget = new TransformNode('rotationTarget', target.getScene());
    this.rotationTarget.parent = this.target.parent;
    this.target.parent = this.rotationTarget;

    const scene = target.getScene();
    if (scene) {
      if (this.options.pointerElement) {
        this.options.pointerElement.addEventListener('pointermove', this.handlePointerEvent.bind(this));
      } else {
        scene.onPointerObservable.add(this.handlePointerEvent.bind(this), PointerEventTypes.POINTERMOVE);
      }

      scene.onBeforeRenderObservable.add(this.beforeRender.bind(this));
    }

    if (target instanceof FreeCamera) {
      this.camera = target;
    }
  }


  public detach(): void {
    if (this.options.pointerElement) {
      this.options.pointerElement?.removeEventListener('pointermove', this.handlePointerEvent.bind(this));
    } else {
      this.target?.getScene()?.onPointerObservable.removeCallback(this.handlePointerEvent.bind(this));
    }

    this.target?.getScene()?.onBeforeRenderObservable.removeCallback(this.beforeRender.bind(this));

    this.target = null;
    this.camera = null;
  }


  private beforeRender(): void {
    this.rotationTarget.rotation.x = this.targetAdditionalRotation.x;
    this.rotationTarget.rotation.y = this.targetAdditionalRotation.y;
  }


  private handlePointerEvent(eventData: any): void {
    if (!this.isEnable || !this.camera) { return; }

    const scene = this.camera.getScene();
    if (!scene) { return; }

    const viewport = scene.activeCamera?.viewport;
    if (!viewport) { return; }

    const canvas = scene.getEngine().getRenderingCanvas();
    if (!canvas) { return; }

    const clientX = eventData.event?.clientX ?? eventData.clientX;
    const clientY = eventData.event?.clientY ?? eventData.clientY;

    const pointerPos = clientX || clientY
      ? new Vector2(clientX, clientY)
      : Vector2.Zero();

    const viewportVector = new Vector2(canvas.clientWidth, canvas.clientHeight);

    const relativePointerPos = pointerPos
      .divide(viewportVector)
      .subtract(new Vector2(0.5, 0.5))
      .scale(2);

    let horizontalForce;
    let verticalForce;

    if (Array.isArray(this.options.directionForces)) {
      horizontalForce = this.options.directionForces[0];
      verticalForce = this.options.directionForces[1];
    } else {
      horizontalForce = this.options.directionForces || 0;
      verticalForce = this.options.directionForces || 0;
    }

    if (relativePointerPos.x > 0) {
      horizontalForce *= -1;
    }

    if (relativePointerPos.y > 0) {
      verticalForce *= -1;
    }

    // Multiply forces to relative pointer position
    const scaledForces: [number, number] = [
      horizontalForce * Math.abs(relativePointerPos.x),
      verticalForce * Math.abs(relativePointerPos.y),
    ];

    // Use callback to modify forces
    const forces = this.options.onBeforeUpdate
      ? this.options.onBeforeUpdate(scaledForces)
      : scaledForces;

    this.targetAdditionalRotation.x = forces[1];
    this.targetAdditionalRotation.y = forces[0];
  }
}
