import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda"
import {
  checkNearbyStoresHandler,
  createStoreHandler,
  deleteStoreHandler,
  getStoreHandler,
  listStoresHandler,
  updateStoreHandler,
} from "./handlers"

// API Gateway mapping entrypoints
export const getStores = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  listStoresHandler(event)

export const postStore = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  createStoreHandler(event)

export const getStoreById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  getStoreHandler(event)

export const putStoreById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  updateStoreHandler(event)

export const deleteStoreById = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  deleteStoreHandler(event)

export const postCheckNearbyStores = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  checkNearbyStoresHandler(event)
