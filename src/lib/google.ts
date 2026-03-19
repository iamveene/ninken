import { google } from "googleapis"
import { OAuth2Client } from "google-auth-library"
import type { TokenData } from "./auth"

function createOAuth2Client(token: TokenData): OAuth2Client {
  const oauth2Client = new OAuth2Client(token.client_id, token.client_secret)

  oauth2Client.setCredentials({
    access_token: token.token,
    refresh_token: token.refresh_token,
  })

  return oauth2Client
}

/** @deprecated Use createGmailServiceFromToken() instead. Will be removed in Phase 1. */
export function createGmailService(token: TokenData) {
  return google.gmail({ version: "v1", auth: createOAuth2Client(token) })
}

/** @deprecated Use createDriveServiceFromToken() instead. Will be removed in Phase 1. */
export function createDriveService(token: TokenData) {
  return google.drive({ version: "v3", auth: createOAuth2Client(token) })
}

/** @deprecated Use createCalendarServiceFromToken() instead. Will be removed in Phase 1. */
export function createCalendarService(token: TokenData) {
  return google.calendar({ version: "v3", auth: createOAuth2Client(token) })
}

/** @deprecated Use createStorageServiceFromToken() instead. Will be removed in Phase 1. */
export function createStorageService(token: TokenData) {
  return google.storage({ version: "v1", auth: createOAuth2Client(token) })
}

/** @deprecated Use createResourceManagerServiceFromToken() instead. Will be removed in Phase 1. */
export function createResourceManagerService(token: TokenData) {
  return google.cloudresourcemanager({ version: "v3", auth: createOAuth2Client(token) })
}

/** @deprecated Use createDirectoryServiceFromToken() instead. Will be removed in Phase 1. */
export function createDirectoryService(token: TokenData) {
  return google.admin({ version: "directory_v1", auth: createOAuth2Client(token) })
}

/** @deprecated Use createChatServiceFromToken() instead. Will be removed in Phase 1. */
export function createChatService(token: TokenData) {
  return google.chat({ version: "v1", auth: createOAuth2Client(token) })
}

// --- New bearer-token factories (Phase 0 — F2) ---

function createBearerClient(accessToken: string): OAuth2Client {
  const client = new OAuth2Client()
  client.setCredentials({ access_token: accessToken })
  return client
}

export function createGmailServiceFromToken(accessToken: string) {
  return google.gmail({ version: "v1", auth: createBearerClient(accessToken) })
}

export function createDriveServiceFromToken(accessToken: string) {
  return google.drive({ version: "v3", auth: createBearerClient(accessToken) })
}

export function createCalendarServiceFromToken(accessToken: string) {
  return google.calendar({ version: "v3", auth: createBearerClient(accessToken) })
}

export function createStorageServiceFromToken(accessToken: string) {
  return google.storage({ version: "v1", auth: createBearerClient(accessToken) })
}

export function createResourceManagerServiceFromToken(accessToken: string) {
  return google.cloudresourcemanager({ version: "v3", auth: createBearerClient(accessToken) })
}

export function createDirectoryServiceFromToken(accessToken: string) {
  return google.admin({ version: "directory_v1", auth: createBearerClient(accessToken) })
}

export function createChatServiceFromToken(accessToken: string) {
  return google.chat({ version: "v1", auth: createBearerClient(accessToken) })
}

export function createGroupsSettingsServiceFromToken(accessToken: string) {
  return google.groupssettings({ version: "v1", auth: createBearerClient(accessToken) })
}
