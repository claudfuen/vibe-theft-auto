import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'

interface MinimapEntity {
  position: Vector3
  color: string
  size: number
}

export class Minimap {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scale = 3 // pixels per world unit
  private range = 100 // world units to show

  constructor() {
    this.canvas = document.getElementById('minimap') as HTMLCanvasElement

    // Convert div to canvas if needed
    const minimapDiv = document.getElementById('minimap')
    if (minimapDiv && minimapDiv.tagName !== 'CANVAS') {
      this.canvas = document.createElement('canvas')
      this.canvas.id = 'minimapCanvas'
      this.canvas.width = 150
      this.canvas.height = 150
      this.canvas.style.width = '100%'
      this.canvas.style.height = '100%'
      minimapDiv.appendChild(this.canvas)
    }

    this.ctx = this.canvas.getContext('2d')!
  }

  update(
    playerPos: Vector3,
    playerRotation: number,
    vehicles: Mesh[],
    npcs: Mesh[],
    police: Mesh[]
  ) {
    const ctx = this.ctx
    const w = this.canvas.width
    const h = this.canvas.height
    const centerX = w / 2
    const centerY = h / 2

    // Clear
    ctx.fillStyle = 'rgba(20, 30, 40, 0.9)'
    ctx.fillRect(0, 0, w, h)

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
    ctx.lineWidth = 1
    const gridSpacing = 20 * this.scale

    for (let x = -w; x < w * 2; x += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = -h; y < h * 2; y += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Draw entities relative to player
    const drawEntity = (entity: MinimapEntity) => {
      const dx = entity.position.x - playerPos.x
      const dz = entity.position.z - playerPos.z

      // Check if in range
      if (Math.abs(dx) > this.range || Math.abs(dz) > this.range) return

      const screenX = centerX + dx * this.scale
      const screenY = centerY - dz * this.scale // Flip Z for top-down view

      ctx.fillStyle = entity.color
      ctx.beginPath()
      ctx.arc(screenX, screenY, entity.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw vehicles (white dots)
    vehicles.forEach(v => {
      if (v.isEnabled()) {
        drawEntity({ position: v.position, color: '#888888', size: 3 })
      }
    })

    // Draw NPCs (green dots)
    npcs.forEach(n => {
      if (n.isEnabled()) {
        drawEntity({ position: n.position, color: '#44ff44', size: 2 })
      }
    })

    // Draw police (red dots)
    police.forEach(p => {
      if (p.isEnabled()) {
        drawEntity({ position: p.position, color: '#ff4444', size: 4 })
      }
    })

    // Draw player (yellow triangle pointing in direction)
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(-playerRotation)

    ctx.fillStyle = '#ffff00'
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(-5, 6)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, w, h)

    // Draw N indicator
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('N', centerX, 15)
  }
}
