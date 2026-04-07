import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { stores as seedStores } from "@/lib/mock-data"
import type { Store } from "@/lib/types"
import { geocodeAddress } from "@/lib/server/geocoding"

type StoreFormInput = {
  name: string
  address: string
  openedAt: string
  note?: string
}

type StoreFile = {
  stores: Store[]
}

const dataDir = path.join(process.cwd(), "data")
const storeFilePath = path.join(dataDir, "stores.json")

let lock: Promise<void> = Promise.resolve()

async function withLock<T>(task: () => Promise<T>): Promise<T> {
  const prev = lock
  let release!: () => void
  lock = new Promise<void>((resolve) => {
    release = resolve
  })
  await prev
  try {
    return await task()
  } finally {
    release()
  }
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(storeFilePath, "utf-8")
  } catch {
    const initial: StoreFile = { stores: seedStores }
    await writeFile(storeFilePath, JSON.stringify(initial, null, 2), "utf-8")
  }
}

async function readStoreFile(): Promise<StoreFile> {
  await ensureStoreFile()
  const raw = await readFile(storeFilePath, "utf-8")
  const parsed = JSON.parse(raw) as StoreFile
  return {
    stores: Array.isArray(parsed.stores) ? parsed.stores : [],
  }
}

async function writeStoreFile(data: StoreFile): Promise<void> {
  await writeFile(storeFilePath, JSON.stringify(data, null, 2), "utf-8")
}

export async function listStores(params?: {
  prefecture?: string
  query?: string
}): Promise<Store[]> {
  return withLock(async () => {
    const file = await readStoreFile()
    let result = file.stores

    if (params?.prefecture) {
      result = result.filter((s) => s.prefecture === params.prefecture)
    }

    if (params?.query) {
      const q = params.query.toLowerCase()
      result = result.filter((s) => `${s.name} ${s.address}`.toLowerCase().includes(q))
    }

    return result
  })
}

export async function getStoreById(id: string): Promise<Store | null> {
  const stores = await listStores()
  return stores.find((s) => s.id === id) ?? null
}

export async function createStore(input: StoreFormInput): Promise<Store> {
  return withLock(async () => {
    const file = await readStoreFile()
    const geocoded = await geocodeAddress(input.address)

    const store: Store = {
      id: randomUUID(),
      name: input.name.trim(),
      address: input.address.trim(),
      prefecture: geocoded.prefecture,
      city: geocoded.city,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      openedAt: input.openedAt,
      note: (input.note ?? "").trim(),
    }

    file.stores = [store, ...file.stores]
    await writeStoreFile(file)
    return store
  })
}

export async function updateStore(id: string, input: StoreFormInput): Promise<Store | null> {
  return withLock(async () => {
    const file = await readStoreFile()
    const index = file.stores.findIndex((s) => s.id === id)
    if (index < 0) return null

    const current = file.stores[index]
    const nextAddress = input.address.trim()

    let next = {
      ...current,
      name: input.name.trim(),
      address: nextAddress,
      openedAt: input.openedAt,
      note: (input.note ?? "").trim(),
    }

    if (current.address !== nextAddress) {
      const geocoded = await geocodeAddress(nextAddress)
      next = {
        ...next,
        prefecture: geocoded.prefecture,
        city: geocoded.city,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      }
    }

    file.stores[index] = next
    await writeStoreFile(file)
    return next
  })
}

export async function deleteStore(id: string): Promise<boolean> {
  return withLock(async () => {
    const file = await readStoreFile()
    const before = file.stores.length
    file.stores = file.stores.filter((s) => s.id !== id)
    if (file.stores.length === before) return false
    await writeStoreFile(file)
    return true
  })
}
