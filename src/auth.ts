import { Amplify } from 'aws-amplify'
import {
  fetchAuthSession,
  getCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
} from 'aws-amplify/auth'

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID

if (userPoolId && userPoolClientId) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  })
}

export async function getIdToken(): Promise<string | undefined> {
  const { tokens } = await fetchAuthSession()
  return tokens?.idToken?.toString()
}

export async function currentUser(): Promise<string | null> {
  try {
    const { username } = await getCurrentUser()
    return username
  } catch {
    return null
  }
}

export async function signIn(username: string, password: string): Promise<boolean> {
  const { isSignedIn } = await amplifySignIn({ username, password })
  return isSignedIn
}

export async function signOut(): Promise<void> {
  await amplifySignOut()
}
