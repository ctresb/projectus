const HEX_COLOR = /^#?([a-f\d]{3}|[a-f\d]{6})$/i

export function scopeTokenStyle(color: string | undefined) {
  const hsl = colorToHsl(color)
  if (!hsl) {
    return {
      color: 'var(--accent)',
      backgroundColor: 'color-mix(in srgb, var(--accent) 18%, var(--ink-2))',
    }
  }

  return {
    color: `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`,
    backgroundColor: `hsl(${hsl.h} ${scopeBackgroundSaturation(hsl.s)}% ${scopeBackgroundLightness(hsl.l)}%)`,
  }
}

function colorToHsl(color: string | undefined) {
  if (!color || !HEX_COLOR.test(color)) return null

  const hex = color.replace('#', '')
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : hex
  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  const delta = max - min

  if (delta === 0) return { h: 0, s: 0, l: Math.round(lightness * 100) }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (max === red) hue = ((green - blue) / delta) % 6
  else if (max === green) hue = (blue - red) / delta + 2
  else hue = (red - green) / delta + 4

  return {
    h: Math.round(hue * 60 < 0 ? hue * 60 + 360 : hue * 60),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  }
}

function scopeBackgroundSaturation(saturation: number) {
  return clamp(Math.round(saturation * 0.14), 8, 16)
}

function scopeBackgroundLightness(lightness: number) {
  return clamp(Math.round(lightness * 0.42), 18, 28)
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
