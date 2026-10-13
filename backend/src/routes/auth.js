import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { endSession, requireAuth, startSession } from '../lib/auth.js';
import User from '../models/User.js';

const router = Router();
const google = new OAuth2Client();

const httpError = (status, message) => Object.assign(new Error(message), { status });

// What the frontend may know of a user
const publicUser = ({ _id, email, name, picture }) => ({ _id, email, name, picture });

// Local tests only: DEV_LOGIN=1 (in the .env file) lets anyone opening the
// app sign in as a test user, without Google. Never set it on a server others
// can reach.
const devLogin = process.env.DEV_LOGIN === '1';
const TEST_USER = { googleSub: 'dev-test-user', email: 'test@example.com', name: 'Utilisateur de test' };

// The Google client id, for the sign-in button. Public: it is in every page
// using Google's button anyway.
router.get('/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, devLogin });
});

// Body: { credential }, the ID token Google's button hands the page. Checked
// here (Google's signature, made for our client id, not expired), never trusted
// as sent. The first sign-in creates the user.
router.post('/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw httpError(503, "La connexion Google n'est pas configurée (GOOGLE_CLIENT_ID)");
  const { credential } = req.body;
  if (typeof credential !== 'string' || !credential) throw httpError(400, 'credential manquant');

  let payload;
  try {
    payload = (await google.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
  } catch {
    throw httpError(401, 'Connexion Google invalide, réessayez');
  }
  if (!payload?.email || !payload.email_verified) throw httpError(401, 'Adresse Google non vérifiée');

  const profile = { email: payload.email, name: payload.name ?? '', picture: payload.picture ?? null };
  const user = (await User.findOne({ googleSub: payload.sub })) ?? new User({ googleSub: payload.sub });
  // Kept up to date with the Google account
  user.set(profile);
  await user.save();

  // A session already open in this browser is replaced
  await endSession(req, res);
  await startSession(req, res, user);
  res.json(publicUser(user));
});

// Signs in as the test user, created at the first sign-in like a Google one
router.post('/dev', async (req, res) => {
  if (!devLogin) throw httpError(404, 'Route introuvable');
  const user = (await User.findOne({ googleSub: TEST_USER.googleSub })) ?? (await User.create(TEST_USER));
  await endSession(req, res);
  await startSession(req, res, user);
  res.json(publicUser(user));
});

router.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

// The signed-in user, or 401
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw httpError(401, 'Connectez-vous pour continuer');
  res.json(publicUser(user));
});

export default router;
