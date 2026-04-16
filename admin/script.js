/* ═══════════════════════════════════════
   BEAMCRAFT – Admin Portal Script
   ═══════════════════════════════════════ */

const API = '/api';
let authToken = localStorage.getItem('bc_admin_token');
let adminUser = null;
let allOrders = [];
let allProducts = [];
let allEnquiries = [];
let revenueChart = null;
let statusChart = null;

/* ══════════════════════════
   INIT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  if (authToken) {
    attemptAutoLogin();
  } else {
    showLogin();
  }
  initLoginForm();
  initProductForm();
  initSettingsForm();
  initTopbarSearch();
});

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminApp').style.display = 'none';
}

function showAdmin() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminApp').style.display = 'flex';
  initDashboard();
}

async function attemptAutoLogin() {
  try {
    const res = await fetch(`${API}/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (res.ok) {
      adminUser = JSON.parse(localStorage.getItem('bc_admin_user') || '{}');
      updateAdminUI();
      showAdmin();
    } else {
      authToken = null;
      localStorage.removeItem('bc_admin_token');
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function updateAdminUI() {
  if (adminUser) {
    const name = adminUser.name || 'Admin';
    document.getElementById('adminName').textContent = name;
    document.getElementById('adminAvatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('settingsEmail').textContent = adminUser.email || '';
  }
}

/* ── Login Form ── */
function initLoginForm() {
  document.getElementById('loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errEl = document.getElementById('loginError');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    errEl.style.display = 'none';

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        authToken = data.token;
        adminUser = data.user;
        localStorage.setItem('bc_admin_token', authToken);
        localStorage.setItem('bc_admin_user', JSON.stringify(adminUser));
        updateAdminUI();
        showAdmin();
      } else {
        errEl.textContent = data.error || 'Invalid email or password';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Connection error. Is the server running?';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Admin';
    }
  });
}

function logout() {
  authToken = null;
  adminUser = null;
  localStorage.removeItem('bc_admin_token');
  localStorage.removeItem('bc_admin_user');
  showLogin();
}

/* ══════════════════════════
   NAVIGATION
══════════════════════════ */
const pageMeta = {
  dashboard: { title: 'Dashboard', subtitle: 'Welcome back! Here\'s your overview.' },
  orders: { title: 'Orders', subtitle: 'Manage and track all customer orders.' },
  products: { title: 'Products', subtitle: 'Manage your product catalog.' },
  enquiries: { title: 'Enquiries', subtitle: 'View and respond to customer enquiries.' },
  settings: { title: 'Settings', subtitle: 'Configure your admin account.' },
};

function showPage(pageId, linkEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  if (linkEl) linkEl.classList.add('active');

  const meta = pageMeta[pageId] || {};
  document.getElementById('pageTitle').textContent = meta.title || '';
  document.getElementById('pageSubtitle').textContent = meta.subtitle || '';

  // Topbar action
  const btn = document.getElementById('topbarActionBtn');
  if (pageId === 'products') {
    btn.style.display = 'flex';
    btn.innerHTML = '<i class="fas fa-plus"></i> Add Product';
    btn.onclick = openAddProductModal;
  } else if (pageId === 'orders') {
    btn.style.display = 'flex';
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    btn.onclick = loadOrders;
  } else {
    btn.style.display = 'none';
  }

  // Load page data
  if (pageId === 'orders') loadOrders();
  if (pageId === 'products') loadProducts();
  if (pageId === 'enquiries') loadEnquiries();

  return false;
}

/* ── Sidebar topbar search ── */
function initTopbarSearch() {
  document.getElementById('topbarSearch')?.addEventListener('input', e => {
    const activePageId = document.querySelector('.sidebar-link.active')?.dataset?.page;
    const q = e.target.value.toLowerCase();
    if (activePageId === 'products') filterProducts(q);
    if (activePageId === 'orders') filterOrders(q);
  });
}

/* ══════════════════════════
   DASHBOARD
══════════════════════════ */
async function initDashboard() {
  await loadStats();
  loadProducts();
  loadOrders();
  loadEnquiries();
}

