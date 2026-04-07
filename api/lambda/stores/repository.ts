import { randomUUID } from "node:crypto"
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb"
import { docClient } from "../../lambda-common/dynamo-client"
import type { StoreInput, StoreRecord } from "./types"

const tableName = process.env.STORES_TABLE_NAME || "Stores"

function normalizeStore(store: Partial<StoreRecord>): StoreRecord {
  return {
    id: String(store.id || ""),
    name: String(store.name || ""),
    address: String(store.address || ""),
    prefecture: String(store.prefecture || ""),
    city: String(store.city || ""),
    latitude: Number(store.latitude || 0),
    longitude: Number(store.longitude || 0),
    openedAt: String(store.openedAt || ""),
    note: String(store.note || ""),
  }
}

export async function listStores(prefecture?: string, query?: string): Promise<StoreRecord[]> {
  const response = await docClient.send(
    new ScanCommand({
      TableName: tableName,
    }),
  )

  const all = (response.Items || []).map((item) => normalizeStore(item as StoreRecord))

  let filtered = all
  if (prefecture) {
    filtered = filtered.filter((store) => store.prefecture === prefecture)
  }

  if (query) {
    const q = query.toLowerCase()
    filtered = filtered.filter((store) => `${store.name} ${store.address}`.toLowerCase().includes(q))
  }

  return filtered.sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
}

export async function getStoreById(id: string): Promise<StoreRecord | null> {
  const response = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { id },
    }),
  )

  if (!response.Item) return null
  return normalizeStore(response.Item as StoreRecord)
}

export async function createStore(input: StoreInput): Promise<StoreRecord> {
  const store: StoreRecord = {
    id: randomUUID(),
    name: input.name,
    address: input.address,
    prefecture: input.prefecture,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
    openedAt: input.openedAt,
    note: input.note || "",
  }

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: store,
      ConditionExpression: "attribute_not_exists(id)",
    }),
  )

  return store
}

export async function updateStore(id: string, input: StoreInput): Promise<StoreRecord | null> {
  const existing = await getStoreById(id)
  if (!existing) return null

  const response = await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { id },
      UpdateExpression:
        "SET #name = :name, #address = :address, #prefecture = :prefecture, #city = :city, #latitude = :latitude, #longitude = :longitude, #openedAt = :openedAt, #note = :note",
      ExpressionAttributeNames: {
        "#name": "name",
        "#address": "address",
        "#prefecture": "prefecture",
        "#city": "city",
        "#latitude": "latitude",
        "#longitude": "longitude",
        "#openedAt": "openedAt",
        "#note": "note",
      },
      ExpressionAttributeValues: {
        ":name": input.name,
        ":address": input.address,
        ":prefecture": input.prefecture,
        ":city": input.city,
        ":latitude": input.latitude,
        ":longitude": input.longitude,
        ":openedAt": input.openedAt,
        ":note": input.note || "",
      },
      ReturnValues: "ALL_NEW",
    }),
  )

  if (!response.Attributes) return null
  return normalizeStore(response.Attributes as StoreRecord)
}

export async function deleteStore(id: string): Promise<boolean> {
  const existing = await getStoreById(id)
  if (!existing) return false

  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { id },
    }),
  )

  return true
}
