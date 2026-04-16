const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'beamcraft-secret-2026';

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
const STORAGE_DIR = process.env.STORAGE_DIR || __dirname;
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');
const DATA_DIR = path.join(STORAGE_DIR, 'data');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(UPLOADS_DIR));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Data helpers
// DATA_DIR is already defined above
const readJSON = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
  } catch { return []; }
};
const writeJSON = (file, data) => {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
};

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── AUTH ROUTES ────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON('users.json');
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const users = readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  
  const valid = await bcrypt.compare(currentPassword, users[idx].password);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
  
  users[idx].password = await bcrypt.hash(newPassword, 10);
  writeJSON('users.json', users);
  res.json({ success: true });
});

// ─── PRODUCT ROUTES ─────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  let products = readJSON('products.json');
  const { category, search, featured, bestseller, newItems, minPrice, maxPrice, sort } = req.query;
  
  if (category && category !== 'all') {
    products = products.filter(p => p.category === category || p.subcategory === category);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some(t => t.toLowerCase().includes(q))
    );
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

app.get('/api/products/:id', (req, res) => {
  const products = readJSON('products.json');
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', authMiddleware, upload.array('images', 5), (req, res) => {
  const products = readJSON('products.json');
  const imageUrls = req.files?.map(f => `/uploads/${f.filename}`) || [];
  const newProduct = {
    id: `p${uuidv4().split('-')[0]}`,
    ...req.body,
    price: Number(req.body.price),
    originalPrice: Number(req.body.originalPrice) || Number(req.body.price),
    quantity: Number(req.body.quantity) || 0,
    rating: Number(req.body.rating) || 0,
    reviews: Number(req.body.reviews) || 0,
    sizes: req.body.sizes ? JSON.parse(req.body.sizes) : [],
    colors: req.body.colors ? JSON.parse(req.body.colors) : [],
    tags: req.body.tags ? JSON.parse(req.body.tags) : [],
    customizable: req.body.customizable === 'true',
    inStock: req.body.inStock !== 'false',
    featured: req.body.featured === 'true',
    new: req.body.new === 'true',
    bestseller: req.body.bestseller === 'true',
    image: imageUrls[0] || req.body.image || '',
    images: imageUrls,
    createdAt: new Date().toISOString()
  };
  products.push(newProduct);
  writeJSON('products.json', products);
  res.json(newProduct);
});

app.put('/api/products/:id', authMiddleware, upload.array('images', 5), (req, res) => {
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  
  const imageUrls = req.files?.map(f => `/uploads/${f.filename}`) || [];
  const updated = {
    ...products[idx],
    ...req.body,
    price: Number(req.body.price) || products[idx].price,
    originalPrice: Number(req.body.originalPrice) || products[idx].originalPrice,
    quantity: Number(req.body.quantity) ?? products[idx].quantity,
    sizes: req.body.sizes ? JSON.parse(req.body.sizes) : products[idx].sizes,
    colors: req.body.colors ? JSON.parse(req.body.colors) : products[idx].colors,
    tags: req.body.tags ? JSON.parse(req.body.tags) : products[idx].tags,
    customizable: req.body.customizable === 'true',
    inStock: req.body.inStock !== 'false',
    featured: req.body.featured === 'true',
    new: req.body.new === 'true',
    bestseller: req.body.bestseller === 'true',
    image: imageUrls[0] || req.body.image || products[idx].image,
    images: imageUrls.length ? imageUrls : products[idx].images,
    updatedAt: new Date().toISOString()
  };
  products[idx] = updated;
  writeJSON('products.json', products);
  res.json(updated);
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
  let products = readJSON('products.json');
  products = products.filter(p => p.id !== req.params.id);
  writeJSON('products.json', products);
  res.json({ success: true });
});

app.get('/api/categories', (req, res) => {
  const products = readJSON('products.json');
  const categories = [...new Set(products.map(p => p.category))];
  res.json(categories);
});

// ─── ORDER ROUTES ────────────────────────────────────────────────
app.get('/api/orders', authMiddleware, (req, res) => {
  let orders = readJSON('orders.json');
  const { status, search } = req.query;
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.orderId.toLowerCase().includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.email.toLowerCase().includes(q)
    );
  }
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const orders = readJSON('orders.json');
  const order = orders.find(o => o.orderId === req.params.id || o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/orders', (req, res) => {
  const orders = readJSON('orders.json');
  const { customer, items, customization, paymentMethod } = req.body;
  
  if (!customer || !items || !items.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = subtotal > 1000 ? 0 : 99;
  const total = subtotal + shipping;
  
  const newOrder = {
    id: uuidv4(),
    orderId: `BC-${Date.now()}`,
    customer,
    items,
    customization: customization || '',
    paymentMethod: paymentMethod || 'COD',
    subtotal,
    shipping,
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [{ status: 'pending', timestamp: new Date().toISOString(), note: 'Order placed successfully' }]
  };
  
  orders.push(newOrder);
  writeJSON('orders.json', orders);
  res.json({ success: true, orderId: newOrder.orderId, order: newOrder });
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.orderId === req.params.id || o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });
  
  const { status, note } = req.body;
  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  orders[idx].timeline = orders[idx].timeline || [];
  orders[idx].timeline.push({ status, timestamp: new Date().toISOString(), note: note || '' });
  
  writeJSON('orders.json', orders);
  res.json(orders[idx]);
});

app.delete('/api/orders/:id', authMiddleware, (req, res) => {
  let orders = readJSON('orders.json');
  orders = orders.filter(o => o.orderId !== req.params.id && o.id !== req.params.id);
  writeJSON('orders.json', orders);
  res.json({ success: true });
});

// ─── DASHBOARD STATS ─────────────────────────────────────────────
app.get('/api/stats', authMiddleware, (req, res) => {
  const orders = readJSON('orders.json');
  const products = readJSON('products.json');
  
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const processingOrders = orders.filter(o => o.status === 'processing').length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  
  // Revenue last 7 days
  const now = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const revenueByDay = last7.map(date => ({
    date,
    revenue: orders.filter(o => o.createdAt?.startsWith(date) && o.status !== 'cancelled').reduce((s, o) => s + o.total, 0)
  }));
  
  res.json({
    totalRevenue,
    totalOrders: orders.length,
    pendingOrders,
    processingOrders,
    completedOrders,
    totalProducts: products.length,
    lowStockProducts: products.filter(p => p.quantity < 10).length,
    revenueByDay,
    recentOrders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
  });
});

// ─── ENQUIRY ROUTE ───────────────────────────────────────────────
const enquiriesFile = path.join(DATA_DIR, 'enquiries.json');
app.post('/api/enquiry', (req, res) => {
  let enquiries = [];
  try { enquiries = JSON.parse(fs.readFileSync(enquiriesFile)); } catch {}
  const enquiry = { id: uuidv4(), ...req.body, status: 'new', createdAt: new Date().toISOString() };
  enquiries.push(enquiry);
  fs.writeFileSync(enquiriesFile, JSON.stringify(enquiries, null, 2));
  res.json({ success: true, message: 'Enquiry submitted successfully!' });
});

app.get('/api/enquiries', authMiddleware, (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(enquiriesFile))); } catch { res.json([]); }
});

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(['/admin', '/admin/{*path}'], (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n🔥 BeamCraft Server running at http://localhost:${PORT}`);
  console.log(`📦 Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`🔑 Default admin: admin@beamcraft.in / beamcraft@2026\n`);
});