async function loadStats() {
  try {
    const res = await authFetch(`${API}/stats`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById('statRevenue').textContent = `₹${(data.totalRevenue || 0).toLocaleString()}`;
    document.getElementById('statOrders').textContent = data.totalOrders || 0;
    document.getElementById('statPending').textContent = data.pendingOrders || 0;
    document.getElementById('statProducts').textContent = data.totalProducts || 0;
    document.getElementById('pendingBadge').textContent = data.pendingOrders || 0;

    drawRevenueChart(data.revenueByDay || []);
    drawStatusChart(data);
    renderRecentOrders(data.recentOrders || []);
  } catch (err) {
    console.error('Stats error:', err);
  }
}

function drawRevenueChart(revenueByDay) {
  const ctx = document.getElementById('revenueChart')?.getContext('2d');
  if (!ctx) return;
  if (revenueChart) revenueChart.destroy();

  const labels = revenueByDay.map(d => {
    const dt = new Date(d.date);
    return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  });
  const data = revenueByDay.map(d => d.revenue);

  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (₹)',
        data,
        borderColor: '#e94560',
        backgroundColor: 'rgba(233,69,96,0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#e94560',
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0c0', font: { family: 'Outfit' } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0c0', font: { family: 'Outfit' }, callback: v => `₹${v}` } }
      }
    }
  });
}

function drawStatusChart(data) {
  const ctx = document.getElementById('statusChart')?.getContext('2d');
  if (!ctx) return;
  if (statusChart) statusChart.destroy();

  const total = data.totalOrders || 1;
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'Processing', 'Delivered', 'Cancelled'],
      datasets: [{
        data: [
          data.pendingOrders || 0,
          data.processingOrders || 0,
          data.completedOrders || 0,
          (data.totalOrders || 0) - (data.pendingOrders || 0) - (data.processingOrders || 0) - (data.completedOrders || 0)
        ],
        backgroundColor: ['#f5c842', '#4592ff', '#00cc88', '#e94560'],
        borderWidth: 0, hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#a0a0c0', font: { family: 'Outfit' }, padding: 12, usePointStyle: true } }
      },
      cutout: '65%',
    }
  });
}

function renderRecentOrders(orders) {
  const tbody = document.getElementById('recentOrdersBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#6060a0;padding:2rem;">No orders yet</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr onclick="openOrderModal('${o.orderId}')" style="cursor:pointer;">
      <td><strong style="color:#e94560;">${o.orderId}</strong></td>
      <td><div style="font-weight:600;">${o.customer?.name || '-'}</div><div style="font-size:0.75rem;color:#6060a0;">${o.customer?.phone || ''}</div></td>
      <td>${o.items?.length || 0} item(s)</td>
      <td><strong>₹${(o.total || 0).toLocaleString()}</strong></td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
    </tr>`
  ).join('');
}

/* ══════════════════════════
   ORDERS
══════════════════════════ */
async function loadOrders() {
  try {
    const res = await authFetch(`${API}/orders`);
    allOrders = await res.json();
    renderOrdersTable(allOrders);
    document.getElementById('pendingBadge').textContent = allOrders.filter(o => o.status === 'pending').length;
  } catch (err) {
    console.error('Load orders error:', err);
  }
}

function filterOrders() {
  const q = document.getElementById('orderSearch')?.value.toLowerCase() || '';
  const status = document.getElementById('orderStatusFilter')?.value || 'all';
  let filtered = allOrders;
  if (status !== 'all') filtered = filtered.filter(o => o.status === status);
  if (q) filtered = filtered.filter(o =>
    o.orderId?.toLowerCase().includes(q) ||
    o.customer?.name?.toLowerCase().includes(q) ||
    o.customer?.email?.toLowerCase().includes(q) ||
    o.customer?.phone?.includes(q)
  );
  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><i class="fas fa-inbox"></i><p>No orders found</p></td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong style="color:#e94560;">${o.orderId}</strong></td>
      <td>
        <div style="font-weight:600;">${o.customer?.name || '-'}</div>
        <div style="font-size:0.75rem;color:#6060a0;">${o.customer?.email || ''}</div>
      </td>
      <td>${o.customer?.phone || '-'}</td>
      <td>${o.items?.length || 0} item(s)</td>
      <td><strong>₹${(o.total || 0).toLocaleString()}</strong></td>
      <td><span style="font-size:0.8rem;">${o.paymentMethod || 'COD'}</span></td>
      <td><span class="status-badge status-${o.status}">${o.status}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn view" title="View Details" onclick="openOrderModal('${o.orderId}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn delete" title="Delete Order" onclick="deleteOrder('${o.orderId}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`
  ).join('');
}

