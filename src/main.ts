import { Game } from './Game'

class GameManager {
  private game: Game | null = null
  private canvas: HTMLCanvasElement
  private mainMenu: HTMLElement
  private pauseMenu: HTMLElement
  private gameUI: HTMLElement
  private startBtn: HTMLElement
  private controlsBtn: HTMLElement
  private resumeBtn: HTMLElement
  private quitBtn: HTMLElement
  private loadingText: HTMLElement
  private isRunning = false

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement
    this.mainMenu = document.getElementById('mainMenu')!
    this.pauseMenu = document.getElementById('pauseMenu')!
    this.gameUI = document.getElementById('gameUI')!
    this.startBtn = document.getElementById('startBtn')!
    this.controlsBtn = document.getElementById('controlsBtn')!
    this.resumeBtn = document.getElementById('resumeBtn')!
    this.quitBtn = document.getElementById('quitBtn')!
    this.loadingText = document.getElementById('loadingText')!

    this.setupEventListeners()
  }

  private setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.startGame())
    this.controlsBtn.addEventListener('click', () => this.showControls())
    this.resumeBtn.addEventListener('click', () => this.resumeGame())
    this.quitBtn.addEventListener('click', () => this.quitToMenu())

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isRunning) {
        this.togglePause()
      }
    })
  }

  private async startGame() {
    this.startBtn.setAttribute('disabled', 'true')
    this.loadingText.style.display = 'block'

    // Create and start game
    this.game = new Game(this.canvas)

    try {
      await this.game.start()

      // Hide menu, show game
      this.mainMenu.style.display = 'none'
      this.canvas.style.display = 'block'
      this.gameUI.style.display = 'block'
      this.isRunning = true
    } catch (error) {
      console.error('Failed to start game:', error)
      this.loadingText.textContent = 'Failed to load. Please refresh.'
    }
  }

  private showControls() {
    alert(`
CONTROLS:
---------
WASD - Move
Mouse - Look around
Shift - Sprint
Space - Jump
E - Enter/Exit Vehicle
Left Click - Shoot
1-4 - Switch Weapon
ESC - Pause
    `)
  }

  private togglePause() {
    if (this.pauseMenu.style.display === 'flex') {
      this.resumeGame()
    } else {
      this.pauseGame()
    }
  }

  private pauseGame() {
    if (!this.game) return
    this.game.pause()
    this.pauseMenu.style.display = 'flex'
    document.exitPointerLock()
  }

  private resumeGame() {
    if (!this.game) return
    this.game.resume()
    this.pauseMenu.style.display = 'none'
  }

  private quitToMenu() {
    if (this.game) {
      this.game.dispose()
      this.game = null
    }

    this.isRunning = false
    this.pauseMenu.style.display = 'none'
    this.gameUI.style.display = 'none'
    this.canvas.style.display = 'none'
    this.mainMenu.style.display = 'flex'
    this.startBtn.removeAttribute('disabled')
    this.loadingText.style.display = 'none'
  }
}

// Initialize game manager
new GameManager()
