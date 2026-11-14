const crypto = require("crypto");
const dns = require("dns").promises;
const fs = require("fs/promises");
const path = require("path");
const express = require("express");
const authRouter = require("./auth");
const getPublicOrigin = require("./public-origin");

const router = express.Router();
const ordersFile = path.resolve(
  process.env.PAYMENT_ORDERS_FILE || path.join(__dirname, "data", "payments.json")
);
const gatewayUrl = process.env.PAYFAST_SANDBOX === "false"
  ? "https://www.payfast.co.za/eng/process"
  : "https://sandbox.payfast.co.za/eng/process";
const validationUrl = process.env.PAYFAST_SANDBOX === "false"
  ? "https://www.payfast.co.za/eng/query/validate"
  : "https://sandbox.payfast.co.za/eng/query/validate";
const payFastIpHosts = ["www.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za", "sandbox.payfast.co.za"];
let orderStoreQueue = Promise.resolve();

class PaymentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getPaymentConfig() {
  const amountText = process.env.PACT_CONTRIBUTION_AMOUNT_ZAR || "2500.00";
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amountText)) {
    throw new Error("PACT_CONTRIBUTION_AMOUNT_ZAR must be a positive amount with up to two decimal places.");
  }
  const amountCents = Math.round(Number(amountText) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
    throw new Error("PACT_CONTRIBUTION_AMOUNT_ZAR must be greater than zero.");
  }
  return {
    amountCents,
    amount: (amountCents / 100).toFixed(2),
    sandbox: process.env.PAYFAST_SANDBOX !== "false",
    enabled: Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY)
  };
}

function encodePayFastValue(value) {
  return encodeURIComponent(String(value).trim()).replace(/%20/g, "+");
}

function createSignature(entries, passphrase = "") {
  const parameters = entries
    .filter(([key, value]) => key !== "signature" && String(value).trim() !== "")
    .map(([key, value]) => `${key}=${encodePayFastValue(value)}`)
    .join("&");
  const signatureInput = passphrase
    ? `${parameters}&passphrase=${encodePayFastValue(passphrase)}`
    : parameters;
  return crypto.createHash("md5").update(signatureInput).digest("hex");
}

function parseFormBody(body) {
  if (!Buffer.isBuffer(body)) {
    throw new PaymentError(400, "Expected a URL-encoded PayFast notification.");
  }
  return [...new URLSearchParams(body.toString("utf8")).entries()];
}

function normalizeIp(address) {
  if (!address) return "";
  const normalized = address.replace(/^::ffff:/, "");
  return normalized === "::1" ? "127.0.0.1" : normalized;
}

async function isPayFastIp(address) {
  const senderIp = normalizeIp(address);
  const resolvedAddresses = await Promise.all(payFastIpHosts.map(async (host) => {
    try {
      return (await dns.lookup(host, { all: true })).map((entry) => normalizeIp(entry.address));
    } catch (error) {
      throw new PaymentError(503, `Unable to verify PayFast notification source (${error.message}).`);
    }
  }));
  return resolvedAddresses.flat().includes(senderIp);
}

