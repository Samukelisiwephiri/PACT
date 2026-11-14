function getPublicOrigin() {
  const origin = process.env.FRONTEND_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173");
  return new URL(origin).origin;
}

module.exports = getPublicOrigin;
