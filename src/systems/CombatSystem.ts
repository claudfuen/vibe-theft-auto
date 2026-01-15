import { Scene } from '@babylonjs/core/scene'
import { Ray } from '@babylonjs/core/Culling/ray'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'

import { NPCManager } from './NPCManager'
import { PoliceSystem } from './PoliceSystem'
import { VehicleManager } from './VehicleManager'

interface WeaponStats {
  damage: number
  range: number
  fireRate: number
}

interface MuzzleFlash {
  mesh: Mesh
  lifetime: number
}

export class CombatSystem {
  private npcManager: NPCManager | null = null
  private policeSystem: PoliceSystem | null = null
  private vehicleManager: VehicleManager | null = null
  private muzzleFlashes: MuzzleFlash[] = []
  private bulletHoles: Mesh[] = []
  private maxBulletHoles = 50

  // Panic/flee radius for nearby entities
  private panicRadius = 30
  private vehicleFleeRadius = 25

  private weapons: Record<string, WeaponStats> = {
    'Fists': { damage: 10, range: 2, fireRate: 2 },
    'Pistol': { damage: 25, range: 100, fireRate: 3 },
    'SMG': { damage: 15, range: 80, fireRate: 10 },
    'Shotgun': { damage: 60, range: 30, fireRate: 1 }
  }

  constructor(private scene: Scene) {}

  registerNPCManager(npcManager: NPCManager) {
    this.npcManager = npcManager
  }

  registerPoliceSystem(policeSystem: PoliceSystem) {
    this.policeSystem = policeSystem
  }

  registerVehicleManager(vehicleManager: VehicleManager) {
    this.vehicleManager = vehicleManager
  }

  // Get root mesh (for hit detection on child meshes)
  private getRootMesh(mesh: AbstractMesh): AbstractMesh {
    let current = mesh
    while (current.parent && current.parent instanceof AbstractMesh) {
      current = current.parent as AbstractMesh
    }
    return current
  }

  shoot(ray: Ray, weaponName: string, shooter: Mesh) {
    const weapon = this.weapons[weaponName]
    if (!weapon) return

    // Create muzzle flash
    this.createMuzzleFlash(shooter.position.add(new Vector3(0, 1.2, 0)))

    // Shooting is a crime! Report it
    if (this.policeSystem) {
      this.policeSystem.reportCrime(1, shooter.position)
    }

    // Trigger panic in nearby NPCs
    this.triggerNearbyPanic(shooter.position)

    // Make nearby vehicles flee
    this.triggerVehicleFlee(shooter.position)

    // Raycast to find hit
    const hit = this.scene.pickWithRay(ray, (mesh) => {
      const rootMesh = this.getRootMesh(mesh)
      return rootMesh !== shooter && mesh.isPickable && mesh.isEnabled()
    })

    if (hit && hit.hit && hit.pickedPoint && hit.pickedMesh) {
      const distance = Vector3.Distance(shooter.position, hit.pickedPoint)

      if (distance <= weapon.range) {
        // Get root mesh to check for NPC hit (might hit child mesh)
        const rootMesh = this.getRootMesh(hit.pickedMesh)

        // Check if hit NPC
        if (this.npcManager) {
          const npc = this.npcManager.getNPCs().find(n =>
            n.mesh === hit.pickedMesh || n.mesh === rootMesh
          )
          if (npc) {
            const killed = npc.takeDamage(weapon.damage)
            this.createBloodSplatter(hit.pickedPoint)

            // Killing an NPC is a more serious crime
            if (killed && this.policeSystem) {
              this.policeSystem.reportCrime(2, shooter.position)
            }
            return // Don't create bullet hole on NPC
          }
        }

        // Hit environment
        this.createBulletHole(hit.pickedPoint, hit.getNormal(true) || Vector3.Up())
      }
    }
  }

  private triggerNearbyPanic(shooterPosition: Vector3) {
    if (!this.npcManager) return

    for (const npc of this.npcManager.getNPCs()) {
      const dist = Vector3.Distance(npc.mesh.position, shooterPosition)
      if (dist < this.panicRadius) {
        npc.flee()
      }
    }
  }

  private triggerVehicleFlee(shooterPosition: Vector3) {
    if (!this.vehicleManager) return

    this.vehicleManager.triggerFleeFrom(shooterPosition, this.vehicleFleeRadius)
  }

  private createMuzzleFlash(position: Vector3) {
    const flash = MeshBuilder.CreateSphere('muzzleFlash', {
      diameter: 0.3
    }, this.scene)
    flash.position.copyFrom(position)

    const material = new StandardMaterial('flashMat', this.scene)
    material.emissiveColor = new Color3(1, 0.8, 0.3)
    material.disableLighting = true
    flash.material = material

    this.muzzleFlashes.push({ mesh: flash, lifetime: 0.05 })
  }

  private createBulletHole(position: Vector3, normal: Vector3) {
    const hole = MeshBuilder.CreateDisc('bulletHole', {
      radius: 0.05
    }, this.scene)

    hole.position.copyFrom(position.add(normal.scale(0.01)))

    // Align to surface normal
    hole.lookAt(position.add(normal))

    const material = new StandardMaterial('holeMat', this.scene)
    material.diffuseColor = new Color3(0.1, 0.1, 0.1)
    hole.material = material

    this.bulletHoles.push(hole)

    // Remove old bullet holes if too many
    if (this.bulletHoles.length > this.maxBulletHoles) {
      const old = this.bulletHoles.shift()
      old?.dispose()
    }
  }

  private createBloodSplatter(position: Vector3) {
    const splatter = MeshBuilder.CreateDisc('blood', {
      radius: 0.3
    }, this.scene)

    splatter.position.copyFrom(position)
    splatter.rotation.x = Math.PI / 2

    const material = new StandardMaterial('bloodMat', this.scene)
    material.diffuseColor = new Color3(0.5, 0, 0)
    splatter.material = material

    // Remove after a few seconds
    setTimeout(() => {
      splatter.dispose()
    }, 5000)
  }

  update(deltaTime: number) {
    // Update muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const flash = this.muzzleFlashes[i]
      flash.lifetime -= deltaTime

      if (flash.lifetime <= 0) {
        flash.mesh.dispose()
        this.muzzleFlashes.splice(i, 1)
      }
    }
  }
}
