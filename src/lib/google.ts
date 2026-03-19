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

export function createGmailService(token: TokenData) {
  return google.gmail({ version: "v1", auth: createOAuth2Client(token) })
}

export function createDriveService(token: TokenData) {
  return google.drive({ version: "v3", auth: createOAuth2Client(token) })
}

export function createCalendarService(token: TokenData) {
  return google.calendar({ version: "v3", auth: createOAuth2Client(token) })
}

export function createStorageService(token: TokenData) {
  return google.storage({ version: "v1", auth: createOAuth2Client(token) })
}

export function createResourceManagerService(token: TokenData) {
  return google.cloudresourcemanager({ version: "v3", auth: createOAuth2Client(token) })
}

export function createDirectoryService(token: TokenData) {
  return google.admin({ version: "directory_v1", auth: createOAuth2Client(token) })
}

export function createChatService(token: TokenData) {
  return google.chat({ version: "v1", auth: createOAuth2Client(token) })
}
