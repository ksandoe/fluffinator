import { Amplify } from 'aws-amplify'
import {
  autoSignIn,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp,
} from 'aws-amplify/auth'
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito'
import { defaultStorage, sharedInMemoryStorage } from 'aws-amplify/utils'

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

export function setTokenStorage(remember: boolean) {
  cognitoUserPoolsTokenProvider.setKeyValueStorage(
    remember ? defaultStorage : sharedInMemoryStorage,
  )
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

export type AuthStep =
  | 'EMAIL'
  | 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE'
  | 'CONFIRM_SIGN_UP'
  | 'COMPLETE_AUTO_SIGN_IN'

export async function sendCode(email: string): Promise<{
  step: AuthStep
  error?: string
}> {
  try {
    const { nextStep } = await amplifySignIn({
      username: email,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP',
      },
    })

    if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
      return { step: 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE' }
    }
    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      return { step: 'CONFIRM_SIGN_UP' }
    }

    return { step: 'EMAIL', error: 'Unexpected sign-in step: ' + nextStep.signInStep }
  } catch (err: unknown) {
    const e = err as { name?: string; message?: string }
    if (e.name === 'UserNotFoundException') {
      try {
        const { nextStep } = await signUp({
          username: email,
          options: {
            userAttributes: { email },
            autoSignIn: { authFlowType: 'USER_AUTH' },
          },
        })

        if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
          return { step: 'CONFIRM_SIGN_UP' }
        }
        if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
          return { step: 'COMPLETE_AUTO_SIGN_IN' }
        }

        return { step: 'EMAIL', error: 'Unexpected sign-up step: ' + nextStep.signUpStep }
      } catch (signupErr: unknown) {
        const se = signupErr as { message?: string }
        return { step: 'EMAIL', error: se.message || 'Sign up failed' }
      }
    }

    return { step: 'EMAIL', error: e.message || 'Failed to send code' }
  }
}

export async function verifyCode(
  email: string,
  code: string,
  step: AuthStep,
): Promise<{ success: boolean; error?: string; step?: AuthStep }> {
  try {
    if (step === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
      const { isSignedIn, nextStep } = await confirmSignIn({ challengeResponse: code })
      if (isSignedIn || nextStep.signInStep === 'DONE') {
        return { success: true }
      }
      return { success: false }
    }

    if (step === 'CONFIRM_SIGN_UP' || step === 'COMPLETE_AUTO_SIGN_IN') {
      const { nextStep } = await confirmSignUp({ username: email, confirmationCode: code })

      if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
        const { isSignedIn } = await autoSignIn()
        return { success: isSignedIn }
      }

      if (nextStep.signUpStep === 'DONE') {
        return { success: true }
      }

      return { success: false }
    }

    return { success: false, error: 'Invalid step' }
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { success: false, error: e.message || 'Invalid or expired code' }
  }
}

export async function resendCode(
  email: string,
  step: AuthStep,
): Promise<{ error?: string }> {
  try {
    if (step === 'CONFIRM_SIGN_UP') {
      await resendSignUpCode({ username: email })
      return {}
    }

    await amplifySignIn({
      username: email,
      options: {
        authFlowType: 'USER_AUTH',
        preferredChallenge: 'EMAIL_OTP',
      },
    })
    return {}
  } catch (err: unknown) {
    const e = err as { message?: string }
    return { error: e.message || 'Failed to resend code' }
  }
}

export async function signOut(): Promise<void> {
  await amplifySignOut()
}