async function openOrderModal(orderId) {
  const order = allOrders.find(o => o.orderId === orderId);
  if (!order) return;

  document.getElementById('orderModalTitle').textContent = `Order: ${order.orderId}`;
  document.getElementById('orderModalContent').innerHTML = `
    <div class="order-detail-grid">
      <div>
        <div class="order-section">
          <h4>Customer Info</h4>
          <div class="order-info-row"><span>Name</span><span>${order.customer?.name || '-'}</span></div>
          <div class="order-info-row"><span>Phone</span><span>${order.customer?.phone || '-'}</span></div>
          <div class="order-info-row"><span>Email</span><span>${order.customer?.email || '-'}</span></div>
          <div class="order-info-row"><span>Address</span><span style="text-align:right;max-width:200px;">${order.customer?.address || '-'}</span></div>
        </div>
        <div class="order-section" style="margin-top:1rem;">
          <h4>Payment & Shipping</h4>
          <div class="order-info-row"><span>Payment</span><span>${order.paymentMethod || 'COD'}</span></div>
          <div class="order-info-row"><span>Subtotal</span><span>₹${(order.subtotal || 0).toLocaleString()}</span></div>
          <div class="order-info-row"><span>Shipping</span><span>${order.shipping === 0 ? 'FREE' : `₹${order.shipping}`}</span></div>
          <div class="order-info-row"><span>Total</span><span style="color:#e94560;font-size:1.1rem;"><strong>₹${(order.total || 0).toLocaleString()}</strong></span></div>
          ${order.customization ? `<div class="order-info-row"><span>Customization</span><span style="text-align:right;">${order.customization}</span></div>` : ''}
        </div>
      </div>
      <div>
        <div class="order-section">
          <h4>Order Items</h4>
          <div class="order-items-list">
            ${(order.items || []).map(item => `
              <div class="order-item-row">
                <img class="order-item-img" src="${item.image || 'https://placehold.co/50x50/141428/e94560?text=P'}" alt="${item.name}" />
                <div>
                  <div class="order-item-name">${item.name}</div>
                  <div class="order-item-meta">${[item.size, item.color].filter(Boolean).join(' · ')} · Qty: ${item.quantity}</div>
                </div>
                <div class="order-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
              </div>`
            ).join('')}
          </div>
        </div>
        <div class="order-section" style="margin-top:1rem;">
          <h4>Update Status</h4>
          <div class="status-update-row">
            <select id="newOrderStatus">
              ${['pending','processing','shipped','delivered','cancelled'].map(s =>
                `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
              ).join('')}
            </select>
            <input type="text" id="statusNote" placeholder="Note (optional)" style="flex:1;padding:0.6rem 0.875rem;border-radius:8px;background:var(--bg-primary);border:1px solid var(--border);color:var(--text-primary);font-family:var(--font);font-size:0.85rem;outline:none;" />
            <button class="btn-primary-admin" onclick="updateOrderStatus('${order.orderId}')">Update</button>
          </div>
          <div class="order-timeline" style="margin-top:1rem;">
            ${(order.timeline || []).reverse().map(t => `
              <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-info">
                  <div class="tl-status">${t.status}</div>
                  ${t.note ? `<div style="font-size:0.75rem;color:#a0a0c0;">${t.note}</div>` : ''}
                  <div class="tl-time">${formatDate(t.timestamp)}</div>
                </div>
              </div>`
            ).join('')}
          </div>
        </div>
      </div>
    </div>`;
  
  document.getElementById('orderModal').classList.add('open');
}

async function updateOrderStatus(orderId) {
  const status = document.getElementById('newOrderStatus').value;
  const note = document.getElementById('statusNote').value;
  try {
    const res = await authFetch(`${API}/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, note })
    });
    if (res.ok) {
      showToast('Order status updated!', 'success');
      await loadOrders();
      await loadStats();
      closeModal('orderModal');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

async function deleteOrder(orderId) {
  if (!confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
  try {
    const res = await authFetch(`${API}/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Order deleted', 'success');
      await loadOrders();
      await loadStats();
    }
  } catch { showToast('Error deleting order', 'error'); }
}

/* ══════════════════════════
   PRODUCTS
══════════════════════════ */
async function loadProducts() {
  try {
    const res = await authFetch(`${API}/products`);
    allProducts = await res.json();
    renderProductsTable(allProducts);
    populateCategoryFilter();
  } catch (err) {
    console.error('Load products error:', err);
  }
}

function populateCategoryFilter() {
  const select = document.getElementById('productCatFilter');
  if (!select) return;
  const cats = [...new Set(allProducts.map(p => p.category))];
  select.innerHTML = '<option value="all">All Categories</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
}

function filterProducts(q = null) {
  const search = q ?? document.getElementById('productSearch')?.value.toLowerCase() ?? '';
  const cat = document.getElementById('productCatFilter')?.value || 'all';
  let filtered = allProducts;
  if (cat !== 'all') filtered = filtered.filter(p => p.category === cat);
  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.category.toLowerCase().includes(search) ||
    (p.tags || []).some(t => t.toLowerCase().includes(search))
  );
  renderProductsTable(filtered);
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="fas fa-box-open"></i><p>No products found</p></td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <img class="product-table-img" src="${p.image || 'https://placehold.co/46x46/141428/e94560?text=P'}" alt="${p.name}" />
      </td>
      <td>
        <div class="product-table-name">${p.name}</div>
        <div class="product-table-cat">${p.material || p.subcategory || ''}</div>
      </td>
      <td><span style="font-size:0.8rem;">${p.category}</span></td>
      <td>
        <div style="font-weight:700;color:#e94560;">₹${(p.price || 0).toLocaleString()}</div>
        ${p.originalPrice > p.price ? `<div style="font-size:0.75rem;color:#6060a0;text-decoration:line-through;">₹${p.originalPrice.toLocaleString()}</div>` : ''}
      </td>
      <td>${p.quantity ?? 'N/A'}</td>
      <td>
        <span class="status-badge ${p.inStock ? 'status-instock' : 'status-outofstock'}">
          ${p.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </td>
      <td>
        ${p.featured ? '<span class="status-badge" style="background:rgba(245,200,66,0.15);color:#f5c842;">⭐ Featured</span>' : '-'}
        ${p.bestseller ? '<span class="status-badge status-delivered" style="margin-left:4px;">🔥 Best</span>' : ''}
        ${p.new ? '<span class="status-badge status-new" style="margin-left:4px;">New</span>' : ''}
      </td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" title="Edit" onclick="openEditProductModal('${p.id}')">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete" title="Delete" onclick="deleteProduct('${p.id}')">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>`
  ).join('');
}

function openAddProductModal() {
  document.getElementById('productModalTitle').textContent = 'Add New Product';
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('uploadPreview').innerHTML = '';
  document.getElementById('productModal').classList.add('open');
}

function openEditProductModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  document.getElementById('productModalTitle').textContent = 'Edit Product';
  document.getElementById('productId').value = p.id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pSubcategory').value = p.subcategory || '';
  document.getElementById('pMaterial').value = p.material || '';
  document.getElementById('pDescription').value = p.description || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pOriginalPrice').value = p.originalPrice || '';
  document.getElementById('pQuantity').value = p.quantity || '';
  document.getElementById('pSizes').value = (p.sizes || []).join(', ');
  document.getElementById('pColors').value = (p.colors || []).join(', ');
  document.getElementById('pTags').value = (p.tags || []).join(', ');
  document.getElementById('pImageUrl').value = p.image || '';
  document.getElementById('pInStock').checked = p.inStock !== false;
  document.getElementById('pCustomizable').checked = p.customizable === true;
  document.getElementById('pFeatured').checked = p.featured === true;
  document.getElementById('pNew').checked = p.new === true;
  document.getElementById('pBestseller').checked = p.bestseller === true;
  document.getElementById('uploadPreview').innerHTML = p.image
    ? `<img src="${p.image}" style="width:70px;height:70px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);" />` : '';
  document.getElementById('productModal').classList.add('open');
}

function initProductForm() {
  document.getElementById('productForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('productSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const id = document.getElementById('productId').value;
    const parseCsv = v => v.split(',').map(s => s.trim()).filter(Boolean);
    const formData = new FormData();

    const fields = {
      name: document.getElementById('pName').value,
      category: document.getElementById('pCategory').value,
      subcategory: document.getElementById('pSubcategory').value,
      material: document.getElementById('pMaterial').value,
      description: document.getElementById('pDescription').value,
      price: document.getElementById('pPrice').value,
      originalPrice: document.getElementById('pOriginalPrice').value,
      quantity: document.getElementById('pQuantity').value,
      sizes: JSON.stringify(parseCsv(document.getElementById('pSizes').value)),
      colors: JSON.stringify(parseCsv(document.getElementById('pColors').value)),
      tags: JSON.stringify(parseCsv(document.getElementById('pTags').value)),
      image: document.getElementById('pImageUrl').value,
      inStock: document.getElementById('pInStock').checked ? 'true' : 'false',
      customizable: document.getElementById('pCustomizable').checked ? 'true' : 'false',
      featured: document.getElementById('pFeatured').checked ? 'true' : 'false',
      new: document.getElementById('pNew').checked ? 'true' : 'false',
      bestseller: document.getElementById('pBestseller').checked ? 'true' : 'false',
    };

    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));

    const files = document.getElementById('pImages').files;
    Array.from(files).forEach(f => formData.append('images', f));

    try {
      const url = id ? `${API}/products/${id}` : `${API}/products`;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Product ${id ? 'updated' : 'added'} successfully!`, 'success');
        closeModal('productModal');
        await loadProducts();
        await loadStats();
      } else {
        showToast(data.error || 'Failed to save product', 'error');
      }
    } catch (err) {
      showToast('Error saving product', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Save Product';
    }
  });
}

async function deleteProduct(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!confirm(`Delete "${p?.name}"? This cannot be undone.`)) return;
  try {
    const res = await authFetch(`${API}/products/${productId}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Product deleted!', 'success');
      await loadProducts();
      await loadStats();
    }
  } catch { showToast('Error deleting product', 'error'); }
}

