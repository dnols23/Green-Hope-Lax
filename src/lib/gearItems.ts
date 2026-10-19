// The made-to-order gear and its head count rules. Pure, so the public form
// (a client component) can read it without pulling in the database.

export type GearItem = 'gloves' | 'bag'

export const GEAR_MINIMUM = 6
/** When the head count closes — the same day the spirit-wear store closes. */
export const GEAR_DEADLINE = 'Friday, October 30'
export const BATTLELAX_STORE = 'https://battlelax.com/pages/green-hope-team-store'

export const GEAR: { key: GearItem; name: string; price: number; sizes: string[] | null; blurb: string; image: string }[] = [
  {
    key: 'gloves',
    name: 'Green Hope Maverik M6 Gloves',
    price: 138,
    sizes: ['10"', '12"', '13"', '14"', 'Not sure yet'],
    blurb: 'Maverik’s M6 in black with the Green Hope Falcon.',
    image: '/shop/maverik-m6-gloves.jpg',
  },
  {
    key: 'bag',
    name: 'Green Hope Maverik Monster Bag',
    price: 58,
    sizes: null,
    blurb: 'The big Maverik duffel, black, with the Falcon on the side.',
    image: '/shop/maverik-monster-bag.jpg',
  },
]

export const isGearItem = (v: unknown): v is GearItem => v === 'gloves' || v === 'bag'
