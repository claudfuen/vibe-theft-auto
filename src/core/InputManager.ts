import { Scene } from '@babylonjs/core/scene'
import { Vector2 } from '@babylonjs/core/Maths/math.vector'

export class InputManager {
  private keys: Map<string, boolean> = new Map()
  private keysJustPressed: Set<string> = new Set()
  private keysJustReleased: Set<string> = new Set()
  private mouseButtons: Map<number, boolean> = new Map()
  private mouseButtonsJustPressed: Set<number> = new Set()
  private mouseDelta: Vector2 = Vector2.Zero()
  private _isPointerLocked: boolean = false

  constructor(private scene: Scene, private canvas: HTMLCanvasElement) {
    this.setupKeyboard()
    this.setupMouse()
  }

  private setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.get(e.code)) {
        this.keysJustPressed.add(e.code)
      }
      this.keys.set(e.code, true)
    })

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false)
      this.keysJustReleased.add(e.code)
    })
  }

  private setupMouse() {
    this.canvas.addEventListener('click', () => {
      if (!this._isPointerLocked) {
        this.canvas.requestPointerLock()
      }
    })

    document.addEventListener('pointerlockchange', () => {
      this._isPointerLocked = document.pointerLockElement === this.canvas
    })

    window.addEventListener('mousemove', (e) => {
      if (this._isPointerLocked) {
        this.mouseDelta.x += e.movementX
        this.mouseDelta.y += e.movementY
      }
    })

    window.addEventListener('mousedown', (e) => {
      if (!this.mouseButtons.get(e.button)) {
        this.mouseButtonsJustPressed.add(e.button)
      }
      this.mouseButtons.set(e.button, true)
    })

    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.set(e.button, false)
    })
  }

  isKeyPressed(code: string): boolean {
    return this.keys.get(code) || false
  }

  isKeyJustPressed(code: string): boolean {
    return this.keysJustPressed.has(code)
  }

  isMouseButtonPressed(button: number): boolean {
    return this.mouseButtons.get(button) || false
  }

  isMouseButtonJustPressed(button: number): boolean {
    return this.mouseButtonsJustPressed.has(button)
  }

  getMouseDelta(): Vector2 {
    return this.mouseDelta.clone()
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked
  }

  update() {
    this.keysJustPressed.clear()
    this.keysJustReleased.clear()
    this.mouseButtonsJustPressed.clear()
    this.mouseDelta.set(0, 0)
  }
}
