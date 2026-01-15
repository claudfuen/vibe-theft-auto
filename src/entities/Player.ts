import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

import { InputManager } from '../core/InputManager'
import { Vehicle } from './Vehicle'
import { CombatSystem } from '../systems/CombatSystem'

export class Player {
  mesh: Mesh
  private camera: FreeCamera
  private physicsAggregate: PhysicsAggregate
  private inputManager: InputManager
  private combatSystem: CombatSystem

  private moveSpeed = 5
  private sprintMultiplier = 2
  private jumpForce = 5
  private mouseSensitivity = 0.002
  private cameraDistance = 8
  private cameraHeight = 3

  private yaw = 0
  private pitch = 0.3

  private isGrounded = true
  private _isInVehicle = false
  private currentVehicle: Vehicle | null = null

  private health = 100
  private currentWeaponIndex = 0
  private weapons = ['Fists', 'Pistol', 'SMG', 'Shotgun']

  constructor(
    private scene: Scene,
    inputManager: InputManager,
    combatSystem: CombatSystem,
    private canvas: HTMLCanvasElement
  ) {
    this.inputManager = inputManager
    this.combatSystem = combatSystem

    // Create player mesh (capsule-like shape)
    this.mesh = this.createPlayerMesh()
    this.physicsAggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 80, friction: 0.5, restitution: 0 },
      scene
    )

    // Lock rotation so player stays upright
    this.physicsAggregate.body.setMassProperties({
      inertia: Vector3.Zero()
    })

    // Create camera
    this.camera = new FreeCamera('playerCamera', Vector3.Zero(), scene)
    this.camera.minZ = 0.1
    scene.activeCamera = this.camera
  }

  private createPlayerMesh(): Mesh {
    // Body
    const body = MeshBuilder.CreateCapsule('playerBody', {
      height: 1.8,
      radius: 0.3
    }, this.scene)

    const material = new StandardMaterial('playerMat', this.scene)
    material.diffuseColor = new Color3(0.2, 0.4, 0.8)
    body.material = material
    body.checkCollisions = true
    body.receiveShadows = true

    return body
  }

  get isInVehicle(): boolean {
    return this._isInVehicle
  }

  enterVehicle(vehicle: Vehicle) {
    this._isInVehicle = true
    this.currentVehicle = vehicle
    vehicle.setDriver(this)
    this.mesh.setEnabled(false)
    this.physicsAggregate.body.setMotionType(0) // Static

    // Update UI
    const speedUI = document.getElementById('speed')
    if (speedUI) speedUI.style.display = 'block'
  }

  exitVehicle() {
    if (!this.currentVehicle) return

    const exitPos = this.currentVehicle.getExitPosition()
    this.mesh.position.copyFrom(exitPos)
    this.mesh.setEnabled(true)
    this.physicsAggregate.body.setMotionType(2) // Dynamic

    this.currentVehicle.removeDriver()
    this.currentVehicle = null
    this._isInVehicle = false

    // Update UI
    const speedUI = document.getElementById('speed')
    if (speedUI) speedUI.style.display = 'none'
  }

  update(deltaTime: number) {
    if (this._isInVehicle && this.currentVehicle) {
      this.updateInVehicle(deltaTime)
    } else {
      this.updateOnFoot(deltaTime)
    }

    this.handleWeaponSwitch()
    this.handleShooting()
    this.updateUI()
  }

  private updateOnFoot(_deltaTime: number) {
    // Camera rotation from mouse
    if (this.inputManager.isPointerLocked) {
      const mouseDelta = this.inputManager.getMouseDelta()
      this.yaw -= mouseDelta.x * this.mouseSensitivity
      this.pitch -= mouseDelta.y * this.mouseSensitivity
      this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch))
    }

    // Movement input
    let moveDir = Vector3.Zero()
    const forward = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw))

    if (this.inputManager.isKeyPressed('KeyW')) moveDir.addInPlace(forward)
    if (this.inputManager.isKeyPressed('KeyS')) moveDir.subtractInPlace(forward)
    if (this.inputManager.isKeyPressed('KeyA')) moveDir.subtractInPlace(right)
    if (this.inputManager.isKeyPressed('KeyD')) moveDir.addInPlace(right)

    if (moveDir.length() > 0) {
      moveDir.normalize()
    }

    // Apply movement
    let speed = this.moveSpeed
    if (this.inputManager.isKeyPressed('ShiftLeft')) {
      speed *= this.sprintMultiplier
    }

    // Get current velocity and modify horizontal component
    const currentVel = this.physicsAggregate.body.getLinearVelocity()
    const targetVel = moveDir.scale(speed)

    this.physicsAggregate.body.setLinearVelocity(new Vector3(
      targetVel.x,
      currentVel.y,
      targetVel.z
    ))

    // Jump
    this.checkGrounded()
    if (this.inputManager.isKeyJustPressed('Space') && this.isGrounded) {
      const vel = this.physicsAggregate.body.getLinearVelocity()
      this.physicsAggregate.body.setLinearVelocity(new Vector3(vel.x, this.jumpForce, vel.z))
    }

    // Update camera position (third person)
    const cameraOffset = new Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * this.cameraDistance,
      Math.sin(this.pitch) * this.cameraDistance + this.cameraHeight,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * this.cameraDistance
    )

    this.camera.position = this.mesh.position.add(cameraOffset)
    this.camera.setTarget(this.mesh.position.add(new Vector3(0, 1, 0)))
  }

  private updateInVehicle(_deltaTime: number) {
    if (!this.currentVehicle) return

    // Camera rotation
    if (this.inputManager.isPointerLocked) {
      const mouseDelta = this.inputManager.getMouseDelta()
      this.yaw -= mouseDelta.x * this.mouseSensitivity
      this.pitch -= mouseDelta.y * this.mouseSensitivity
      this.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitch))
    }

    // Vehicle controls
    let throttle = 0
    let steering = 0
    let brake = false

    if (this.inputManager.isKeyPressed('KeyW')) throttle = 1
    if (this.inputManager.isKeyPressed('KeyS')) throttle = -0.5
    if (this.inputManager.isKeyPressed('KeyA')) steering = 1
    if (this.inputManager.isKeyPressed('KeyD')) steering = -1
    if (this.inputManager.isKeyPressed('Space')) brake = true

    this.currentVehicle.setInput(throttle, steering, brake)

    // Camera follows vehicle
    const vehiclePos = this.currentVehicle.mesh.position

    const cameraOffset = new Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch) * this.cameraDistance * 1.5,
      Math.sin(this.pitch) * this.cameraDistance + this.cameraHeight + 2,
      -Math.cos(this.yaw) * Math.cos(this.pitch) * this.cameraDistance * 1.5
    )

    this.camera.position = vehiclePos.add(cameraOffset)
    this.camera.setTarget(vehiclePos.add(new Vector3(0, 1.5, 0)))
  }

  private checkGrounded() {
    const vel = this.physicsAggregate.body.getLinearVelocity()
    this.isGrounded = Math.abs(vel.y) < 0.1
  }

  private handleWeaponSwitch() {
    if (this.inputManager.isKeyJustPressed('Digit1')) this.currentWeaponIndex = 0
    if (this.inputManager.isKeyJustPressed('Digit2')) this.currentWeaponIndex = 1
    if (this.inputManager.isKeyJustPressed('Digit3')) this.currentWeaponIndex = 2
    if (this.inputManager.isKeyJustPressed('Digit4')) this.currentWeaponIndex = 3
  }

  private handleShooting() {
    if (this.inputManager.isMouseButtonJustPressed(0) && this.currentWeaponIndex > 0) {
      // Raycast from camera
      const ray = this.scene.createPickingRay(
        this.canvas.width / 2,
        this.canvas.height / 2,
        null,
        this.camera
      )

      this.combatSystem.shoot(ray, this.weapons[this.currentWeaponIndex], this.mesh)
    }
  }

  private updateUI() {
    const healthUI = document.getElementById('health')
    const weaponUI = document.getElementById('weapon')
    const speedUI = document.getElementById('speed')

    if (healthUI) healthUI.textContent = `Health: ${this.health}`
    if (weaponUI) weaponUI.textContent = `Weapon: ${this.weapons[this.currentWeaponIndex]}`

    if (speedUI && this._isInVehicle && this.currentVehicle) {
      const speed = Math.round(this.currentVehicle.getSpeed() * 3.6) // m/s to km/h
      speedUI.textContent = `Speed: ${speed} km/h`
    }
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    if (this.health <= 0) {
      this.die()
    }
  }

  private die() {
    // Respawn
    this.health = 100
    this.mesh.position = new Vector3(0, 2, 0)
    if (this._isInVehicle) {
      this.exitVehicle()
    }
  }
}
