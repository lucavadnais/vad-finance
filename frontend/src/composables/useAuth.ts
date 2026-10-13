// The signed-in user. The session itself is an httpOnly cookie the page never
// sees (backend/src/lib/auth.js): the API tells who is signed in.
import type { User } from '@/types';
import { ref } from 'vue';
import { api, setUnauthorizedHandler } from '@/api';

// undefined while the app checks for a session at startup, null when nobody is
// signed in (App shows the sign-in page)
const user = ref<User | null | undefined>(undefined);
// Who was signed in before the session ended: someone else signing in then
// reloads the page, so nothing of the previous user's data stays in memory
let lastUserId: string | null = null;

setUnauthorizedHandler(() => (user.value = null));

async function loadUser() {
  try {
    user.value = await api.getMe();
    lastUserId = user.value._id;
  } catch {
    user.value = null;
  }
}

function setSignedIn(signedIn: User) {
  if (lastUserId && lastUserId !== signedIn._id) return window.location.reload();
  lastUserId = signedIn._id;
  user.value = signedIn;
}

async function signIn(credential: string) {
  setSignedIn(await api.signInWithGoogle(credential));
}

// Local tests only (DEV_LOGIN=1 on the server)
async function signInAsTestUser() {
  setSignedIn(await api.signInAsTestUser());
}

// Back to a fresh page: the user's data, picked account and month... all go
async function signOut() {
  await api.signOut();
  window.location.assign('/');
}

// Then back to the sign-in page, the same way as signing out
async function deleteAccount() {
  await api.deleteMe();
  window.location.assign('/');
}

export function useAuth() {
  return { user, loadUser, signIn, signInAsTestUser, signOut, deleteAccount };
}
