export type StoreRecord = {
  id: string
  name: string
  address: string
  prefecture: string
  city: string
  latitude: number
  longitude: number
  openedAt: string
  note: string
}

export type StoreInput = {
  name: string
  address: string
  openedAt: string
  note?: string
  prefecture: string
  city: string
  latitude: number
  longitude: number
}

export type NearbyCheckInput = {
  latitude: number
  longitude: number
  prefecture: string
  radiusKm?: number
  excludeStoreId?: string
}
