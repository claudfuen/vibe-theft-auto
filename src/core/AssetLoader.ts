import { Scene } from '@babylonjs/core/scene'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import '@babylonjs/loaders/glTF'

export interface LoadedModel {
  meshes: AbstractMesh[]
  rootMesh: AbstractMesh
}

export class AssetLoader {
  private modelCache: Map<string, LoadedModel> = new Map()
  private loadingPromises: Map<string, Promise<LoadedModel>> = new Map()

  constructor(private scene: Scene) {}

  async loadModel(path: string, name: string): Promise<LoadedModel> {
    // Check cache first
    const cacheKey = `${path}/${name}`
    if (this.modelCache.has(cacheKey)) {
      return this.cloneModel(this.modelCache.get(cacheKey)!)
    }

    // Check if already loading
    if (this.loadingPromises.has(cacheKey)) {
      const model = await this.loadingPromises.get(cacheKey)!
      return this.cloneModel(model)
    }

    // Start loading
    const loadPromise = this.doLoadModel(path, name, cacheKey)
    this.loadingPromises.set(cacheKey, loadPromise)

    try {
      const model = await loadPromise
      this.modelCache.set(cacheKey, model)
      return this.cloneModel(model)
    } finally {
      this.loadingPromises.delete(cacheKey)
    }
  }

  private async doLoadModel(path: string, name: string, _cacheKey: string): Promise<LoadedModel> {
    const result = await SceneLoader.ImportMeshAsync('', path, name, this.scene)

    // Find or create root mesh
    let rootMesh = result.meshes[0]

    // If first mesh is __root__, use it, otherwise create container
    if (rootMesh.name !== '__root__') {
      const container = new Mesh('modelRoot', this.scene)
      result.meshes.forEach(mesh => {
        if (!mesh.parent) {
          mesh.parent = container
        }
      })
      rootMesh = container
    }

    // Disable all meshes in the cached version (we'll clone them)
    rootMesh.setEnabled(false)

    return {
      meshes: result.meshes,
      rootMesh
    }
  }

  private cloneModel(original: LoadedModel): LoadedModel {
    const clonedRoot = original.rootMesh.clone(`${original.rootMesh.name}_clone`, null)!
    clonedRoot.setEnabled(true)

    const clonedMeshes: AbstractMesh[] = [clonedRoot]
    clonedRoot.getChildMeshes().forEach(mesh => {
      mesh.setEnabled(true)
      clonedMeshes.push(mesh)
    })

    return {
      meshes: clonedMeshes,
      rootMesh: clonedRoot
    }
  }

  async preloadModels(models: { path: string; name: string }[]): Promise<void> {
    await Promise.all(models.map(m => this.loadModel(m.path, m.name)))
  }

  clearCache() {
    this.modelCache.forEach(model => {
      model.rootMesh.dispose()
    })
    this.modelCache.clear()
  }
}

// Singleton instance
let assetLoaderInstance: AssetLoader | null = null

export function getAssetLoader(scene?: Scene): AssetLoader {
  if (!assetLoaderInstance && scene) {
    assetLoaderInstance = new AssetLoader(scene)
  }
  if (!assetLoaderInstance) {
    throw new Error('AssetLoader not initialized. Call with scene first.')
  }
  return assetLoaderInstance
}

export function initAssetLoader(scene: Scene): AssetLoader {
  assetLoaderInstance = new AssetLoader(scene)
  return assetLoaderInstance
}
