const express = require('express');
const path = require('path');
const cors = require('cors');
const { Low, JSONFile } = require('lowdb');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');

let prisma = null;
let usePrisma = false;
try {
  if (process.env.DATABASE_URL) {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    usePrisma = true;
    console.log('Using Prisma with DATABASE_URL');
  }
} catch (err) {
  console.log('Prisma not available, falling back to lowdb');
}

const app = express();
app.use(cors());
app.use(express.json());

const file = path.join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data ||= {
    store: null,
    users: [],
    products: [],
    orders: [],
    sales: [],
    permissions: {
      catalogo: true,
      carrito: true,
      pedidos: true,
      caja: true,
      inventario: true,
      admin: true,
    },
  };
  await db.write();
}

initDb();

// GET store/settings
app.get('/api/store', async (req, res) => {
  if (usePrisma) {
    const store = await prisma.store.findFirst();
    return res.json(store || null);
  }
  await db.read();
  res.json(db.data.store || null);
});

// Setup wizard: save store name and mercado pago access token
app.post('/api/setup', async (req, res) => {
  const { name, mercadoPagoAccessToken } = req.body || {};
  if (!name) return res.status(400).json({ message: 'Missing name' });

  if (usePrisma) {
    const up = await prisma.store.upsert({ where: { id: 1 }, update: { name, mercadoPagoAccessToken }, create: { name, mercadoPagoAccessToken } });
    return res.json({ ok: true, store: up });
  }

  await db.read();
  db.data.store = { name, mercadoPagoAccessToken: mercadoPagoAccessToken || null };
  await db.write();
  res.json({ ok: true, store: db.data.store });
});

// Simple auth (demo) - NEVER use in production
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (usePrisma) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) return res.status(401).json({ message: 'Credenciales incorrectas' });
    return res.json({ user });
  }

  await db.read();
  const user = db.data.users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: 'Credenciales incorrectas' });
  res.json({ user });
});

app.get('/api/products', async (req, res) => {
  if (usePrisma) {
    const products = await prisma.product.findMany({ where: { active: true } });
    return res.json(products);
  }
  await db.read();
  res.json(db.data.products.filter((p) => p.active));
});

app.get('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (usePrisma) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ message: 'No encontrado' });
    return res.json(product);
  }
  await db.read();
  const product = db.data.products.find((p) => p.id === id);
  if (!product) return res.status(404).json({ message: 'No encontrado' });
  res.json(product);
});

// Checkout endpoint: creates Mercado Pago preference if token configured, otherwise simulates.
app.post('/api/checkout', async (req, res) => {
  const { items, total, customerName, customerPhone } = req.body || {};

  // generate pickup code
  const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();
  const pickupUrl = `pickup:${pickupCode}`; // placeholder URI; can be replaced with real domain
  const qrDataUrl = await QRCode.toDataURL(pickupUrl).catch(() => null);

  const orderId = `ORD-${Date.now()}`;

  if (usePrisma) {
    // create order in Postgres
    const created = await prisma.order.create({
      data: {
        id: orderId,
        total: Number(total || 0),
        paymentStatus: 'pendiente',
        status: 'recibido',
        pickupCode,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
      },
    });

    // create items and decrease stock
    for (const it of items || []) {
      await prisma.orderItem.create({ data: { orderId: created.id, productId: it.productId, quantity: it.quantity, price: Number(it.price || 0) } });
      await prisma.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } }).catch(() => {});
    }

    // attempt to create Mercado Pago preference if token configured
    const store = await prisma.store.findFirst();
    const mpToken = store && store.mercadoPagoAccessToken ? store.mercadoPagoAccessToken : null;
    let paymentUrl = null;
    let mpResponse = null;

    if (mpToken) {
      try {
        const itemsForMp = (items || []).map((it) => ({ title: it.name || `Producto ${it.productId}`, quantity: it.quantity, currency_id: 'MXN', unit_price: Number(it.price || 0) }));
        const preferenceBody = { items: itemsForMp, external_reference: created.id, back_urls: { success: '/', failure: '/', pending: '/' }, auto_return: 'approved' };
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` }, body: JSON.stringify(preferenceBody) });
        mpResponse = await response.json();
        paymentUrl = mpResponse.init_point || mpResponse.sandbox_init_point || null;
      } catch (err) {
        console.error('MP error', err);
      }
    }

    return res.json({ order: created, pickupCode, qrDataUrl, paymentUrl, mpResponse });
  }

  // fallback lowdb
  await db.read();
  const order = { id: orderId, userId: null, status: 'recibido', total: total || 0, createdAt: new Date().toISOString(), paymentStatus: 'pendiente', items: items || [], pickupCode, customerName: customerName || null, customerPhone: customerPhone || null };
  db.data.orders.unshift(order);

  for (const it of order.items) {
    const p = db.data.products.find((x) => x.id === it.productId);
    if (p) p.stock = Math.max(0, p.stock - it.quantity);
  }

  await db.write();

  const mpToken = db.data.store && db.data.store.mercadoPagoAccessToken;
  let paymentUrl = null;
  let mpResponse = null;

  if (mpToken) {
    try {
      const itemsForMp = (order.items || []).map((it) => ({ title: it.name || `Producto ${it.productId}`, quantity: it.quantity, currency_id: 'MXN', unit_price: Number(it.price || 0) }));
      const preferenceBody = { items: itemsForMp, external_reference: order.id, back_urls: { success: '/', failure: '/', pending: '/' }, auto_return: 'approved' };
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mpToken}` }, body: JSON.stringify(preferenceBody) });
      mpResponse = await response.json();
      paymentUrl = mpResponse.init_point || mpResponse.sandbox_init_point || null;
    } catch (err) {
      console.error('MP error', err);
    }
  }

  res.json({ order, pickupCode, qrDataUrl, paymentUrl, mpResponse });
});

