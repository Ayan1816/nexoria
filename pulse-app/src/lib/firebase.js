import { getApps, initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

function envValue(name) {
  const env = import.meta.env
  if (!env || typeof env !== 'object') return ''
  const value = env[name]
  return typeof value === 'string' ? value : ''
}

function readConfig() {
  const config = {
    apiKey: envValue('VITE_FIREBASE_API_KEY'),
    authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: envValue('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: envValue('VITE_FIREBASE_APP_ID'),
  }
  const enabled = Object.values(config).every((value) => value.length > 0)
  return enabled ? config : null
}

let firebase = null
let sessionCloudOff = false

export function cloudEnabled() {
  return readConfig() !== null
}

export function cloudSessionOpen() {
  return cloudEnabled() && !sessionCloudOff
}

export function noteCloudUnavailable() {
  sessionCloudOff = true
}

export function isOptionalCloudError(error) {
  const code = String(error?.code ?? '')
  const message = String(error?.message ?? '')
  if (code === 'AUTH' || code.startsWith('auth/')) return true
  if (/^(permission-denied|unauthenticated|unavailable|deadline-exceeded|cancelled|resource-exhausted)$/.test(code)) return true
  return /permission|unauthenticated|unavailable|network request failed|auth\//i.test(`${code} ${message}`)
}

export function getFirebase() {
  const config = readConfig()
  if (!config) return null
  if (!firebase) {
    const app = getApps()[0] ?? initializeApp(config)
    firebase = { app, db: getFirestore(app), auth: getAuth(app) }
  }
  return firebase
}

export async function ensureCloudUser() {
  if (sessionCloudOff) return null
  const client = getFirebase()
  if (!client) return null
  if (client.auth.currentUser) return client.auth.currentUser
  try {
    const credential = await signInAnonymously(client.auth)
    return credential.user
  } catch (error) {
    sessionCloudOff = true
    console.error(error)
    return null
  }
}
