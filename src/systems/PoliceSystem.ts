import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate'
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

interface PoliceCar {
  mesh: Mesh
  physicsAggregate: PhysicsAggregate
  targetPosition: Vector3 | null
  state: 'patrol' | 'chase' | 'search'
}

export class PoliceSystem {
  private policeCars: PoliceCar[] = []
  private wantedLevel = 0
  private maxWantedLevel = 5
  private wantedDecayTimer = 0
  private wantedDecayTime = 30 // seconds to lose one star when out of sight
  private lastKnownPlayerPos: Vector3 | null = null
  private playerInSight = false

  // Crime tracking
  private crimeCooldown = 0

  constructor(
    private scene: Scene,
    private shadowGenerator: ShadowGenerator
  ) {
    this.updateWantedUI()
  }

  reportCrime(severity: number, position: Vector3) {
    if (this.crimeCooldown > 0) return

    this.addWantedLevel(severity)
    this.lastKnownPlayerPos = position.clone()
    this.crimeCooldown = 0.5 // Prevent spam

    // Spawn police if needed
    this.checkSpawnPolice(position)
  }

  private addWantedLevel(amount: number) {
    this.wantedLevel = Math.min(this.maxWantedLevel, this.wantedLevel + amount)
    this.wantedDecayTimer = 0
    this.updateWantedUI()
  }

  private updateWantedUI() {
    const stars = document.querySelectorAll('#wantedLevel .star')
    stars.forEach((star, index) => {
      if (index < this.wantedLevel) {
        star.classList.add('active')
      } else {
        star.classList.remove('active')
      }
    })
  }

  private checkSpawnPolice(crimePosition: Vector3) {
    // Spawn police cars based on wanted level
    const desiredPolice = this.wantedLevel * 2
    const currentPolice = this.policeCars.length

    for (let i = currentPolice; i < desiredPolice; i++) {
      this.spawnPoliceCar(crimePosition)
    }
  }

  private spawnPoliceCar(nearPosition: Vector3) {
    // Spawn at random offset from crime
    const angle = Math.random() * Math.PI * 2
    const distance = 50 + Math.random() * 50

    const spawnPos = new Vector3(
      nearPosition.x + Math.cos(angle) * distance,
      0.5,
      nearPosition.z + Math.sin(angle) * distance
    )

    const policeCar = this.createPoliceCar(spawnPos)
    this.policeCars.push(policeCar)
  }

  private createPoliceCar(position: Vector3): PoliceCar {
    // Create police car body - black and white
    const body = MeshBuilder.CreateBox('policeCar', {
      width: 2.2,
      height: 1,
      depth: 4.5
    }, this.scene)
    body.position.copyFrom(position)
    body.rotationQuaternion = Quaternion.Identity()

    // Police car material - black
    const bodyMat = new StandardMaterial('policeBodyMat', this.scene)
    bodyMat.diffuseColor = new Color3(0.1, 0.1, 0.15)
    body.material = bodyMat
    body.receiveShadows = true

    // Roof
    const roof = MeshBuilder.CreateBox('policeRoof', {
      width: 1.8,
      height: 0.5,
      depth: 2
    }, this.scene)
    roof.position.y = 0.75
    roof.position.z = -0.3
    const roofMat = new StandardMaterial('roofMat', this.scene)
    roofMat.diffuseColor = new Color3(0.9, 0.9, 0.9)
    roof.material = roofMat
    roof.parent = body

    // Police lights
    const lightBar = MeshBuilder.CreateBox('lightBar', {
      width: 1.4,
      height: 0.15,
      depth: 0.4
    }, this.scene)
    lightBar.position.y = 1.1
    lightBar.position.z = -0.3

    const lightMat = new StandardMaterial('lightMat', this.scene)
    lightMat.emissiveColor = new Color3(0, 0, 1)
    lightBar.material = lightMat
    lightBar.parent = body

    // Add physics
    const physicsAggregate = new PhysicsAggregate(
      body,
      PhysicsShapeType.BOX,
      { mass: 1500, friction: 0.3, restitution: 0.1 },
      this.scene
    )

    physicsAggregate.body.setMassProperties({
      centerOfMass: new Vector3(0, -0.3, 0)
    })

    this.shadowGenerator.addShadowCaster(body)

    return {
      mesh: body,
      physicsAggregate,
      targetPosition: null,
      state: 'chase'
    }
  }

