require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'beamcraft-secret-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ─── LOCAL JSON STORAGE (FALLBACK) ──────────
const DATA_DIR = path.join(__dirname, 'data');
const readJSON = (file) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')); } catch { return []; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

// ─── DATABASES & CLOUD UPLOADS ───────────────
const useMongo = !!process.env.MONGO_URI;
if (useMongo) {
  mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('✅ MongoDB Connected Automatically!');
    seedData(); // Seed if empty
  }).catch(err => console.error('MongoDB Error:', err));
}

// Mongoose Models
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
const Enquiry = mongoose.model('Enquiry', new mongoose.Schema({}, { strict: false }));

async function seedData() {
  if (await User.countDocuments() === 0 && fs.existsSync(path.join(DATA_DIR, 'users.json'))) 
    await User.insertMany(readJSON('users.json'));
  if (await Product.countDocuments() === 0 && fs.existsSync(path.join(DATA_DIR, 'products.json'))) 
    await Product.insertMany(readJSON('products.json'));
  if (await Order.countDocuments() === 0 && fs.existsSync(path.join(DATA_DIR, 'orders.json'))) 
    await Order.insertMany(readJSON('orders.json'));
}

// Optional Cloudinary Uploads
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
const storage = process.env.CLOUDINARY_CLOUD_NAME 
  ? new CloudinaryStorage({ cloudinary, params: { folder: 'beamcraft' }})
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
    });

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
if (!process.env.CLOUDINARY_CLOUD_NAME) app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Data Wrapper (Supports both Mongo & JSON)
async function getCollection(name) {
  if (!useMongo) return readJSON(`${name}.json`);
  if (name === 'users') return await User.find({}).lean();
  if (name === 'products') return await Product.find({}).lean();
  if (name === 'orders') return await Order.find({}).lean();
  if (name === 'enquiries') return await Enquiry.find({}).lean();
}
async function saveCollection(name, data) {
  if (!useMongo) return writeJSON(`${name}.json`, data);
  // Real DBs update directly, but to mimic JSON array writes for minimum code refactor:
  // We'll wipe and rewrite OR just handle updates in routes natively. 
  // (We'll update routes natively below for DB)
}

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
};

// ─── AUTH ROUTES ────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let user;
  if (useMongo) user = await User.findOne({ email }).lean();
  else user = readJSON('users.json').find(u => u.email === email);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ id: user.id || user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id || user._id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!useMongo) {
    const users = readJSON('users.json');
    const idx = users.findIndex(u => u.id === req.user.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, users[idx].password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    users[idx].password = await bcrypt.hash(newPassword, 10);
    writeJSON('users.json', users);
  } else {
    const user = await User.findOne({$or: [{id: req.user.id}, {_id: req.user.id}]});
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
  }
  res.json({ success: true });
});

// ─── PRODUCT ROUTES ─────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  let products = await getCollection('products');
  const { category, search, featured, bestseller, newItems, minPrice, maxPrice, sort } = req.query;
  
  if (category && category !== 'all') products = products.filter(p => p.category === category || p.subcategory === category);
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => (p.name||'').toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q) || (p.tags||[]).some(t => t.toLowerCase().includes(q)));
  }
  if (featured === 'true') products = products.filter(p => p.featured);
  if (bestseller === 'true') products = products.filter(p => p.bestseller);
  if (newItems === 'true') products = products.filter(p => p.new);
  if (minPrice) products = products.filter(p => p.price >= Number(minPrice));
  if (maxPrice) products = products.filter(p => p.price <= Number(maxPrice));
  
  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
  else if (sort === 'newest') products.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0));

  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const products = await getCollection('products');
  const product = products.find(p => p.id === req.params.id || String(p._id) === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', authMiddleware, upload.array('images', 5), async (req, res) => {
  const imageUrls = req.files?.map(f => f.path || `/uploads/${f.filename}`) || [];
  const newProduct = {
    id: `p${uuidv4().split('-')[0]}`, ...req.body,
    price: Number(req.body.price), originalPrice: Number(req.body.originalPrice) || Number(req.body.price),
    quantity: Number(req.body.quantity) || 0, rating: Number(req.body.rating) || 0, reviews: Number(req.body.reviews) || 0,
    sizes: req.body.sizes ? JSON.parse(req.body.sizes) : [], colors: req.body.colors ? JSON.parse(req.body.colors) : [],
    tags: req.body.tags ? JSON.parse(req.body.tags) : [], customizable: req.body.customizable === 'true',
    inStock: req.body.inStock !== 'false', featured: req.body.featured === 'true', new: req.body.new === 'true',
    bestseller: req.body.bestseller === 'true', image: imageUrls[0] || req.body.image || '', images: imageUrls,
    createdAt: new Date().toISOString()
  };
  
  if (useMongo) await Product.create(newProduct);
  else { const p = readJSON('products.json'); p.push(newProduct); writeJSON('products.json', p); }
  res.json(newProduct);
});

