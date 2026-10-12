// Sessions: after signing in with Google (routes/auth.js), the browser holds a
// random token in an httpOnly cookie, which page scripts cannot read. Each API
// request finds its session, and so its user, from it.
//
// SameSite=Lax: the browser does not send the cookie with a request another
// site makes (a form posting to /api from elsewhere), which protects against
// CSRF. Secure (HTTPS only) when the request came over HTTPS.
import crypto from 'node:crypto';
import Session from '../models/Session.js';

export const COOKIE = 'sid';
const DAY_MS = 86_400_000;
const LIFETIME_MS = 30 * DAY_MS;
// A session used less than this before its end is extended to LIFETIME_MS again,
// so someone using the app stays signed in
const RENEW_BEFORE_MS = 15 * DAY_MS;

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

function setCookie(req, res, token, expiresAt) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Behind a proxy that ends HTTPS (Tailscale...), the protocol is in X-Forwarded-Proto
    secure: req.secure || req.get('X-Forwarded-Proto') === 'https',
    path: '/',
    expires: expiresAt,
  });
}

export async function startSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + LIFETIME_MS);
  await Session.create({ _id: hash(token), user: user._id, expiresAt });
  setCookie(req, res, token, expiresAt);
}

export async function endSession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) await Session.deleteOne({ _id: hash(token) });
  res.clearCookie(COOKIE, { path: '/' });
}

// Every /api route after it needs a signed-in user: sets req.userId (an
// ObjectId), the user every query of the request filters on (lib/owned.js)
export async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  // MongoDB deletes expired sessions within a minute or so: check the date too
  const session = token && (await Session.findOne({ _id: hash(token), expiresAt: { $gt: new Date() } }));
  if (!session) return res.status(401).json({ error: 'Connectez-vous pour continuer' });

  if (session.expiresAt - Date.now() < RENEW_BEFORE_MS) {
    session.expiresAt = new Date(Date.now() + LIFETIME_MS);
    await session.save();
    setCookie(req, res, token, session.expiresAt);
  }
  req.userId = session.user;
  next();
}
