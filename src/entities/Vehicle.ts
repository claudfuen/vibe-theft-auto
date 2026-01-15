import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

import { Player } from './Player'

export class Vehicle {
  mesh: Mesh
  private physicsAggregate: PhysicsAggregate
  private wheels: Mesh[] = []
  private driver: Player | null = null

  private enginePower = 2000
  private maxSpeed = 30
  private steeringSpeed = 2
  private brakeForce = 1500

  private currentSteering = 0
  private throttleInput = 0
  private steeringInput = 0
  private isBraking = false

  constructor(private scene: Scene, position: Vector3, color: Color3) {
    this.mesh = this.createVehicleMesh(color)
    this.mesh.position.copyFrom(position)
    this.mesh.rotationQuaternion = Quaternion.Identity()

    this.physicsAggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 1200, friction: 0.3, restitution: 0.1 },
      scene
    )

    // Lower center of mass for stability
    this.physicsAggregate.body.setMassProperties({
      centerOfMass: new Vector3(0, -0.3, 0)
    })

    this.createWheels()
  }

  private createVehicleMesh(color: Color3): Mesh {
    // Car body
    const body = MeshBuilder.CreateBox('carBody', {
      width: 2,
      height: 1,
      depth: 4
    }, this.scene)

    // Roof
    const roof = MeshBuilder.CreateBox('carRoof', {
      width: 1.6,
      height: 0.6,
      depth: 2
    }, this.scene)
    roof.position.y = 0.8
    roof.position.z = -0.3
    roof.parent = body

    const material = new StandardMaterial('carMat', this.scene)
    material.diffuseColor = color
    body.material = material
    roof.material = material

    body.receiveShadows = true
    roof.receiveShadows = true

    return body
  }

  private createWheels() {
    const wheelPositions = [
      new Vector3(-1, -0.5, 1.3),   // Front left
      new Vector3(1, -0.5, 1.3),    // Front right
      new Vector3(-1, -0.5, -1.3),  // Rear left
      new Vector3(1, -0.5, -1.3)    // Rear right
    ]

    const wheelMaterial = new StandardMaterial('wheelMat', this.scene)
    wheelMaterial.diffuseColor = new Color3(0.1, 0.1, 0.1)

    wheelPositions.forEach((pos, i) => {
      const wheel = MeshBuilder.CreateCylinder(`wheel${i}`, {
        height: 0.3,
        diameter: 0.7
      }, this.scene)
      wheel.rotation.z = Math.PI / 2
      wheel.position.copyFrom(pos)
      wheel.material = wheelMaterial
      wheel.parent = this.mesh
      this.wheels.push(wheel)
    })
  }

  setDriver(player: Player) {
    this.driver = player
  }

  removeDriver() {
    this.driver = null
    this.throttleInput = 0
    this.steeringInput = 0
    this.isBraking = false
  }

  setInput(throttle: number, steering: number, brake: boolean) {
    this.throttleInput = throttle
    this.steeringInput = steering
    this.isBraking = brake
  }

  getExitPosition(): Vector3 {
    // Exit to the left of the car
    const leftDir = new Vector3(-1, 0, 0)
    if (this.mesh.rotationQuaternion) {
      leftDir.rotateByQuaternionToRef(this.mesh.rotationQuaternion, leftDir)
    }
    return this.mesh.position.add(leftDir.scale(2)).add(new Vector3(0, 1, 0))
  }

  getSpeed(): number {
    const vel = this.physicsAggregate.body.getLinearVelocity()
    return Math.sqrt(vel.x * vel.x + vel.z * vel.z)
  }

  update(deltaTime: number) {
    if (!this.driver) {
      // Apply damping when no driver
      const vel = this.physicsAggregate.body.getLinearVelocity()
      this.physicsAggregate.body.setLinearVelocity(vel.scale(0.99))
      return
    }

    const speed = this.getSpeed()

    // Steering
    this.currentSteering += (this.steeringInput - this.currentSteering) * this.steeringSpeed * deltaTime * 5

    // Apply steering rotation
    if (speed > 0.5) {
      const steerAmount = this.currentSteering * deltaTime * (speed / 10)
      const angVel = this.physicsAggregate.body.getAngularVelocity()
      this.physicsAggregate.body.setAngularVelocity(new Vector3(
        angVel.x * 0.9,
        steerAmount * 3,
        angVel.z * 0.9
      ))
    }

    // Get forward direction
    const forward = new Vector3(0, 0, 1)
    if (this.mesh.rotationQuaternion) {
      forward.rotateByQuaternionToRef(this.mesh.rotationQuaternion, forward)
    }

    // Apply throttle
    if (this.throttleInput !== 0 && speed < this.maxSpeed) {
      const force = forward.scale(this.throttleInput * this.enginePower * deltaTime)
      this.physicsAggregate.body.applyForce(force, this.mesh.position)
    }

    // Apply brakes
    if (this.isBraking && speed > 0.1) {
      const vel = this.physicsAggregate.body.getLinearVelocity()
      const brakeDir = vel.normalize().scale(-1)
      this.physicsAggregate.body.applyForce(brakeDir.scale(this.brakeForce * deltaTime), this.mesh.position)
    }

    // Keep car upright (anti-roll)
    if (this.mesh.rotationQuaternion) {
      const euler = this.mesh.rotationQuaternion.toEulerAngles()
      const uprightQuat = Quaternion.FromEulerAngles(0, euler.y, 0)
      Quaternion.SlerpToRef(this.mesh.rotationQuaternion, uprightQuat, deltaTime * 2, this.mesh.rotationQuaternion)
    }

    // Animate front wheels steering
    this.wheels[0].rotation.y = this.currentSteering * 0.5
    this.wheels[1].rotation.y = this.currentSteering * 0.5

    // Animate wheel rotation based on speed
    const wheelRotation = speed * deltaTime * 3
    this.wheels.forEach(wheel => {
      wheel.rotation.x += wheelRotation * (this.throttleInput >= 0 ? 1 : -1)
    })
  }

  addToShadowGenerator(shadowGenerator: { addShadowCaster: (mesh: Mesh) => void }) {
    shadowGenerator.addShadowCaster(this.mesh)
  }
}
