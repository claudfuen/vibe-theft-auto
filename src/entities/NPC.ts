import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics/v2/physicsAggregate'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

type NPCState = 'idle' | 'walking' | 'fleeing'

export class NPC {
  mesh: Mesh
  private physicsAggregate: PhysicsAggregate
  private state: NPCState = 'walking'
  private health = 100
  private moveSpeed = 2
  private fleeSpeed = 5

  private targetPosition: Vector3 | null = null
  private idleTimer = 0
  private walkTimer = 0

  constructor(private scene: Scene, position: Vector3) {
    this.mesh = this.createNPCMesh()
    this.mesh.position.copyFrom(position)

    this.physicsAggregate = new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.CAPSULE,
      { mass: 70, friction: 0.5, restitution: 0 },
      scene
    )

    this.physicsAggregate.body.setMassProperties({
      inertia: Vector3.Zero()
    })

    this.pickNewTarget()
  }

  private createNPCMesh(): Mesh {
    const body = MeshBuilder.CreateCapsule('npc', {
      height: 1.8,
      radius: 0.3
    }, this.scene)

    const material = new StandardMaterial('npcMat', this.scene)
    // Random color for variety
    material.diffuseColor = new Color3(
      0.3 + Math.random() * 0.4,
      0.3 + Math.random() * 0.4,
      0.3 + Math.random() * 0.4
    )
    body.material = material
    body.receiveShadows = true

    return body
  }

  private pickNewTarget() {
    // Pick random point within 20 units
    const angle = Math.random() * Math.PI * 2
    const distance = 5 + Math.random() * 15
    this.targetPosition = new Vector3(
      this.mesh.position.x + Math.cos(angle) * distance,
      this.mesh.position.y,
      this.mesh.position.z + Math.sin(angle) * distance
    )
    this.walkTimer = 3 + Math.random() * 5
  }

  update(deltaTime: number, playerPosition: Vector3) {
    // Check if should flee from player
    const distToPlayer = Vector3.Distance(this.mesh.position, playerPosition)

    // State machine
    switch (this.state) {
      case 'idle':
        this.idleTimer -= deltaTime
        if (this.idleTimer <= 0) {
          this.state = 'walking'
          this.pickNewTarget()
        }
        break

      case 'walking':
        this.walkTimer -= deltaTime
        if (this.walkTimer <= 0 || this.reachedTarget()) {
          this.state = 'idle'
          this.idleTimer = 1 + Math.random() * 3
          this.targetPosition = null
        } else {
          this.moveToTarget(this.moveSpeed, deltaTime)
        }
        break

      case 'fleeing':
        if (distToPlayer > 30) {
          this.state = 'walking'
          this.pickNewTarget()
        } else {
          // Flee away from player
          const fleeDir = this.mesh.position.subtract(playerPosition).normalize()
          this.targetPosition = this.mesh.position.add(fleeDir.scale(20))
          this.moveToTarget(this.fleeSpeed, deltaTime)
        }
        break
    }
  }

  private reachedTarget(): boolean {
    if (!this.targetPosition) return true
    const dist = Vector3.Distance(
      new Vector3(this.mesh.position.x, 0, this.mesh.position.z),
      new Vector3(this.targetPosition.x, 0, this.targetPosition.z)
    )
    return dist < 1
  }

  private moveToTarget(speed: number, deltaTime: number) {
    if (!this.targetPosition) return

    const direction = this.targetPosition.subtract(this.mesh.position)
    direction.y = 0
    if (direction.length() > 0.1) {
      direction.normalize()

      // Face movement direction
      const angle = Math.atan2(direction.x, direction.z)
      this.mesh.rotation.y = angle

      // Move
      const currentVel = this.physicsAggregate.body.getLinearVelocity()
      this.physicsAggregate.body.setLinearVelocity(new Vector3(
        direction.x * speed,
        currentVel.y,
        direction.z * speed
      ))
    }
  }

  flee() {
    this.state = 'fleeing'
  }

  takeDamage(amount: number): boolean {
    this.health -= amount
    this.flee()

    if (this.health <= 0) {
      this.die()
      return true
    }
    return false
  }

  private die() {
    this.physicsAggregate.dispose()
    this.mesh.dispose()
  }

  isAlive(): boolean {
    return this.health > 0
  }

  addToShadowGenerator(shadowGenerator: { addShadowCaster: (mesh: Mesh) => void }) {
    shadowGenerator.addShadowCaster(this.mesh)
  }
}
