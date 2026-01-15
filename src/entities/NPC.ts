import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
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
    // Create root mesh for physics
    const root = MeshBuilder.CreateCapsule('npc', {
      height: 1.8,
      radius: 0.35
    }, this.scene)
    root.visibility = 0 // Hide the physics capsule

    // Random colors for clothing variety
    const shirtColor = new Color3(
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6,
      0.2 + Math.random() * 0.6
    )
    const pantsColor = new Color3(
      0.1 + Math.random() * 0.3,
      0.1 + Math.random() * 0.3,
      0.2 + Math.random() * 0.4
    )
    const skinColor = new Color3(
      0.7 + Math.random() * 0.25,
      0.5 + Math.random() * 0.3,
      0.4 + Math.random() * 0.25
    )

    // Materials
    const shirtMat = new StandardMaterial('shirtMat', this.scene)
    shirtMat.diffuseColor = shirtColor

    const pantsMat = new StandardMaterial('pantsMat', this.scene)
    pantsMat.diffuseColor = pantsColor

    const skinMat = new StandardMaterial('skinMat', this.scene)
    skinMat.diffuseColor = skinColor

    const hairMat = new StandardMaterial('hairMat', this.scene)
    hairMat.diffuseColor = new Color3(
      Math.random() * 0.3,
      Math.random() * 0.2,
      Math.random() * 0.1
    )

    // Head
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.35 }, this.scene)
    head.position.y = 0.75
    head.material = skinMat
    head.parent = root

    // Hair (top of head)
    const hair = MeshBuilder.CreateSphere('hair', { diameter: 0.36, slice: 0.5 }, this.scene)
    hair.position.y = 0.78
    hair.material = hairMat
    hair.parent = root

    // Torso
    const torso = MeshBuilder.CreateBox('torso', {
      width: 0.5,
      height: 0.6,
      depth: 0.25
    }, this.scene)
    torso.position.y = 0.3
    torso.material = shirtMat
    torso.parent = root

    // Arms
    const leftArm = MeshBuilder.CreateCapsule('leftArm', {
      height: 0.55,
      radius: 0.08
    }, this.scene)
    leftArm.position.set(-0.35, 0.25, 0)
    leftArm.material = shirtMat
    leftArm.parent = root

    const rightArm = MeshBuilder.CreateCapsule('rightArm', {
      height: 0.55,
      radius: 0.08
    }, this.scene)
    rightArm.position.set(0.35, 0.25, 0)
    rightArm.material = shirtMat
    rightArm.parent = root

    // Hands
    const leftHand = MeshBuilder.CreateSphere('leftHand', { diameter: 0.12 }, this.scene)
    leftHand.position.set(-0.35, -0.05, 0)
    leftHand.material = skinMat
    leftHand.parent = root

    const rightHand = MeshBuilder.CreateSphere('rightHand', { diameter: 0.12 }, this.scene)
    rightHand.position.set(0.35, -0.05, 0)
    rightHand.material = skinMat
    rightHand.parent = root

    // Legs
    const leftLeg = MeshBuilder.CreateCapsule('leftLeg', {
      height: 0.7,
      radius: 0.1
    }, this.scene)
    leftLeg.position.set(-0.15, -0.4, 0)
    leftLeg.material = pantsMat
    leftLeg.parent = root

    const rightLeg = MeshBuilder.CreateCapsule('rightLeg', {
      height: 0.7,
      radius: 0.1
    }, this.scene)
    rightLeg.position.set(0.15, -0.4, 0)
    rightLeg.material = pantsMat
    rightLeg.parent = root

    // Feet/Shoes
    const shoeMat = new StandardMaterial('shoeMat', this.scene)
    shoeMat.diffuseColor = new Color3(0.15, 0.15, 0.15)

    const leftFoot = MeshBuilder.CreateBox('leftFoot', {
      width: 0.12,
      height: 0.1,
      depth: 0.25
    }, this.scene)
    leftFoot.position.set(-0.15, -0.8, 0.05)
    leftFoot.material = shoeMat
    leftFoot.parent = root

    const rightFoot = MeshBuilder.CreateBox('rightFoot', {
      width: 0.12,
      height: 0.1,
      depth: 0.25
    }, this.scene)
    rightFoot.position.set(0.15, -0.8, 0.05)
    rightFoot.material = shoeMat
    rightFoot.parent = root

    root.receiveShadows = true

    return root
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

  private moveToTarget(speed: number, _deltaTime: number) {
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
    // Dispose all child meshes first
    const children = this.mesh.getChildMeshes()
    for (const child of children) {
      child.dispose()
    }
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