async function loadOrders() {
  await fs.mkdir(path.dirname(ordersFile), { recursive: true });
  try {
    const orders = JSON.parse(await fs.readFile(ordersFile, "utf8"));
    if (!Array.isArray(orders)) {
      throw new Error("The payment order store must contain a JSON array.");
    }
    return orders;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function saveOrders(orders) {
  const temporaryFile = `${ordersFile}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(orders, null, 2), { mode: 0o600 });
  await fs.rename(temporaryFile, ordersFile);
}

function withOrders(operation, save = false) {
  const result = orderStoreQueue.then(async () => {
    const orders = await loadOrders();
    const value = await operation(orders);
    if (save) await saveOrders(orders);
    return value;
  });
  orderStoreQueue = result.then(() => undefined, () => undefined);
  return result;
}

function publicOrder(order) {
  return {
    reference: order.reference,
    amount: (order.amountCents / 100).toFixed(2),
    currency: "ZAR",
    status: order.status,
    createdAt: order.createdAt,
    paidAt: order.paidAt || null,
    groupName: order.groupName
  };
}

function getBaseUrl(value, fallback) {
  const baseUrl = value || fallback;
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new PaymentError(503, "Configure valid public application URLs for PayFast.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new PaymentError(503, "PayFast application URLs must use HTTPS in production.");
  }
  return url.origin;
}

router.get("/config", (req, res, next) => {
  try {
    const config = getPaymentConfig();
    res.setHeader("Cache-Control", "no-store");
    res.json({
      enabled: config.enabled,
      amount: config.amount,
      currency: "ZAR",
      sandbox: config.sandbox
    });
  } catch (error) {
    next(error);
  }
});

router.post("/checkout", authRouter.requireAuthenticatedUser, async (req, res, next) => {
  try {
    const config = getPaymentConfig();
    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    if (!merchantId || !merchantKey) {
      throw new PaymentError(503, "PayFast is not configured. Add your merchant credentials to backend/.env.");
    }

    const frontendUrl = getBaseUrl(getPublicOrigin(), "http://localhost:5173");
    const notifyBaseUrl = getBaseUrl(process.env.PAYFAST_NOTIFY_BASE_URL, frontendUrl);
    const reference = crypto.randomUUID();
    const groupName = typeof req.body?.groupName === "string"
      ? req.body.groupName.trim().slice(0, 100)
      : "";
    if (!groupName) {
      throw new PaymentError(400, "A savings group is required for this payment.");
    }

    const returnUrl = new URL("/", frontendUrl);
    returnUrl.searchParams.set("payment", "success");
    returnUrl.searchParams.set("reference", reference);
    const cancelUrl = new URL("/", frontendUrl);
    cancelUrl.searchParams.set("payment", "cancelled");
    cancelUrl.searchParams.set("reference", reference);
    const notifyUrl = new URL("/api/payments/notify", notifyBaseUrl);
    const [firstName, ...lastNames] = req.authUser.name.split(/\s+/);
    const fields = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: returnUrl.toString(),
      cancel_url: cancelUrl.toString(),
      notify_url: notifyUrl.toString(),
      name_first: firstName.slice(0, 100),
      name_last: lastNames.join(" ").slice(0, 100),
      email_address: req.authUser.email,
      m_payment_id: reference,
      amount: config.amount,
      item_name: `${groupName} contribution`.slice(0, 100)
    };
    const entries = Object.entries(fields);
    fields.signature = createSignature(entries, process.env.PAYFAST_PASSPHRASE || "");

    const order = {
      reference,
      userId: req.authUser.id,
      email: req.authUser.email,
      name: req.authUser.name,
      groupName,
      amountCents: config.amountCents,
      status: "pending",
      createdAt: new Date().toISOString(),
      pfPaymentId: null
    };
    await withOrders((orders) => {
      orders.push(order);
    }, true);

    res.status(201).json({
      reference,
      checkoutUrl: gatewayUrl,
      fields
    });
  } catch (error) {
    next(error);
  }
});

router.post("/notify", async (req, res, next) => {
  try {
    const entries = parseFormBody(req.body);
    const fields = Object.fromEntries(entries);
    const config = getPaymentConfig();
    const passphrase = process.env.PAYFAST_PASSPHRASE || "";
    const expectedSignature = createSignature(entries, passphrase);
    const providedSignature = typeof fields.signature === "string" ? fields.signature.toLowerCase() : "";
    const expectedBytes = Buffer.from(expectedSignature, "hex");
    const providedBytes = /^[a-f0-9]{32}$/.test(providedSignature)
      ? Buffer.from(providedSignature, "hex")
      : Buffer.alloc(0);
    if (
      !process.env.PAYFAST_MERCHANT_ID ||
      expectedBytes.length !== providedBytes.length ||
      !crypto.timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new PaymentError(400, "Invalid PayFast notification signature.");
    }
    if (fields.merchant_id !== process.env.PAYFAST_MERCHANT_ID) {
      throw new PaymentError(400, "PayFast merchant ID did not match.");
    }

    const senderIp = normalizeIp(
      process.env.PAYFAST_TRUST_PROXY === "true" || process.env.VERCEL === "1"
        ? req.ip
        : req.socket.remoteAddress
    );
    const skipIpCheck = process.env.NODE_ENV !== "production" &&
      process.env.PAYFAST_SKIP_ITN_IP_CHECK === "true";
    if (!skipIpCheck && !(await isPayFastIp(senderIp))) {
      throw new PaymentError(403, "PayFast notification source IP is not trusted.");
    }

    const reference = fields.m_payment_id;
    if (!reference || typeof fields.amount_gross !== "string") {
      throw new PaymentError(400, "PayFast notification is missing the payment reference or amount.");
    }
    const order = await withOrders((orders) => orders.find((item) => item.reference === reference));
    if (!order) {
      throw new PaymentError(404, "PayFast payment reference was not found.");
    }
    const grossCents = Math.round(Number(fields.amount_gross) * 100);
    if (!Number.isSafeInteger(grossCents) || Math.abs(grossCents - order.amountCents) > 1) {
      throw new PaymentError(400, "PayFast payment amount did not match the order.");
    }

    const validationResponse = await fetch(validationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: req.body,
      signal: AbortSignal.timeout(10000)
    });
    if (!validationResponse.ok || (await validationResponse.text()).trim() !== "VALID") {
      throw new PaymentError(400, "PayFast could not validate the notification.");
    }

    const paymentStatus = fields.payment_status;
    if (paymentStatus !== "COMPLETE" && paymentStatus !== "CANCELLED") {
      return res.status(200).send("OK");
    }
    await withOrders((orders) => {
      const currentOrder = orders.find((item) => item.reference === reference);
      if (!currentOrder) {
        throw new PaymentError(404, "PayFast payment reference was not found.");
      }
      if (currentOrder.status === "paid") return;
      if (paymentStatus === "COMPLETE") {
        const duplicatePayment = fields.pf_payment_id && orders.some((item) =>
          item.reference !== reference && item.pfPaymentId === fields.pf_payment_id
        );
        if (duplicatePayment) {
          throw new PaymentError(409, "PayFast transaction was already applied to another payment.");
        }
        currentOrder.status = "paid";
        currentOrder.paidAt = new Date().toISOString();
        currentOrder.pfPaymentId = fields.pf_payment_id || null;
      } else if (currentOrder.status === "pending") {
        currentOrder.status = "cancelled";
      }
    }, true);
    res.status(200).send("OK");
  } catch (error) {
    next(error);
  }
});

router.get("/:reference", authRouter.requireAuthenticatedUser, async (req, res, next) => {
  try {
    const order = await withOrders((orders) =>
      orders.find((item) => item.reference === req.params.reference && item.userId === req.authUser.id)
    );
    if (!order) {
      throw new PaymentError(404, "Payment was not found.");
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ payment: publicOrder(order) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