function previewImages(input) {
  const preview = document.getElementById('uploadPreview');
  preview.innerHTML = '';
  Array.from(input.files).slice(0, 5).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img');
      img.src = e.target.result;
      img.style.cssText = 'width:70px;height:70px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);';
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════
   ENQUIRIES
══════════════════════════ */
async function loadEnquiries() {
  try {
    const res = await authFetch(`${API}/enquiries`);
    allEnquiries = await res.json();
    renderEnquiriesTable(allEnquiries);
    document.getElementById('enquiryBadge').textContent = allEnquiries.filter(e => e.status === 'new').length;
  } catch (err) {
    console.error('Load enquiries error:', err);
  }
}

function renderEnquiriesTable(enquiries) {
  const tbody = document.getElementById('enquiriesTableBody');
  if (!enquiries.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="fas fa-inbox"></i><p>No enquiries yet</p></td></tr>';
    return;
  }
  tbody.innerHTML = enquiries.slice().reverse().map(e => `
    <tr>
      <td style="font-weight:600;">${e.name}</td>
      <td>${e.phone || '-'}</td>
      <td>${e.email || '-'}</td>
      <td>${e.subject || '-'}</td>
      <td style="max-width:250px;white-space:pre-wrap;font-size:0.8rem;color:#a0a0c0;">${(e.message || '').substring(0, 100)}${e.message?.length > 100 ? '...' : ''}</td>
      <td>${formatDate(e.createdAt)}</td>
      <td><span class="status-badge ${e.status === 'new' ? 'status-new' : 'status-read'}">${e.status || 'new'}</span></td>
    </tr>`
  ).join('');
}

/* ══════════════════════════
   SETTINGS
══════════════════════════ */
function initSettingsForm() {
  document.getElementById('changePasswordForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (newPw !== confirm) { showToast('Passwords do not match', 'error'); return; }
    try {
      const res = await authFetch(`${API}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: newPw })
      });
      if (res.ok) showToast('Password updated successfully!', 'success');
      else {
        const d = await res.json();
        showToast(d.error || 'Failed to update password', 'error');
      }
    } catch { showToast('Error updating password', 'error'); }
    document.getElementById('changePasswordForm').reset();
  });
}

/* ══════════════════════════
   HELPERS
══════════════════════════ */
async function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const icon = type === 'success' ? '✓' : '✕';
  toast.innerHTML = `<span style="color:${type === 'success' ? '#00cc88' : '#e94560'};font-weight:800;">${icon}</span> ${msg}`;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}
