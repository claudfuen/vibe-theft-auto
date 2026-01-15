import { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import '@babylonjs/loaders/glTF'

import { CHARACTER_ASSETS, AssetDefinition } from '../core/AssetManifest'

export interface LoadedCharacter {
  mesh: Mesh
  name: string
}

export class CharacterFactory {
  private loadedModels: Map<string, Mesh> = new Map()
  private modelNames: string[] = []
  public useExternalModels = false

  constructor(private scene: Scene) {}

  async preloadModels(): Promise<void> {
    const loadPromises = Object.entries(CHARACTER_ASSETS).map(async ([name, asset]) => {
      try {
        const mesh = await this.loadModel(name, asset)
        if (mesh) {
          mesh.setEnabled(false)
          this.loadedModels.set(name, mesh)
          this.modelNames.push(name)
          console.log(`Loaded character model: ${name}`)
        }
      } catch (error) {
        console.warn(`Failed to load character model ${name}:`, error)
      }
    })

    await Promise.all(loadPromises)

    if (this.loadedModels.size > 0) {
      console.log(`Loaded ${this.loadedModels.size} character models`)
      this.useExternalModels = true
    } else {
      console.log('No external character models loaded, using procedural meshes')
    }
  }

  private async loadModel(name: string, asset: AssetDefinition): Promise<Mesh | null> {
    try {
      const result = await SceneLoader.ImportMeshAsync('', asset.path, asset.file, this.scene)

      if (result.meshes.length === 0) return null

      // Create a parent mesh
      const rootMesh = new Mesh(`character_${name}`, this.scene)

      result.meshes.forEach(mesh => {
        if (mesh.name !== '__root__') {
          mesh.parent = rootMesh
        }
      })

      // Apply transformations
      if (asset.scale) {
        rootMesh.scaling.setAll(asset.scale)
      }
      if (asset.rotation) {
        rootMesh.rotation.set(asset.rotation.x, asset.rotation.y, asset.rotation.z)
      }

      return rootMesh
    } catch (error) {
      console.warn(`Failed to load model ${asset.path}${asset.file}:`, error)
      return null
    }
  }

  getRandomCharacterMesh(): LoadedCharacter | null {
    if (!this.useExternalModels || this.modelNames.length === 0) return null

    const randomName = this.modelNames[Math.floor(Math.random() * this.modelNames.length)]
    const original = this.loadedModels.get(randomName)

    if (!original) return null

    const clone = original.clone(`${randomName}_instance`, null)
    if (clone) {
      clone.setEnabled(true)
      return { mesh: clone, name: randomName }
    }

    return null
  }

  hasLoadedModels(): boolean {
    return this.useExternalModels && this.loadedModels.size > 0
  }
}
