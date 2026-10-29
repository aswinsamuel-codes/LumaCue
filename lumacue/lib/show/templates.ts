/**
 * Ready-made costume layouts for Costume setup. LED counts are planning
 * figures for 60 LED/m strip, not measurements of a built costume.
 * Zone ids are a, b, c… in every template, so sections and clips that
 * target a zone keep working when you switch template.
 */
import type { Placement } from '@/lib/show/body'

export interface CostumeTemplate {
  id: string
  label: string
  hint: string
  zones: { id: string; name: string; leds: number; placement: Placement }[]
}

export const COSTUME_TEMPLATES: CostumeTemplate[] = [
  {
    id: 'bench',
    label: 'Bench test',
    hint: 'Matches the bench firmware: 1 m of strip in 3 zones',
    zones: [
      { id: 'a', name: 'Zone A — arms', leds: 20, placement: 'arms' },
      { id: 'b', name: 'Zone B — chest', leds: 20, placement: 'chest' },
      { id: 'c', name: 'Zone C — legs', leds: 20, placement: 'legs' },
    ],
  },
  {
    id: 'hands-jacket',
    label: 'Hand bands + jacket',
    hint: 'Hand bands wired to the jacket controller (zone A), for a hands-only opening then the full costume',
    zones: [
      { id: 'a', name: 'Hand bands', leds: 24, placement: 'hands' },
      { id: 'b', name: 'Arms', leds: 40, placement: 'arms' },
      { id: 'c', name: 'Chest V', leds: 30, placement: 'chest' },
    ],
  },
  {
    id: 'hands',
    label: 'Hand bands only',
    hint: 'Two wrist bands, no costume',
    zones: [{ id: 'a', name: 'Hand bands', leds: 24, placement: 'hands' }],
  },
  {
    id: 'full',
    label: 'Full suit',
    hint: 'Hood, arms, chest, belt, legs and hand bands: needs an ESP32-class controller (the bench Nano drives 3 zones)',
    zones: [
      { id: 'a', name: 'Hand bands', leds: 24, placement: 'hands' },
      { id: 'b', name: 'Arms', leds: 50, placement: 'arms' },
      { id: 'c', name: 'Chest V', leds: 30, placement: 'chest' },
      { id: 'd', name: 'Legs', leds: 50, placement: 'legs' },
      { id: 'e', name: 'Hood', leds: 24, placement: 'head' },
      { id: 'f', name: 'Belt', leds: 16, placement: 'belt' },
    ],
  },
]
