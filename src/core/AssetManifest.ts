// Asset manifest for 3D models
// Models are loaded from public/assets folder

export interface AssetDefinition {
  path: string
  file: string
  scale?: number
  rotation?: { x: number; y: number; z: number }
}

export const VEHICLE_ASSETS: Record<string, AssetDefinition> = {
  sports_car: {
    path: '/assets/vehicles/',
    file: 'sports_car.glb',
    scale: 1.2,
    rotation: { x: 0, y: Math.PI, z: 0 }
  }
}

export const CHARACTER_ASSETS: Record<string, AssetDefinition> = {
  soldier: {
    path: '/assets/characters/',
    file: 'character.glb',
    scale: 1.0,
    rotation: { x: 0, y: 0, z: 0 }
  },
  robot: {
    path: '/assets/characters/',
    file: 'robot.glb',
    scale: 0.5,
    rotation: { x: 0, y: 0, z: 0 }
  },
  xbot: {
    path: '/assets/characters/',
    file: 'xbot.glb',
    scale: 1.0,
    rotation: { x: 0, y: 0, z: 0 }
  }
}

export const BUILDING_ASSETS: Record<string, AssetDefinition> = {
  // Buildings will use procedural generation for now
}

export const PROP_ASSETS: Record<string, AssetDefinition> = {
  // Props will use procedural generation for now
}

// Helper to get random asset from a category
export function getRandomAsset(assets: Record<string, AssetDefinition>): AssetDefinition | null {
  const keys = Object.keys(assets)
  if (keys.length === 0) return null
  const randomKey = keys[Math.floor(Math.random() * keys.length)]
  return assets[randomKey]
}
