import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'

import { NPC } from '../entities/NPC'
import { CombatSystem } from './CombatSystem'

export class NPCManager {
  private npcs: NPC[] = []
  private spawnPoints: Vector3[] = []
  private maxNPCs = 30
  private spawnRadius = 80
  private despawnRadius = 120

  constructor(
    private scene: Scene,
    private shadowGenerator: ShadowGenerator,
    private combatSystem: CombatSystem
  ) {
    this.combatSystem.registerNPCManager(this)
  }

  spawnNPCs(spawnPoints: Vector3[]) {
    this.spawnPoints = spawnPoints

    // Spawn initial NPCs
    const initialSpawns = spawnPoints.slice(0, this.maxNPCs)
    initialSpawns.forEach(point => {
      this.spawnNPC(point)
    })
  }

  private spawnNPC(position: Vector3) {
    const npc = new NPC(this.scene, position)
    npc.addToShadowGenerator(this.shadowGenerator)
    this.npcs.push(npc)
  }

  update(deltaTime: number, playerPosition: Vector3) {
    // Update existing NPCs
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const npc = this.npcs[i]

      if (!npc.isAlive()) {
        this.npcs.splice(i, 1)
        continue
      }

      // Despawn NPCs too far from player
      const dist = Vector3.Distance(npc.mesh.position, playerPosition)
      if (dist > this.despawnRadius) {
        npc.mesh.dispose()
        this.npcs.splice(i, 1)
        continue
      }

      npc.update(deltaTime, playerPosition)
    }

    // Spawn new NPCs if below max
    if (this.npcs.length < this.maxNPCs) {
      this.trySpawnNear(playerPosition)
    }
  }

  private trySpawnNear(playerPosition: Vector3) {
    // Find spawn points within spawn radius but not too close
    const validSpawnPoints = this.spawnPoints.filter(point => {
      const dist = Vector3.Distance(point, playerPosition)
      return dist > 30 && dist < this.spawnRadius
    })

    if (validSpawnPoints.length > 0) {
      const randomPoint = validSpawnPoints[Math.floor(Math.random() * validSpawnPoints.length)]
      this.spawnNPC(randomPoint)
    }
  }

  getNPCAtPosition(position: Vector3, radius: number): NPC | null {
    for (const npc of this.npcs) {
      const dist = Vector3.Distance(npc.mesh.position, position)
      if (dist < radius) {
        return npc
      }
    }
    return null
  }

  getNPCs(): NPC[] {
    return this.npcs
  }

  getNPCMeshes(): import('@babylonjs/core/Meshes/mesh').Mesh[] {
    return this.npcs.filter(n => n.isAlive()).map(n => n.mesh)
  }
}
