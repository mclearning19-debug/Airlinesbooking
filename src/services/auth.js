// Better Auth browser client. Same-origin, so no baseURL: it talks to /api/auth/* on this server and the
// session lives in an httpOnly cookie (nothing to store in localStorage).
// Components use authClient.useSession() for the current user and the sign-in/up/out calls below.
// Like services/api.js, this is a seam: pages import from here and never fetch /api/auth themselves.
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();
export const { useSession, signIn, signUp, signOut } = authClient;
