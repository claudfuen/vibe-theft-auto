import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/core/Physics/physicsEngineComponent'

import { InputManager } from './core/InputManager'
import { Player } from './entities/Player'
import { City } from './world/City'
import { VehicleManager } from './systems/VehicleManager'
import { NPCManager } from './systems/NPCManager'
import { CombatSystem } from './systems/CombatSystem'

export class Game {
  private engine: Engine
  private scene!: Scene
  private player!: Player
  private inputManager!: InputManager
  private city!: City
  private vehicleManager!: VehicleManager
  private npcManager!: NPCManager
  private combatSystem!: CombatSystem
  private shadowGenerator!: ShadowGenerator

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    })
  }

  async start() {
    await this.initScene()
    this.initLights()
    await this.initPhysics()
    this.initSystems()
    await this.initWorld()
    this.initPlayer()
    this.initNPCs()
    this.initVehicles()

    this.engine.runRenderLoop(() => {
      this.update()
      this.scene.render()
    })

    window.addEventListener('resize', () => {
      this.engine.resize()
    })
  }

  private async initScene() {
    this.scene = new Scene(this.engine)
    this.scene.collisionsEnabled = true
    this.scene.clearColor.set(0.5, 0.7, 0.9, 1) // Sky blue
  }

  private initLights() {
    // Ambient light
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene)
    ambient.intensity = 0.4

    // Sun light with shadows
    const sun = new DirectionalLight('sun', new Vector3(-1, -2, -1), this.scene)
    sun.position = new Vector3(50, 100, 50)
    sun.intensity = 0.8

    this.shadowGenerator = new ShadowGenerator(2048, sun)
    this.shadowGenerator.useBlurExponentialShadowMap = true
    this.shadowGenerator.blurKernel = 32
  }

  private async initPhysics() {
    const havok = await HavokPhysics()
    const havokPlugin = new HavokPlugin(true, havok)
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin)
  }

  private initSystems() {
    this.inputManager = new InputManager(this.scene, this.canvas)
    this.combatSystem = new CombatSystem(this.scene)
  }

  private async initWorld() {
    this.city = new City(this.scene, this.shadowGenerator)
    await this.city.generate()
  }

  private initPlayer() {
    this.player = new Player(this.scene, this.inputManager, this.combatSystem, this.canvas)
    this.player.mesh.position = new Vector3(0, 2, 0)
    this.shadowGenerator.addShadowCaster(this.player.mesh)
  }

  private initVehicles() {
    this.vehicleManager = new VehicleManager(this.scene, this.shadowGenerator)
    this.vehicleManager.spawnVehicles(this.city.getVehicleSpawnPoints())
  }

  private initNPCs() {
    this.npcManager = new NPCManager(this.scene, this.shadowGenerator, this.combatSystem)
    this.npcManager.spawnNPCs(this.city.getNPCSpawnPoints())
  }

  private update() {
    const deltaTime = this.engine.getDeltaTime() / 1000

    // Check for vehicle interaction
    if (this.inputManager.isKeyJustPressed('KeyE')) {
      if (this.player.isInVehicle) {
        this.player.exitVehicle()
      } else {
        const nearbyVehicle = this.vehicleManager.getNearestVehicle(this.player.mesh.position, 4)
        if (nearbyVehicle) {
          this.player.enterVehicle(nearbyVehicle)
        }
      }
    }

    this.player.update(deltaTime)
    this.vehicleManager.update(deltaTime)
    this.npcManager.update(deltaTime, this.player.mesh.position)
    this.combatSystem.update(deltaTime)
    this.inputManager.update()
  }
}
