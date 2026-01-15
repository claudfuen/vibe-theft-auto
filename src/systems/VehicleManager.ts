import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'

import { Vehicle } from '../entities/Vehicle'
import { VehicleFactory } from '../entities/VehicleFactory'

export class VehicleManager {
  private vehicles: Vehicle[] = []
  private vehicleFactory: VehicleFactory | null = null

  private carColors: Color3[] = [
    new Color3(0.8, 0.1, 0.1),   // Red
    new Color3(0.1, 0.1, 0.8),   // Blue
    new Color3(0.1, 0.6, 0.1),   // Green
    new Color3(0.9, 0.9, 0.9),   // White
    new Color3(0.1, 0.1, 0.1),   // Black
    new Color3(0.9, 0.7, 0.1),   // Yellow
    new Color3(0.5, 0.5, 0.5),   // Gray
    new Color3(0.6, 0.3, 0.1)    // Brown
  ]

  constructor(private scene: Scene, private shadowGenerator: ShadowGenerator) {}

  setVehicleFactory(factory: VehicleFactory) {
    this.vehicleFactory = factory
  }

  spawnVehicles(spawnPoints: Vector3[]) {
    spawnPoints.forEach((point, index) => {
      const color = this.carColors[Math.floor(Math.random() * this.carColors.length)]
      const loadedMesh = this.vehicleFactory?.getRandomLoadedMesh()
      const vehicle = new Vehicle(this.scene, point, color, loadedMesh ?? undefined)

      // Rotate some vehicles randomly
      if (index % 3 === 0) {
        vehicle.mesh.rotation.y = Math.PI / 2
      }

      vehicle.addToShadowGenerator(this.shadowGenerator)
      this.vehicles.push(vehicle)
    })
  }

  getNearestVehicle(position: Vector3, maxDistance: number): Vehicle | null {
    let nearest: Vehicle | null = null
    let nearestDist = maxDistance

    for (const vehicle of this.vehicles) {
      const dist = Vector3.Distance(position, vehicle.mesh.position)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = vehicle
      }
    }

    return nearest
  }

  update(deltaTime: number) {
    for (const vehicle of this.vehicles) {
      vehicle.update(deltaTime)
    }
  }

  triggerFleeFrom(position: Vector3, radius: number) {
    for (const vehicle of this.vehicles) {
      const dist = Vector3.Distance(vehicle.mesh.position, position)
      if (dist < radius) {
        vehicle.fleeFrom(position)
      }
    }
  }

  getVehicles(): Vehicle[] {
    return this.vehicles
  }

  getVehicleMeshes(): import('@babylonjs/core/Meshes/mesh').Mesh[] {
    return this.vehicles.map(v => v.mesh)
  }
}
