import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics/v2/physicsAggregate'
import '@babylonjs/core/Physics/v2/physicsEngineComponent'

export class City {
  private buildings: Mesh[] = []
  private vehicleSpawnPoints: Vector3[] = []
  private npcSpawnPoints: Vector3[] = []

  private gridSize = 5
  private blockSize = 40
  private roadWidth = 10

  constructor(private scene: Scene, private shadowGenerator: ShadowGenerator) {}

  async generate() {
    this.createGround()
    this.createRoads()
    this.createBuildings()
    this.createSpawnPoints()
  }

  private createGround() {
    const totalSize = this.gridSize * this.blockSize + (this.gridSize + 1) * this.roadWidth

    const ground = MeshBuilder.CreateGround('ground', {
      width: totalSize,
      height: totalSize
    }, this.scene)

    const material = new StandardMaterial('groundMat', this.scene)
    material.diffuseColor = new Color3(0.3, 0.3, 0.3) // Asphalt
    ground.material = material
    ground.receiveShadows = true

    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene)
  }

  private createRoads() {
    const totalSize = this.gridSize * this.blockSize + (this.gridSize + 1) * this.roadWidth
    const halfSize = totalSize / 2

    const roadMaterial = new StandardMaterial('roadMat', this.scene)
    roadMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2)

    const sidewalkMaterial = new StandardMaterial('sidewalkMat', this.scene)
    sidewalkMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5)

    // Create roads
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = -halfSize + this.roadWidth / 2 + i * (this.blockSize + this.roadWidth)

      // Horizontal road
      const hRoad = MeshBuilder.CreateGround(`hRoad${i}`, {
        width: totalSize,
        height: this.roadWidth
      }, this.scene)
      hRoad.position.z = pos
      hRoad.position.y = 0.01
      hRoad.material = roadMaterial

      // Road lines
      this.createRoadLines(hRoad.position, true, totalSize)

      // Vertical road
      const vRoad = MeshBuilder.CreateGround(`vRoad${i}`, {
        width: this.roadWidth,
        height: totalSize
      }, this.scene)
      vRoad.position.x = pos
      vRoad.position.y = 0.01
      vRoad.material = roadMaterial

      this.createRoadLines(vRoad.position, false, totalSize)
    }

    // Create sidewalks along roads
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = -halfSize + this.roadWidth / 2 + i * (this.blockSize + this.roadWidth)

      // Sidewalks for horizontal roads
      for (const side of [-1, 1]) {
        const sidewalk = MeshBuilder.CreateBox(`sidewalk_h${i}_${side}`, {
          width: totalSize,
          height: 0.15,
          depth: 1.5
        }, this.scene)
        sidewalk.position.z = pos + side * (this.roadWidth / 2 + 0.75)
        sidewalk.position.y = 0.075
        sidewalk.material = sidewalkMaterial
        sidewalk.receiveShadows = true
      }

      // Sidewalks for vertical roads
      for (const side of [-1, 1]) {
        const sidewalk = MeshBuilder.CreateBox(`sidewalk_v${i}_${side}`, {
          width: 1.5,
          height: 0.15,
          depth: totalSize
        }, this.scene)
        sidewalk.position.x = pos + side * (this.roadWidth / 2 + 0.75)
        sidewalk.position.y = 0.075
        sidewalk.material = sidewalkMaterial
        sidewalk.receiveShadows = true
      }
    }
  }

  private createRoadLines(position: Vector3, horizontal: boolean, length: number) {
    const lineMaterial = new StandardMaterial('lineMat', this.scene)
    lineMaterial.diffuseColor = new Color3(1, 1, 0)
    lineMaterial.emissiveColor = new Color3(0.3, 0.3, 0)

    const lineCount = Math.floor(length / 8)

    for (let i = 0; i < lineCount; i++) {
      const line = MeshBuilder.CreateBox(`line${i}`, {
        width: horizontal ? 4 : 0.2,
        height: 0.02,
        depth: horizontal ? 0.2 : 4
      }, this.scene)

      if (horizontal) {
        line.position.x = -length / 2 + i * 8 + 4
        line.position.z = position.z
      } else {
        line.position.x = position.x
        line.position.z = -length / 2 + i * 8 + 4
      }
      line.position.y = 0.02
      line.material = lineMaterial
    }
  }

  private createBuildings() {
    const totalSize = this.gridSize * this.blockSize + (this.gridSize + 1) * this.roadWidth
    const halfSize = totalSize / 2

    const buildingColors = [
      new Color3(0.6, 0.6, 0.65),
      new Color3(0.7, 0.65, 0.6),
      new Color3(0.5, 0.55, 0.6),
      new Color3(0.65, 0.6, 0.55),
      new Color3(0.55, 0.5, 0.55)
    ]

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const blockX = -halfSize + this.roadWidth + x * (this.blockSize + this.roadWidth) + this.blockSize / 2
        const blockZ = -halfSize + this.roadWidth + z * (this.blockSize + this.roadWidth) + this.blockSize / 2

        // Create multiple buildings per block
        const numBuildings = 2 + Math.floor(Math.random() * 3)

        for (let b = 0; b < numBuildings; b++) {
          const width = 8 + Math.random() * 12
          const depth = 8 + Math.random() * 12
          const height = 10 + Math.random() * 40

          const offsetX = (Math.random() - 0.5) * (this.blockSize - width - 4)
          const offsetZ = (Math.random() - 0.5) * (this.blockSize - depth - 4)

          const building = MeshBuilder.CreateBox(`building_${x}_${z}_${b}`, {
            width,
            height,
            depth
          }, this.scene)

          building.position.x = blockX + offsetX
          building.position.y = height / 2
          building.position.z = blockZ + offsetZ

          const material = new StandardMaterial(`buildingMat_${x}_${z}_${b}`, this.scene)
          material.diffuseColor = buildingColors[Math.floor(Math.random() * buildingColors.length)]
          building.material = material
          building.receiveShadows = true

          this.shadowGenerator.addShadowCaster(building)
          this.buildings.push(building)

          // Add physics
          new PhysicsAggregate(building, PhysicsShapeType.BOX, { mass: 0 }, this.scene)

          // Add windows
          this.addWindows(building, width, height, depth)
        }
      }
    }
  }

  private addWindows(building: Mesh, width: number, height: number, depth: number) {
    const windowMaterial = new StandardMaterial('windowMat', this.scene)
    windowMaterial.diffuseColor = new Color3(0.3, 0.4, 0.5)
    windowMaterial.emissiveColor = new Color3(0.1, 0.15, 0.2)

    const floorHeight = 3.5
    const floors = Math.floor(height / floorHeight)

    // Front and back windows
    for (let floor = 1; floor < floors; floor++) {
      const windowsPerFloor = Math.floor(width / 3)
      for (let w = 0; w < windowsPerFloor; w++) {
        // Front
        const frontWindow = MeshBuilder.CreatePlane(`window_f_${floor}_${w}`, {
          width: 1.5,
          height: 2
        }, this.scene)
        frontWindow.position.x = -width / 2 + 2 + w * 3
        frontWindow.position.y = -height / 2 + floor * floorHeight + 1.5
        frontWindow.position.z = depth / 2 + 0.01
        frontWindow.material = windowMaterial
        frontWindow.parent = building

        // Back
        const backWindow = frontWindow.clone(`window_b_${floor}_${w}`)
        backWindow.position.z = -depth / 2 - 0.01
        backWindow.rotation.y = Math.PI
      }
    }
  }

  private createSpawnPoints() {
    const totalSize = this.gridSize * this.blockSize + (this.gridSize + 1) * this.roadWidth
    const halfSize = totalSize / 2

    // Vehicle spawn points along roads
    for (let i = 0; i <= this.gridSize; i++) {
      const roadPos = -halfSize + this.roadWidth / 2 + i * (this.blockSize + this.roadWidth)

      // Spawn vehicles on horizontal roads
      for (let j = 0; j < this.gridSize; j++) {
        const x = -halfSize + this.roadWidth + j * (this.blockSize + this.roadWidth) + this.blockSize / 2
        this.vehicleSpawnPoints.push(new Vector3(x, 0.5, roadPos + 2))
      }

      // Spawn vehicles on vertical roads
      for (let j = 0; j < this.gridSize; j++) {
        const z = -halfSize + this.roadWidth + j * (this.blockSize + this.roadWidth) + this.blockSize / 2
        this.vehicleSpawnPoints.push(new Vector3(roadPos + 2, 0.5, z))
      }
    }

    // NPC spawn points on sidewalks
    for (let i = 0; i <= this.gridSize; i++) {
      const roadPos = -halfSize + this.roadWidth / 2 + i * (this.blockSize + this.roadWidth)

      for (let j = 0; j < this.gridSize * 2; j++) {
        const pos = -halfSize + 20 + j * 20

        // Sidewalks along horizontal roads
        this.npcSpawnPoints.push(new Vector3(pos, 1, roadPos + this.roadWidth / 2 + 1))
        this.npcSpawnPoints.push(new Vector3(pos, 1, roadPos - this.roadWidth / 2 - 1))

        // Sidewalks along vertical roads
        this.npcSpawnPoints.push(new Vector3(roadPos + this.roadWidth / 2 + 1, 1, pos))
        this.npcSpawnPoints.push(new Vector3(roadPos - this.roadWidth / 2 - 1, 1, pos))
      }
    }
  }

  getVehicleSpawnPoints(): Vector3[] {
    // Return subset for initial spawn
    return this.vehicleSpawnPoints.slice(0, 20)
  }

  getNPCSpawnPoints(): Vector3[] {
    // Return subset for initial spawn
    return this.npcSpawnPoints.slice(0, 30)
  }
}
