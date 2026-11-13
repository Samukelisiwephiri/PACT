const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { promisify } = require("util");
const express = require("express");

const scrypt = promisify(crypto.scrypt);
const router = express.Router();
const sessionCookieName = "pact_session";
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const frontendOrigin = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
const usersFile = path.resolve(
  process.env.AUTH_USERS_FILE || path.join(__dirname, "data", "users.json")
);
const sessions = new Map();
let userStoreQueue = Promise.resolve();

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function requireTrustedOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin && origin !== frontendOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isValidEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

async function loadUsers() {
  await fs.mkdir(path.dirname(usersFile), { recursive: true });
  try {
    const users = JSON.parse(await fs.readFile(usersFile, "utf8"));
    if (!Array.isArray(users)) {
      throw new Error("The auth user store must contain a JSON array.");
    }
    return users;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function saveUsers(users) {
  const temporaryFile = `${usersFile}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(temporaryFile, usersFile);
}

function withUsers(operation, save = false) {
  const result = userStoreQueue.then(async () => {
    const users = await loadUsers();
    const value = await operation(users);
    if (save) await saveUsers(users);
    return value;
  });
  userStoreQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString("hex") };
}

function setSessionCookie(res, token) {
  const production = process.env.NODE_ENV === "production";
  const cookie = [
    `${sessionCookieName}=${token}`,
    "HttpOnly",
    "Path=/",
    `SameSite=${production ? "None" : "Lax"}`,
    `Max-Age=${Math.floor(sessionLifetimeMs / 1000)}`
  ];
  if (production) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function clearSessionCookie(res) {
  const production = process.env.NODE_ENV === "production";
  const cookie = [
    `${sessionCookieName}=`,
    "HttpOnly",
    "Path=/",
    `SameSite=${production ? "None" : "Lax"}`,
    "Max-Age=0"
  ];
  if (production) cookie.push("Secure");
  res.setHeader("Set-Cookie", cookie.join("; "));
}

function createSession(res, user) {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { userId: user.id, expiresAt: now + sessionLifetimeMs });
  setSessionCookie(res, token);
  return publicUser(user);
}

function getSessionToken(req) {
  const cookies = (req.get("cookie") || "").split(";");
  const cookie = cookies.find((item) => item.trim().startsWith(`${sessionCookieName}=`));
  return cookie ? cookie.trim().slice(sessionCookieName.length + 1) : "";
}

function requireEmailAndPassword(req) {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!isValidEmail(email)) {
    throw new AuthError(400, "Enter a valid email address.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new AuthError(400, "Password must be between 8 and 128 characters.");
  }
  return { email, password };
}

router.use(requireTrustedOrigin);
router.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/me", async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    const session = sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (token) sessions.delete(token);
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not signed in." });
    }
    const user = await withUsers((users) => users.find((item) => item.id === session.userId));
    if (!user) {
      sessions.delete(token);
      clearSessionCookie(res);
      return res.status(401).json({ error: "Not signed in." });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = requireEmailAndPassword(req);
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (name.length < 1 || name.length > 80) {
      throw new AuthError(400, "Name must be between 1 and 80 characters.");
    }

    const user = await withUsers(async (users) => {
      if (users.some((item) => item.email === email)) {
        throw new AuthError(409, "An account with this email already exists.");
      }
      const passwordHash = await hashPassword(password);
      const newUser = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordSalt: passwordHash.salt,
        passwordHash: passwordHash.hash,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      return newUser;
    }, true);

    res.status(201).json({ user: createSession(res, user) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = requireEmailAndPassword(req);
    const user = await withUsers((users) => users.find((item) => item.email === email));
    const candidateHash = (await hashPassword(password, user?.passwordSalt || "pact-invalid-user-salt")).hash;
    const candidateBuffer = Buffer.from(candidateHash, "hex");
    const storedBuffer = Buffer.from(user?.passwordHash || candidateHash, "hex");
    const valid = candidateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(candidateBuffer, storedBuffer);

    if (!user || !user.passwordHash || !valid) {
      throw new AuthError(401, "Email or password is incorrect.");
    }
    res.json({ user: createSession(res, user) });
  } catch (error) {
    next(error);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new AuthError(503, "Google sign-in is not configured on the server.");
    }
    const credential = req.body?.credential;
    if (typeof credential !== "string" || credential.length > 8192) {
      throw new AuthError(400, "Google sign-in credential is missing or invalid.");
    }

    let response;
    try {
      const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
      tokenInfoUrl.searchParams.set("id_token", credential);
      response = await fetch(tokenInfoUrl, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new AuthError(503, "Google sign-in could not be verified. Please try again.");
    }
    if (!response.ok) {
      throw new AuthError(401, "Google sign-in could not be verified.");
    }

    const claims = await response.json();
    const email = normalizeEmail(claims.email);
    const validIssuer = ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss);
    if (
      claims.aud !== process.env.GOOGLE_CLIENT_ID ||
      !validIssuer ||
      ![true, "true"].includes(claims.email_verified) ||
      typeof claims.sub !== "string" ||
      !isValidEmail(email)
    ) {
      throw new AuthError(401, "Google sign-in could not be verified.");
    }

    const name = typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim().slice(0, 80)
      : email.split("@")[0];
    const user = await withUsers((users) => {
      let existing = users.find((item) => item.googleId === claims.sub);
      const emailOwner = users.find((item) => item.email === email);
      if (existing && emailOwner && existing.id !== emailOwner.id) {
        throw new AuthError(409, "This Google account conflicts with an existing account.");
      }
      if (!existing) existing = emailOwner;
      if (existing) {
        existing.googleId = claims.sub;
        if (!existing.name) existing.name = name;
        return existing;
      }

      const newUser = {
        id: crypto.randomUUID(),
        name,
        email,
        googleId: claims.sub,
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      return newUser;
    }, true);

    res.json({ user: createSession(res, user) });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  res.json({ success: true });
});

module.exports = router;
