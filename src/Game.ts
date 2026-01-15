import { Engine } from '@babylonjs/core/Engines/engine'
import { Scene } from '@babylonjs/core/scene'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin'
import HavokPhysics from '@babylonjs/havok'
import '@babylonjs/core/Physics/physicsEngineComponent'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import '@babylonjs/core/Culling/ray'

import { InputManager } from './core/InputManager'
import { Player } from './entities/Player'
import { City } from './world/City'
import { VehicleManager } from './systems/VehicleManager'
import { NPCManager } from './systems/NPCManager'
import { CombatSystem } from './systems/CombatSystem'
import { PoliceSystem } from './systems/PoliceSystem'
import { Minimap } from './systems/Minimap'

export class Game {
  private engine: Engine
  private scene!: Scene
  private player!: Player
  private inputManager!: InputManager
  private city!: City
  private vehicleManager!: VehicleManager
  private npcManager!: NPCManager
  private combatSystem!: CombatSystem
  private policeSystem!: PoliceSystem
  private minimap!: Minimap
  private shadowGenerator!: ShadowGenerator
  private isPaused = false

  constructor(private canvas: HTMLCanvasElement) {
    // Set canvas size to match display resolution
    this.resizeCanvas()

    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
      adaptToDeviceRatio: true
    })
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = Math.floor(rect.width * dpr)
    this.canvas.height = Math.floor(rect.height * dpr)
  }

  async start() {
    try {
      console.log('Initializing scene...')
      await this.initScene()

      console.log('Initializing lights...')
      this.initLights()

      console.log('Initializing physics...')
      await this.initPhysics()

      console.log('Initializing systems...')
      this.initSystems()

      console.log('Initializing world...')
      await this.initWorld()

      console.log('Initializing player...')
      this.initPlayer()

      console.log('Initializing NPCs...')
      this.initNPCs()

      console.log('Initializing vehicles...')
      this.initVehicles()

      console.log('Starting render loop...')
      this.engine.runRenderLoop(() => {
        if (!this.isPaused) {
          this.update()
        }
        this.scene.render()
      })

      window.addEventListener('resize', () => {
        this.resizeCanvas()
        this.engine.resize()
      })

      console.log('Game started successfully!')
    } catch (error) {
      console.error('Failed to start game:', error)
      throw error
    }
  }

  pause() {
    this.isPaused = true
  }

  resume() {
    this.isPaused = false
  }

  dispose() {
    this.engine.stopRenderLoop()
    this.scene.dispose()
    this.engine.dispose()
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
    this.inputManager = new InputManager(this.canvas)
    this.combatSystem = new CombatSystem(this.scene)
    this.policeSystem = new PoliceSystem(this.scene, this.shadowGenerator)
    this.minimap = new Minimap()

    // Connect systems
    this.combatSystem.registerPoliceSystem(this.policeSystem)
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
    this.combatSystem.registerVehicleManager(this.vehicleManager)
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

    // Update police system
    const playerVel = this.player.isInVehicle ? Vector3.Zero() : Vector3.Zero()
    this.policeSystem.update(deltaTime, this.player.mesh.position, playerVel)

    // Update minimap
    this.minimap.update(
      this.player.mesh.position,
      this.player.getYaw(),
      this.vehicleManager.getVehicleMeshes(),
      this.npcManager.getNPCMeshes(),
      this.policeSystem.getPoliceMeshes()
    )

    this.inputManager.update()
  }
}
