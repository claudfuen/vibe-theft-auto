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
  private externalMesh: Mesh | null = null

  // Tuned vehicle parameters
  private enginePower = 8000
  private maxSpeed = 40
  private steeringSpeed = 4
  private brakeForce = 5000
  private friction = 0.95

  private currentSteering = 0
  private throttleInput = 0
  private steeringInput = 0
  private isBraking = false

  // AI driving (for fleeing)
  private isAIDriving = false
  private aiTarget: Vector3 | null = null

  constructor(private scene: Scene, position: Vector3, color: Color3, externalMesh?: Mesh) {
    if (externalMesh) {
      // Use external mesh - create invisible physics box
      this.externalMesh = externalMesh
      this.mesh = MeshBuilder.CreateBox('carPhysics', {
        width: 2.2,
        height: 1.2,
        depth: 4.5
      }, this.scene)
      this.mesh.visibility = 0
      // Parent visual mesh to physics mesh
      this.externalMesh.parent = this.mesh
      this.externalMesh.position.y = -0.3
      this.externalMesh.scaling.setAll(1.5) // Scale up the model
    } else {
      this.mesh = this.createVehicleMesh(color)
      this.createWheels()
    }

    // Spawn car slightly above ground to prevent embedding
    this.mesh.position.set(position.x, position.y + 1.5, position.z)
    this.mesh.rotationQuaternion = Quaternion.Identity()

    this.physicsAggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 1200, friction: 0.8, restitution: 0.1 },
      scene
    )

    // Lower center of mass for stability
    this.physicsAggregate.body.setMassProperties({
      centerOfMass: new Vector3(0, -0.4, 0)
    })
  }

  private createVehicleMesh(color: Color3): Mesh {
    // Main body - more car-like shape
    const body = MeshBuilder.CreateBox('carBody', {
      width: 2.2,
      height: 0.8,
      depth: 4.5
    }, this.scene)

    // Hood (front)
    const hood = MeshBuilder.CreateBox('carHood', {
      width: 2,
      height: 0.3,
      depth: 1.2
    }, this.scene)
    hood.position.y = 0.2
    hood.position.z = 1.4
    hood.parent = body

    // Cabin
    const cabin = MeshBuilder.CreateBox('carCabin', {
      width: 1.9,
      height: 0.7,
      depth: 1.8
    }, this.scene)
    cabin.position.y = 0.7
    cabin.position.z = -0.2
    cabin.parent = body

    // Trunk
    const trunk = MeshBuilder.CreateBox('carTrunk', {
      width: 2,
      height: 0.4,
      depth: 1
    }, this.scene)
    trunk.position.y = 0.2
    trunk.position.z = -1.5
    trunk.parent = body

    // Windows (dark material)
    const windowMat = new StandardMaterial('windowMat', this.scene)
    windowMat.diffuseColor = new Color3(0.1, 0.15, 0.2)
    windowMat.specularColor = new Color3(0.5, 0.5, 0.5)

    const frontWindow = MeshBuilder.CreateBox('frontWindow', {
      width: 1.7,
      height: 0.5,
      depth: 0.1
    }, this.scene)
    frontWindow.position.y = 0.65
    frontWindow.position.z = 0.85
    frontWindow.rotation.x = -0.3
    frontWindow.material = windowMat
    frontWindow.parent = body

    const rearWindow = MeshBuilder.CreateBox('rearWindow', {
      width: 1.7,
      height: 0.45,
      depth: 0.1
    }, this.scene)
    rearWindow.position.y = 0.6
    rearWindow.position.z = -1.1
    rearWindow.rotation.x = 0.3
    rearWindow.material = windowMat
    rearWindow.parent = body

    // Body material
    const material = new StandardMaterial('carMat', this.scene)
    material.diffuseColor = color
    material.specularColor = new Color3(0.3, 0.3, 0.3)
    body.material = material
    hood.material = material
    cabin.material = material
    trunk.material = material

    body.receiveShadows = true

    return body
  }

  private createWheels() {
    const wheelPositions = [
      new Vector3(-1.1, -0.4, 1.4),   // Front left
      new Vector3(1.1, -0.4, 1.4),    // Front right
      new Vector3(-1.1, -0.4, -1.3),  // Rear left
      new Vector3(1.1, -0.4, -1.3)    // Rear right
    ]

    const wheelMaterial = new StandardMaterial('wheelMat', this.scene)
    wheelMaterial.diffuseColor = new Color3(0.15, 0.15, 0.15)

    const hubMaterial = new StandardMaterial('hubMat', this.scene)
    hubMaterial.diffuseColor = new Color3(0.6, 0.6, 0.6)

    wheelPositions.forEach((pos, i) => {
      // Tire
      const wheel = MeshBuilder.CreateCylinder(`wheel${i}`, {
        height: 0.25,
        diameter: 0.8,
        tessellation: 16
      }, this.scene)
      wheel.rotation.z = Math.PI / 2
      wheel.position.copyFrom(pos)
      wheel.material = wheelMaterial
      wheel.parent = this.mesh

      // Hub cap
      const hub = MeshBuilder.CreateCylinder(`hub${i}`, {
        height: 0.26,
        diameter: 0.4,
        tessellation: 8
      }, this.scene)
      hub.rotation.z = Math.PI / 2
      hub.material = hubMaterial
      hub.parent = wheel

      this.wheels.push(wheel)
    })
  }

  setDriver(player: Player) {
    this.driver = player
    this.isAIDriving = false
    this.aiTarget = null
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

  // Make the car flee from a position (gunshot)
  fleeFrom(position: Vector3) {
    if (this.driver) return // Don't flee if player is driving

    this.isAIDriving = true
    // Flee in opposite direction
    const fleeDir = this.mesh.position.subtract(position).normalize()
    this.aiTarget = this.mesh.position.add(fleeDir.scale(100))
  }

  getExitPosition(): Vector3 {
    const leftDir = new Vector3(-1, 0, 0)
    if (this.mesh.rotationQuaternion) {
      leftDir.rotateByQuaternionToRef(this.mesh.rotationQuaternion, leftDir)
    }
    return this.mesh.position.add(leftDir.scale(2.5)).add(new Vector3(0, 1, 0))
  }

  getSpeed(): number {
    const vel = this.physicsAggregate.body.getLinearVelocity()
    return Math.sqrt(vel.x * vel.x + vel.z * vel.z)
  }

  update(deltaTime: number) {
    // AI driving logic
    if (this.isAIDriving && this.aiTarget) {
      this.updateAIDriving(deltaTime)
    }

    if (!this.driver && !this.isAIDriving) {
      // Apply friction when no driver
      const vel = this.physicsAggregate.body.getLinearVelocity()
      this.physicsAggregate.body.setLinearVelocity(vel.scale(this.friction))
      return
    }

    const speed = this.getSpeed()

    // Steering interpolation
    this.currentSteering += (this.steeringInput - this.currentSteering) * this.steeringSpeed * deltaTime

    // Get forward direction
    const forward = new Vector3(0, 0, 1)
    if (this.mesh.rotationQuaternion) {
      forward.rotateByQuaternionToRef(this.mesh.rotationQuaternion, forward)
    }

    // Apply steering as angular velocity (more responsive)
    if (Math.abs(this.throttleInput) > 0.1 || speed > 1) {
      const steerForce = this.currentSteering * Math.min(speed / 5, 1) * 3
      this.physicsAggregate.body.setAngularVelocity(new Vector3(0, steerForce, 0))
    }

    // Apply throttle force (physics engine handles time integration)
    if (this.throttleInput !== 0 && speed < this.maxSpeed) {
      const forceMagnitude = this.throttleInput * this.enginePower
      const force = forward.scale(forceMagnitude)
      this.physicsAggregate.body.applyForce(force, this.mesh.position)
    }

    // Apply brakes
    if (this.isBraking && speed > 0.5) {
      const vel = this.physicsAggregate.body.getLinearVelocity()
      const brakeDir = vel.normalize().scale(-1)
      this.physicsAggregate.body.applyForce(
        brakeDir.scale(this.brakeForce),
        this.mesh.position
      )
    }

    // Ground friction (helps with control)
    if (!this.isBraking && speed > 0.1) {
      const vel = this.physicsAggregate.body.getLinearVelocity()
      this.physicsAggregate.body.setLinearVelocity(vel.scale(0.995))
    }

    // Keep car upright
    if (this.mesh.rotationQuaternion) {
      const euler = this.mesh.rotationQuaternion.toEulerAngles()
      const uprightQuat = Quaternion.FromEulerAngles(0, euler.y, 0)
      Quaternion.SlerpToRef(this.mesh.rotationQuaternion, uprightQuat, deltaTime * 5, this.mesh.rotationQuaternion)
    }

    // Animate wheels (only if using procedural mesh)
    if (this.wheels.length > 0) {
      this.wheels[0].rotation.y = this.currentSteering * 0.4
      this.wheels[1].rotation.y = this.currentSteering * 0.4

      const wheelRotation = speed * deltaTime * 5
      this.wheels.forEach(wheel => {
        wheel.rotation.x += wheelRotation * (this.throttleInput >= 0 ? 1 : -1)
      })
    }
  }

  private updateAIDriving(_deltaTime: number) {
    if (!this.aiTarget) return

    const toTarget = this.aiTarget.subtract(this.mesh.position)
    toTarget.y = 0
    const distance = toTarget.length()

    if (distance < 10) {
      this.isAIDriving = false
      this.aiTarget = null
      this.throttleInput = 0
      this.steeringInput = 0
      return
    }

    // Face target
    const targetAngle = Math.atan2(toTarget.x, toTarget.z)
    const currentAngle = this.mesh.rotationQuaternion?.toEulerAngles().y || 0

    let angleDiff = targetAngle - currentAngle
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    this.steeringInput = Math.max(-1, Math.min(1, angleDiff * 2))
    this.throttleInput = 1 // Full throttle to flee
    this.isBraking = false
  }

  addToShadowGenerator(shadowGenerator: { addShadowCaster: (mesh: Mesh) => void }) {
    shadowGenerator.addShadowCaster(this.mesh)
  }
}