  update(deltaTime: number, playerPosition: Vector3, playerVelocity: Vector3) {
    this.crimeCooldown = Math.max(0, this.crimeCooldown - deltaTime)

    // Check if player is in sight of any police
    this.playerInSight = this.checkPlayerInSight(playerPosition)

    if (this.playerInSight) {
      this.lastKnownPlayerPos = playerPosition.clone()
      this.wantedDecayTimer = 0
    } else if (this.wantedLevel > 0) {
      // Decay wanted level when out of sight
      this.wantedDecayTimer += deltaTime
      if (this.wantedDecayTimer >= this.wantedDecayTime) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1)
        this.wantedDecayTimer = 0
        this.updateWantedUI()

        // Despawn some police
        if (this.policeCars.length > this.wantedLevel * 2) {
          const car = this.policeCars.pop()
          if (car) {
            car.physicsAggregate.dispose()
            car.mesh.dispose()
          }
        }
      }
    }

    // Update police cars
    for (const police of this.policeCars) {
      this.updatePoliceCar(police, deltaTime, playerPosition, playerVelocity)
    }

    // Animate police lights
    this.animatePoliceLights(deltaTime)
  }

  private checkPlayerInSight(playerPosition: Vector3): boolean {
    for (const police of this.policeCars) {
      const distance = Vector3.Distance(police.mesh.position, playerPosition)
      if (distance < 80) {
        return true
      }
    }
    return false
  }

  private updatePoliceCar(
    police: PoliceCar,
    deltaTime: number,
    playerPosition: Vector3,
    _playerVelocity: Vector3
  ) {
    const distToPlayer = Vector3.Distance(police.mesh.position, playerPosition)

    // Determine target based on state
    let target: Vector3

    if (this.wantedLevel === 0) {
      // No wanted level - patrol randomly
      if (!police.targetPosition || Vector3.Distance(police.mesh.position, police.targetPosition) < 5) {
        const angle = Math.random() * Math.PI * 2
        const dist = 30 + Math.random() * 50
        police.targetPosition = new Vector3(
          police.mesh.position.x + Math.cos(angle) * dist,
          0.5,
          police.mesh.position.z + Math.sin(angle) * dist
        )
      }
      target = police.targetPosition
      police.state = 'patrol'
    } else if (distToPlayer < 100) {
      // Chase player directly
      target = playerPosition
      police.state = 'chase'
    } else if (this.lastKnownPlayerPos) {
      // Go to last known position
      target = this.lastKnownPlayerPos
      police.state = 'search'
    } else {
      return
    }

    // Move towards target
    const direction = target.subtract(police.mesh.position)
    direction.y = 0

    if (direction.length() > 2) {
      direction.normalize()

      // Face direction
      const targetAngle = Math.atan2(direction.x, direction.z)
      if (police.mesh.rotationQuaternion) {
        const newQuat = Quaternion.FromEulerAngles(0, targetAngle, 0)
        Quaternion.SlerpToRef(police.mesh.rotationQuaternion, newQuat, deltaTime * 3, police.mesh.rotationQuaternion)
      }

      // Get forward direction
      const forward = new Vector3(0, 0, 1)
      if (police.mesh.rotationQuaternion) {
        forward.rotateByQuaternionToRef(police.mesh.rotationQuaternion, forward)
      }

      // Apply force
      const speed = police.state === 'chase' ? 3000 : 1500
      const force = forward.scale(speed * deltaTime)
      police.physicsAggregate.body.applyForce(force, police.mesh.position)

      // Speed limit
      const vel = police.physicsAggregate.body.getLinearVelocity()
      const maxSpeed = police.state === 'chase' ? 25 : 15
      const currentSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z)
      if (currentSpeed > maxSpeed) {
        const limitedVel = new Vector3(vel.x, vel.y, vel.z).normalize().scale(maxSpeed)
        limitedVel.y = vel.y
        police.physicsAggregate.body.setLinearVelocity(limitedVel)
      }
    }

    // Keep car upright
    if (police.mesh.rotationQuaternion) {
      const euler = police.mesh.rotationQuaternion.toEulerAngles()
      const uprightQuat = Quaternion.FromEulerAngles(0, euler.y, 0)
      Quaternion.SlerpToRef(police.mesh.rotationQuaternion, uprightQuat, deltaTime * 2, police.mesh.rotationQuaternion)
    }
  }

  private lightPhase = 0
  private animatePoliceLights(deltaTime: number) {
    this.lightPhase += deltaTime * 8

    for (const police of this.policeCars) {
      const lightBar = police.mesh.getChildMeshes().find(m => m.name === 'lightBar')
      if (lightBar && lightBar.material) {
        const mat = lightBar.material as StandardMaterial
        // Alternate between red and blue
        const phase = Math.sin(this.lightPhase) > 0
        mat.emissiveColor = phase ? new Color3(1, 0, 0) : new Color3(0, 0, 1)
      }
    }
  }

  getWantedLevel(): number {
    return this.wantedLevel
  }

  isPlayerWanted(): boolean {
    return this.wantedLevel > 0
  }
}
