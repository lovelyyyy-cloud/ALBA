import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  UserCredential,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let sameOriginAuthCheckPromise: Promise<boolean> | null = null;

export async function ensureSameOriginAuthDomain(): Promise<boolean> {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return false;
  }
  if (!sameOriginAuthCheckPromise) {
    sameOriginAuthCheckPromise = (async () => {
      try {
        const res = await fetch('/__/auth/iframe', { cache: 'no-store' });
        if (!res.ok) return false;
        const text = await res.text();
        return text.includes('AuthRelay') || text.includes('fireauth.iframe');
      } catch {
        return false;
      }
    })();
  }
  const hasSameOriginProxy = await sameOriginAuthCheckPromise;
  if (hasSameOriginProxy) {
    auth.config.authDomain = window.location.host;
  } else {
    auth.config.authDomain = firebaseConfig.authDomain;
  }
  return hasSameOriginProxy;
}

export async function signInWithGoogleSmart(): Promise<UserCredential> {
  const usedSameOrigin = await ensureSameOriginAuthDomain();
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const isUserCancelOrBlock =
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-blocked';

    if (usedSameOrigin && !isUserCancelOrBlock) {
      // 동일 출처 프록시 경로 실패 시 기본 firebaseapp.com authDomain으로 1회 재시도
      auth.config.authDomain = firebaseConfig.authDomain;
      return await signInWithPopup(auth, googleProvider);
    }
    throw error;
  }
}

export async function signInWithGoogleRedirect(): Promise<void> {
  await ensureSameOriginAuthDomain();
  await signInWithRedirect(auth, googleProvider);
}

export async function completeGoogleRedirectResult(): Promise<UserCredential | null> {
  await ensureSameOriginAuthDomain();
  return await getRedirectResult(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
