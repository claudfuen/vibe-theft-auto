import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF'

import { Vehicle } from './Vehicle'
import { VEHICLE_ASSETS, AssetDefinition } from '../core/AssetManifest'

export class VehicleFactory {
  private loadedModels: Map<string, Mesh> = new Map()
  private loadingPromises: Map<string, Promise<Mesh | null>> = new Map()
  private useExternalModels = true

  constructor(private scene: Scene) {}

  async preloadModels(): Promise<void> {
    const loadPromises = Object.entries(VEHICLE_ASSETS).map(async ([name, asset]) => {
      try {
        const mesh = await this.loadModel(asset)
        if (mesh) {
          mesh.setEnabled(false)
          this.loadedModels.set(name, mesh)
          console.log(`Loaded vehicle model: ${name}`)
        }
      } catch (error) {
        console.warn(`Failed to load vehicle model ${name}:`, error)
      }
    })

    await Promise.all(loadPromises)

    if (this.loadedModels.size === 0) {
      console.log('No external vehicle models loaded, using procedural meshes')
      this.useExternalModels = false
    }
  }

  private async loadModel(asset: AssetDefinition): Promise<Mesh | null> {
    const key = `${asset.path}${asset.file}`

    if (this.loadingPromises.has(key)) {
      return this.loadingPromises.get(key)!
    }

    const promise = (async () => {
      try {
        const result = await SceneLoader.ImportMeshAsync('', asset.path, asset.file, this.scene)

        if (result.meshes.length === 0) return null

        // Create a parent mesh to hold everything
        const rootMesh = new Mesh(`vehicle_${asset.file}`, this.scene)

        result.meshes.forEach(mesh => {
          if (mesh.name !== '__root__') {
            mesh.parent = rootMesh
          }
        })

        // Apply scale and rotation from manifest
        if (asset.scale) {
          rootMesh.scaling.setAll(asset.scale)
        }
        if (asset.rotation) {
          rootMesh.rotation.set(asset.rotation.x, asset.rotation.y, asset.rotation.z)
        }

        return rootMesh
      } catch (error) {
        console.warn(`Failed to load model ${key}:`, error)
        return null
      }
    })()

    this.loadingPromises.set(key, promise)
    return promise
  }

  createVehicle(position: Vector3, color: Color3): Vehicle {
    // For now, always use procedural mesh for physics
    // External models are complex and need proper setup
    return new Vehicle(this.scene, position, color)
  }

  // Get a cloned visual mesh from loaded models (for future use)
  getRandomLoadedMesh(): Mesh | null {
    if (!this.useExternalModels || this.loadedModels.size === 0) return null

    const keys = Array.from(this.loadedModels.keys())
    const randomKey = keys[Math.floor(Math.random() * keys.length)]
    const original = this.loadedModels.get(randomKey)

    if (!original) return null

    const clone = original.clone(`${randomKey}_clone`, null)
    if (clone) {
      clone.setEnabled(true)
    }
    return clone
  }
}