app.put('/api/products/:id', authMiddleware, upload.array('images', 5), async (req, res) => {
  const imageUrls = req.files?.map(f => f.path || `/uploads/${f.filename}`) || [];
  const idToUpdate = req.params.id;

  if (useMongo) {
    const existing = await Product.findOne({$or: [{id: idToUpdate}, {_id: idToUpdate}]});
    if (!existing) return res.status(404).json({error: 'Not found'});
    
    Object.assign(existing, req.body, {
      price: Number(req.body.price) || existing.price,
      quantity: Number(req.body.quantity) ?? existing.quantity,
      sizes: req.body.sizes ? JSON.parse(req.body.sizes) : existing.sizes,
      colors: req.body.colors ? JSON.parse(req.body.colors) : existing.colors,
      tags: req.body.tags ? JSON.parse(req.body.tags) : existing.tags,
      customizable: req.body.customizable === 'true', inStock: req.body.inStock !== 'false',
      image: imageUrls[0] || req.body.image || existing.image,
      images: imageUrls.length ? imageUrls : existing.images,
      updatedAt: new Date().toISOString()
    });
    await existing.save();
    return res.json(existing);
  } else {
    const products = readJSON('products.json');
    const idx = products.findIndex(p => p.id === idToUpdate);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    Object.assign(products[idx], req.body, {
      price: Number(req.body.price) || products[idx].price,
      sizes: req.body.sizes ? JSON.parse(req.body.sizes) : products[idx].sizes,
      colors: req.body.colors ? JSON.parse(req.body.colors) : products[idx].colors,
      tags: req.body.tags ? JSON.parse(req.body.tags) : products[idx].tags,
      image: imageUrls[0] || req.body.image || products[idx].image,
      images: imageUrls.length ? imageUrls : products[idx].images,
      updatedAt: new Date().toISOString()
    });
    writeJSON('products.json', products);
    res.json(products[idx]);
  }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  if (useMongo) await Product.deleteOne({$or: [{id: req.params.id}, {_id: req.params.id}]});
  else { let p = readJSON('products.json'); writeJSON('products.json', p.filter(x => x.id !== req.params.id)); }
  res.json({ success: true });
});

app.get('/api/categories', async (req, res) => {
  const products = await getCollection('products');
  res.json([...new Set(products.map(p => p.category))]);
});