// webhook endpoint for Mercado Pago notifications
app.post('/api/webhook', async (req, res) => {
  // Mercado Pago sends different payloads; typically contains type/topic and data.id or id
  const body = req.body || {};
  console.log('Webhook received', body);

  try {
    // If we get an id of payment
    let paymentId = null;
    if (body.type === 'payment' && body.data && body.data.id) paymentId = body.data.id;
    if (body.type === 'payment' && body.id) paymentId = body.id;
    if (!paymentId && body.data && body.data.id) paymentId = body.data.id;

    // If no paymentId, try merchant_order
    if (!paymentId && body.type === 'merchant_order' && body.data && body.data.id) paymentId = null; // handle merchant_order later

    if (!paymentId) {
      return res.status(200).json({ ok: true });
    }

    // fetch payment from Mercado Pago to verify
    const store = usePrisma ? await prisma.store.findFirst() : (await db.read() && db.data.store);
    const mpToken = store && store.mercadoPagoAccessToken ? store.mercadoPagoAccessToken : process.env.MERCADO_PAGO_ACCESS_TOKEN || null;
    if (!mpToken) return res.status(400).json({ message: 'MP token not configured' });

    const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${mpToken}` } });
    const payment = await paymentRes.json();

    // payment.external_reference contains our order id if we set it
    const externalReference = payment.external_reference || (payment.additional_info && payment.additional_info.items && payment.additional_info.items[0] && payment.additional_info.items[0].external_reference) || null;

    if (!externalReference) {
      console.warn('No external_reference in payment');
      return res.status(200).json({ ok: true });
    }

    const status = payment.status || payment.status_detail || null;
    if (usePrisma) {
      // update order
      if (status === 'approved' || payment.status === 'approved') {
        await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: 'aprobado', status: 'listo para recoger' } }).catch(() => {});
      } else if (payment.status === 'pending') {
        await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: 'pendiente' } }).catch(() => {});
      } else {
        await prisma.order.update({ where: { id: externalReference }, data: { paymentStatus: 'rechazado' } }).catch(() => {});
      }
      return res.json({ ok: true });
    }

    // lowdb fallback
    await db.read();
    const order = db.data.orders.find((o) => o.id === externalReference || o.external_reference === externalReference);
    if (!order) return res.json({ ok: true });

    if (payment.status === 'approved') {
      order.paymentStatus = 'aprobado';
      order.status = 'listo para recoger';
    } else if (payment.status === 'pending') {
      order.paymentStatus = 'pendiente';
    } else {
      order.paymentStatus = 'rechazado';
    }
    await db.write();
    res.json({ ok: true });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(500).json({ ok: false });
  }
});

app.post('/api/orders', async (req, res) => {
  const { userId, items, total } = req.body;
  if (usePrisma) {
    const id = `ORD-${Date.now()}`;
    const order = await prisma.order.create({ data: { id, total: Number(total || 0), paymentStatus: 'pendiente', status: 'recibido' } });
    for (const it of items || []) {
      await prisma.orderItem.create({ data: { orderId: order.id, productId: it.productId, quantity: it.quantity, price: Number(it.price || 0) } });
    }
    return res.json(order);
  }

  await db.read();
  const id = `ORD-${Date.now()}`;
  const order = { id, userId, items, total, status: 'recibido', paymentStatus: 'pendiente', createdAt: new Date().toISOString() };
  db.data.orders.unshift(order);
  await db.write();
  res.json(order);
});

app.get('/api/orders', async (req, res) => {
  if (usePrisma) {
    const orders = await prisma.order.findMany({ include: { items: true } });
    return res.json(orders);
  }
  await db.read();
  res.json(db.data.orders);
});

app.post('/api/sales', async (req, res) => {
  const { cashierId, items, total, paymentMethod } = req.body;
  if (usePrisma) {
    const sale = await prisma.sale.create({ data: { id: `SALE-${Date.now()}`, cashierId: Number(cashierId), total: Number(total || 0), paymentMethod } });
    for (const it of items || []) {
      await prisma.product.update({ where: { id: it.productId }, data: { stock: { decrement: it.quantity } } }).catch(() => {});
    }
    return res.json(sale);
  }

  await db.read();
  const sale = { id: `SALE-${Date.now()}`, cashierId, items, total, paymentMethod, createdAt: new Date().toISOString() };
  db.data.sales.unshift(sale);
  for (const it of items) {
    const p = db.data.products.find((x) => x.id === it.productId);
    if (p) p.stock = Math.max(0, p.stock - it.quantity);
  }
  await db.write();
  res.json(sale);
});

app.get('/api/sales', async (req, res) => {
  if (usePrisma) {
    const sales = await prisma.sale.findMany();
    return res.json(sales);
  }
  await db.read();
  res.json(db.data.sales);
});

app.get('/api/db', async (req, res) => {
  if (usePrisma) {
    const store = await prisma.store.findFirst();
    const users = await prisma.user.findMany();
    const products = await prisma.product.findMany();
    const orders = await prisma.order.findMany({ include: { items: true } });
    return res.json({ store, users, products, orders });
  }
  await db.read();
  res.json(db.data);
});

// Static files for demo (serve built frontend if available)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// fallback to index.html for SPA routes
app.get('*', (req, res) => {
  const index = path.join(__dirname, '..', 'dist', 'index.html');
  if (require('fs').existsSync(index)) return res.sendFile(index);
  res.status(404).json({ message: 'Not found' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