// ─── ORDER ROUTES ────────────────────────────────────────────────
app.get('/api/orders', authMiddleware, async (req, res) => {
  let orders = await getCollection('orders');
  const { status, search } = req.query;
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o => (o.orderId||'').toLowerCase().includes(q) || (o.customer?.name||'').toLowerCase().includes(q) || (o.customer?.email||'').toLowerCase().includes(q));
  }
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.get('/api/orders/:id', authMiddleware, async (req, res) => {
  const orders = await getCollection('orders');
  const order = orders.find(o => o.orderId === req.params.id || o.id === req.params.id || String(o._id) === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', async (req, res) => {
  const { customer, items, customization, paymentMethod } = req.body;
  if (!customer || !items || !items.length) return res.status(400).json({ error: 'Missing required fields' });
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const newOrder = {
    id: uuidv4(), orderId: `BC-${Date.now()}`, customer, items, customization: customization || '',
    paymentMethod: paymentMethod || 'COD', subtotal, shipping: subtotal > 1000 ? 0 : 99,
    total: subtotal + (subtotal > 1000 ? 0 : 99), status: 'pending', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    timeline: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Order placed successfully' }]
  };
  
  if (useMongo) await Order.create(newOrder);
  else { const orders = readJSON('orders.json'); orders.push(newOrder); writeJSON('orders.json', orders); }
  res.json({ success: true, orderId: newOrder.orderId, order: newOrder });
});

app.put('/api/orders/:id/status', authMiddleware, async (req, res) => {
  const { status, note } = req.body;
  if (useMongo) {
    const existing = await Order.findOne({$or: [{orderId: req.params.id}, {_id: req.params.id}, {id: req.params.id}]});
    if(!existing) return res.status(404).json({error: 'Not found'});
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
    existing.timeline = existing.timeline || [];
    existing.timeline.push({ status, timestamp: new Date().toISOString(), note: note || '' });
    await existing.save();
    return res.json(existing);
  } else {
    const orders = readJSON('orders.json');
    const idx = orders.findIndex(o => o.orderId === req.params.id || o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order not found' });
    orders[idx].status = status; orders[idx].updatedAt = new Date().toISOString();
    orders[idx].timeline = orders[idx].timeline || [];
    orders[idx].timeline.push({ status, timestamp: new Date().toISOString(), note: note || '' });
    writeJSON('orders.json', orders);
    res.json(orders[idx]);
  }
});

app.delete('/api/orders/:id', authMiddleware, async (req, res) => {
  if(useMongo) await Order.deleteOne({$or: [{orderId: req.params.id}, {_id: req.params.id}, {id: req.params.id}]});
  else { let o = readJSON('orders.json'); writeJSON('orders.json', o.filter(x => x.orderId !== req.params.id && x.id !== req.params.id)); }
  res.json({ success: true });
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────
app.get('/api/stats', authMiddleware, async (req, res) => {
  const orders = await getCollection('orders');
  const products = await getCollection('products');
  
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const revenueByDay = last7.map(date => ({
    date, revenue: orders.filter(o => o.createdAt?.startsWith(date) && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  }));
  
  res.json({
    totalRevenue, totalOrders: orders.length, pendingOrders, 
    processingOrders: orders.filter(o => o.status === 'processing').length,
    completedOrders: orders.filter(o => o.status === 'delivered').length,
    totalProducts: products.length, lowStockProducts: products.filter(p => p.quantity < 10).length,
    revenueByDay, recentOrders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  });
});

// ─── ENQUIRY ROUTE ───────────────────────────────────────────────
app.post('/api/enquiry', async (req, res) => {
  const enquiry = { id: uuidv4(), ...req.body, status: 'new', createdAt: new Date().toISOString() };
  if(useMongo) await Enquiry.create(enquiry);
  else { const enqs = readJSON('enquiries.json'); enqs.push(enquiry); writeJSON('enquiries.json', enqs); }
  res.json({ success: true, message: 'Enquiry submitted successfully!' });
});
app.get('/api/enquiries', authMiddleware, async (req, res) => res.json(await getCollection('enquiries')));

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(['/admin', '/admin/{*path}'], (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🔥 BeamCraft Server running at http://localhost:${PORT}`);
  console.log(`📦 DB Mode: ${useMongo ? 'MONGODB + CLOUDINARY' : 'LOCAL JSON (Ephemeral if Deployed)'}`);
});
