/* ═══════════════════════════════════════
   BEAMCRAFT – Main Frontend Script
   ═══════════════════════════════════════ */

const API = '';  // same-origin

/* ── State ── */
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('bc_cart') || '[]');
let currentFilter = 'all';
let currentCategory = 'all';
let currentSort = '';
let currentQuickFilter = 'all';
let isListView = false;
let displayCount = 8;

/* ══════════════════════════
   INIT
══════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  initPreloader();
  initParticles();
  initNavbar();
  initSearch();
  initCart();
  initScrollAnimations();
  initAnimatedCounters();
  initGallery();
  initTestimonialAutoScroll();
  await loadProducts();
  initContactForm();
  initCheckout();
  initHamburger();
  initPaymentOptions();
});

/* ── Preloader ── */
function initPreloader() {
  setTimeout(() => {
    const p = document.getElementById('preloader');
    if (p) p.classList.add('hidden');
  }, 2000);
}

/* ── Floating Particles ── */
function initParticles() {
  const container = document.getElementById('particles-container');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 15 + 10}s;
      animation-delay:${Math.random() * 10}s;
      opacity:${Math.random() * 0.5};
    `;
    container.appendChild(p);
  }
}

/* ── Navbar ── */
function initNavbar() {
  const header = document.getElementById('header');
  const links = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 50);

    // Active link on scroll
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    links.forEach(l => {
      l.classList.toggle('active', l.getAttribute('href') === `#${current}`);
    });
  });

  // Close mobile menu on link click
  document.querySelectorAll('.mob-link').forEach(l => {
    l.addEventListener('click', () => {
      document.getElementById('mobileMenu').classList.remove('open');
      document.getElementById('hamburger').classList.remove('active');
    });
  });
}

/* ── Hamburger ── */
function initHamburger() {
  const ham = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  ham?.addEventListener('click', () => {
    ham.classList.toggle('active');
    menu.classList.toggle('open');
  });
}

/* ── Search ── */
function initSearch() {
  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  document.getElementById('searchBtn')?.addEventListener('click', () => {
    overlay.classList.add('open');
    setTimeout(() => input.focus(), 100);
  });
  document.getElementById('searchClose')?.addEventListener('click', () => {
    overlay.classList.remove('open');
    input.value = '';
    results.innerHTML = '';
  });

  let debounceTimer;
  input?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      const found = allProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.tags || []).some(t => t.toLowerCase().includes(q))
      ).slice(0, 6);

      results.innerHTML = found.length
        ? found.map(p => `
          <div class="search-result-item" onclick="openProductModal('${p.id}'); document.getElementById('searchOverlay').classList.remove('open');">
            <img src="${p.image}" alt="${p.name}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);" />
            <div>
              <div style="font-weight:600;font-size:0.9rem;">${p.name}</div>
              <div style="font-size:0.75rem;color:#6060a0;">${p.category}</div>
              <div style="color:#e94560;font-weight:700;">₹${p.price}</div>
            </div>
          </div>`
        ).join('')
        : '<p style="color:#6060a0;text-align:center;padding:1rem;">No products found</p>';
    }, 300);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') overlay.classList.remove('open');
  });
}

/* ══════════════════════════
   PRODUCTS
══════════════════════════ */
async function loadProducts() {
  try {
    const res = await fetch(`${API}/api/products`);
    allProducts = await res.json();
    renderProducts();
    initProductFilters();
  } catch (err) {
    console.error('Load products error:', err);
    document.getElementById('productsGrid').innerHTML =
      '<div class="products-loading"><i class="fas fa-exclamation-circle" style="font-size:2rem;color:#e94560;"></i><p>Could not load products. Please refresh.</p></div>';
  }
}

function getFilteredProducts() {
  let products = [...allProducts];

  if (currentCategory !== 'all')
    products = products.filter(p => p.category === currentCategory || p.subcategory === currentCategory);

  if (currentQuickFilter === 'featured') products = products.filter(p => p.featured);
  else if (currentQuickFilter === 'bestseller') products = products.filter(p => p.bestseller);
  else if (currentQuickFilter === 'new') products = products.filter(p => p.new);

  if (currentSort === 'price-asc') products.sort((a, b) => a.price - b.price);
  else if (currentSort === 'price-desc') products.sort((a, b) => b.price - a.price);
  else if (currentSort === 'rating') products.sort((a, b) => b.rating - a.rating);
  else if (currentSort === 'newest') products.sort((a, b) => (b.new ? 1 : 0) - (a.new ? 1 : 0));

  return products;
}

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  const loadMoreWrapper = document.getElementById('loadMoreWrapper');
  const filtered = getFilteredProducts();
  const visible = filtered.slice(0, displayCount);

  if (!visible.length) {
    grid.innerHTML = `<div class="products-loading" style="grid-column:1/-1;">
      <i class="fas fa-search fa-2x" style="color:#e94560;"></i>
      <p>No products found in this category</p>
    </div>`;
    if (loadMoreWrapper) loadMoreWrapper.style.display = 'none';
    return;
  }

  grid.innerHTML = visible.map(p => createProductCard(p)).join('');
  grid.className = `products-grid${isListView ? ' list-view' : ''}`;

  // Load more
  if (loadMoreWrapper) {
    loadMoreWrapper.style.display = filtered.length > displayCount ? 'block' : 'none';
  }

  // Animate cards
  grid.querySelectorAll('.product-card').forEach((card, i) => {
    card.style.animationDelay = `${i * 50}ms`;
    card.style.animation = 'fadeInUp 0.5s ease both';
  });
}

function createProductCard(p) {
  const discount = p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const stars = '★'.repeat(Math.floor(p.rating)) + '☆'.repeat(5 - Math.floor(p.rating));

  const badges = [
    p.featured ? '<span class="product-badge badge-featured">Featured</span>' : '',
    p.new ? '<span class="product-badge badge-new">New</span>' : '',
    p.bestseller ? '<span class="product-badge badge-bestseller">Bestseller</span>' : '',
  ].join('');

  return `
    <div class="product-card" onclick="openProductModal('${p.id}')" id="card-${p.id}">
      <div class="product-img-wrap">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        <div class="product-badges">${badges}</div>
        <div class="product-actions-hover">
          <button class="action-btn-sm" title="Quick View" onclick="event.stopPropagation(); openProductModal('${p.id}')">
            <i class="fas fa-eye"></i>
          </button>
          <button class="action-btn-sm" title="Add to Cart" onclick="event.stopPropagation(); addToCart('${p.id}')">
            <i class="fas fa-shopping-cart"></i>
          </button>
        </div>
      </div>
      <div class="product-info">
        <div class="product-cat">${p.category}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-rating">
          <span class="stars">${stars}</span>
          <span class="rating-count">(${p.reviews})</span>
        </div>
        <div class="product-price">
          <span class="price-current">₹${p.price.toLocaleString()}</span>
          ${p.originalPrice > p.price ? `<span class="price-original">₹${p.originalPrice.toLocaleString()}</span>` : ''}
          ${discount > 0 ? `<span class="price-discount">${discount}% off</span>` : ''}
        </div>
        ${p.customizable ? '<div class="customizable-tag"><i class="fas fa-paint-brush"></i> Customizable</div>' : ''}
        <button class="product-card-btn ${!p.inStock ? 'out-of-stock' : ''}"
          onclick="event.stopPropagation(); ${p.inStock ? `addToCart('${p.id}')` : ''}"
          ${!p.inStock ? 'disabled' : ''}>
          <i class="fas fa-${p.inStock ? 'shopping-cart' : 'times-circle'}"></i>
          ${p.inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>`;
}

function initProductFilters() {
  // Category filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      displayCount = 8;
      renderProducts();
    });
  });

  // Quick filters
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentQuickFilter = btn.dataset.filter;
      displayCount = 8;
      renderProducts();
    });
  });

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', e => {
    currentSort = e.target.value;
    renderProducts();
  });

  // View toggle
  document.getElementById('gridView')?.addEventListener('click', () => {
    isListView = false;
    document.getElementById('gridView').classList.add('active');
    document.getElementById('listView').classList.remove('active');
    renderProducts();
  });
  document.getElementById('listView')?.addEventListener('click', () => {
    isListView = true;
    document.getElementById('listView').classList.add('active');
    document.getElementById('gridView').classList.remove('active');
    renderProducts();
  });

  // Load more
  document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    displayCount += 8;
    renderProducts();
  });
}

/* ── Product Modal ── */
function openProductModal(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;

  const discount = p.originalPrice > p.price
    ? Math.round((1 - p.price / p.originalPrice) * 100) : 0;
  const stars = '★'.repeat(Math.floor(p.rating)) + '☆'.repeat(5 - Math.floor(p.rating));

  document.getElementById('modalContent').innerHTML = `
    <div class="product-modal-inner">
      <div class="modal-img-container">
        <img class="modal-img" id="mainModalImg" src="${p.image}" alt="${p.name}" />
        ${p.images && p.images.length > 1 ? `
          <div class="modal-thumbnails">
            ${p.images.map((img, idx) => `<img class="modal-thumb ${idx===0 ? 'active' : ''}" src="${img}" onclick="document.getElementById('mainModalImg').src=this.src; document.querySelectorAll('.modal-thumb').forEach(t=>t.classList.remove('active')); this.classList.add('active');" />`).join('')}
          </div>
        ` : ''}
      </div>
      <div>
        <div class="modal-product-cat">${p.category} › ${p.subcategory || ''}</div>
        <h2 class="modal-product-name">${p.name}</h2>
        <div class="product-rating" style="margin-bottom:1rem;">
          <span class="stars">${stars}</span>
          <span class="rating-count">${p.rating} (${p.reviews} reviews)</span>
        </div>
        <div class="modal-price">
          ₹${p.price.toLocaleString()}
          ${p.originalPrice > p.price ? `<span style="font-size:1rem;color:#6060a0;text-decoration:line-through;margin-left:8px;">₹${p.originalPrice.toLocaleString()}</span>` : ''}
          ${discount > 0 ? `<span style="font-size:0.8rem;background:rgba(0,204,136,0.2);color:#00cc88;padding:0.2rem 0.6rem;border-radius:100px;margin-left:8px;">${discount}% off</span>` : ''}
        </div>
        <p class="modal-desc">${p.description}</p>

        ${p.sizes?.length ? `
        <div class="modal-options">
          <div class="modal-option-label">Size</div>
          <div class="option-chips" id="sizeChips">
            ${p.sizes.map((s, i) => `<span class="option-chip ${i === 0 ? 'active' : ''}" onclick="selectChip(this,'sizeChips')">${s}</span>`).join('')}
          </div>
        </div>` : ''}

        ${p.colors?.length ? `
        <div class="modal-options">
          <div class="modal-option-label">Color / Finish</div>
          <div class="option-chips" id="colorChips">
            ${p.colors.map((c, i) => `<span class="option-chip ${i === 0 ? 'active' : ''}" onclick="selectChip(this,'colorChips')">${c}</span>`).join('')}
          </div>
        </div>` : ''}

        <div class="modal-qty">
          <div class="modal-option-label" style="margin-bottom:0;">Quantity:</div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="changeModalQty(-1)">−</button>
            <span class="qty-value" id="modalQty">1</span>
            <button class="qty-btn" onclick="changeModalQty(1)">+</button>
          </div>
        </div>

        <div style="display:flex;gap:0.75rem;">
          <button class="btn-primary" style="flex:1;" onclick="addToCartFromModal('${p.id}')">
            <i class="fas fa-shopping-cart"></i> Add to Cart
          </button>
          ${p.customizable ? `<button class="btn-outline" onclick="openEnquiry('${p.name}')">
            <i class="fas fa-paint-brush"></i> Customize
          </button>` : ''}
        </div>

        <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.08);font-size:0.8rem;color:#6060a0;">
          <span><i class="fas fa-truck" style="color:#e94560;margin-right:4px;"></i>Free delivery above ₹1000</span>&nbsp;&nbsp;
          <span><i class="fas fa-undo" style="color:#e94560;margin-right:4px;"></i>7-day returns</span>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-top:0.75rem;font-size:0.8rem;color:${p.inStock ? '#00cc88' : '#e94560'};">
          <i class="fas fa-circle" style="font-size:0.5rem;"></i>
          ${p.inStock ? `In Stock (${p.quantity} units)` : 'Out of Stock'}
        </div>
      </div>
    </div>`;

  document.getElementById('productModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function selectChip(el, groupId) {
  document.querySelectorAll(`#${groupId} .option-chip`).forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function changeModalQty(delta) {
  const el = document.getElementById('modalQty');
  if (!el) return;
  const current = parseInt(el.textContent);
  el.textContent = Math.max(1, current + delta);
}

function addToCartFromModal(productId) {
  const qty = parseInt(document.getElementById('modalQty')?.textContent || '1');
  const size = document.querySelector('#sizeChips .active')?.textContent || '';
  const color = document.querySelector('#colorChips .active')?.textContent || '';
  addToCart(productId, qty, size, color);
  closeModal('productModal');
}

document.getElementById('modalClose')?.addEventListener('click', () => closeModal('productModal'));
document.getElementById('productModal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal('productModal');
});

/* ══════════════════════════
   CART
══════════════════════════ */
function initCart() {
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
  updateCartUI();
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderCartItems();
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function addToCart(productId, qty = 1, size = '', color = '') {
  const p = allProducts.find(x => x.id === productId);
  if (!p || !p.inStock) { showToast('Product is out of stock', 'error'); return; }

  const existingIdx = cart.findIndex(i => i.id === productId && i.size === size && i.color === color);
  if (existingIdx > -1) {
    cart[existingIdx].quantity += qty;
  } else {
    cart.push({
      id: p.id, name: p.name, price: p.price,
      image: p.image, category: p.category,
      size, color, quantity: qty
    });
  }
  saveCart();
  updateCartUI();
  showToast(`${p.name} added to cart!`, 'success');
  openCart();
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function updateCartQty(idx, delta) {
  cart[idx].quantity = Math.max(1, cart[idx].quantity + delta);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function saveCart() {
  localStorage.setItem('bc_cart', JSON.stringify(cart));
}

function updateCartUI() {
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  document.getElementById('cartBadge').textContent = count;
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');

  if (!cart.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <i class="fas fa-shopping-cart fa-3x"></i>
        <p>Your cart is empty</p>
        <a href="#products" class="btn-primary" onclick="closeCart()">Browse Products</a>
      </div>`;
    footer.style.display = 'none';
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 1000 ? 0 : 99;

  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" />
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${[item.size, item.color].filter(Boolean).join(' · ')}</div>
        <div class="cart-item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">−</button>
          <span class="qty-value">${item.quantity}</span>
          <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${idx})">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>`
  ).join('');

  document.getElementById('cartTotal').textContent = `₹${(subtotal + shipping).toLocaleString()}`;
  document.getElementById('shippingNote').textContent = shipping === 0
    ? '✓ Free shipping applied!' : `Add ₹${(1000 - subtotal).toLocaleString()} more for free shipping`;
  footer.style.display = 'block';
}

/* ══════════════════════════
   CHECKOUT
══════════════════════════ */
function openCheckout() {
  if (!cart.length) { showToast('Your cart is empty', 'error'); return; }
  closeCart();
  renderCheckoutSummary();
  document.getElementById('checkoutModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderCheckoutSummary() {
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = subtotal >= 1000 ? 0 : 99;
  const total = subtotal + shipping;
  const container = document.getElementById('checkoutSummary');
  container.innerHTML = `
    <h4>Order Summary (${cart.length} item${cart.length > 1 ? 's' : ''})</h4>
    ${cart.map(i => `
      <div class="summary-item">
        <span>${i.name} × ${i.quantity}</span>
        <span>₹${(i.price * i.quantity).toLocaleString()}</span>
      </div>`).join('')}
    <div class="summary-item">
      <span>Subtotal</span><span>₹${subtotal.toLocaleString()}</span>
    </div>
    <div class="summary-item">
      <span>Shipping</span><span>${shipping === 0 ? 'FREE' : `₹${shipping}`}</span>
    </div>
    <div class="summary-total">
      <span>Total</span><span>₹${total.toLocaleString()}</span>
    </div>`;
}

function initCheckout() {
  document.getElementById('checkoutClose')?.addEventListener('click', () => closeModal('checkoutModal'));
  document.getElementById('checkoutModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('checkoutModal');
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';

    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = subtotal >= 1000 ? 0 : 99;

    const orderData = {
      customer: {
        name: document.getElementById('ckName').value,
        phone: document.getElementById('ckPhone').value,
        email: document.getElementById('ckEmail').value,
        address: document.getElementById('ckAddress').value,
      },
      items: cart.map(i => ({
        id: i.id, name: i.name, price: i.price,
        quantity: i.quantity, image: i.image, size: i.size, color: i.color
      })),
      customization: document.getElementById('ckCustomization').value,
      paymentMethod: document.querySelector('input[name="payment"]:checked').value,
      subtotal, shipping, total: subtotal + shipping
    };

    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await res.json();
      if (data.success) {
        cart = [];
        saveCart();
        updateCartUI();
        closeModal('checkoutModal');
        document.getElementById('orderIdDisplay').textContent = `Order ID: ${data.orderId}`;
        document.getElementById('orderSuccessModal').classList.add('open');
      } else throw new Error(data.error || 'Order failed');
    } catch (err) {
      showToast('Failed to place order. ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Place Order';
    }
  });

  document.getElementById('orderSuccessModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAllModals();
  });
}

function initPaymentOptions() {
  document.querySelectorAll('.payment-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.payment-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });
}

/* ══════════════════════════
   CONTACT FORM
══════════════════════════ */
function initContactForm() {
  document.getElementById('enquiryForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('enquirySubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    try {
      const res = await fetch(`${API}/api/enquiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: document.getElementById('contactName').value,
          phone: document.getElementById('contactPhone').value,
          email: document.getElementById('contactEmail').value,
          subject: document.getElementById('contactSubject').value,
          message: document.getElementById('contactMessage').value,
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Enquiry sent! We\'ll contact you soon.', 'success');
        document.getElementById('enquiryForm').reset();
      }
    } catch {
      showToast('Could not send enquiry. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Enquiry';
    }
  });
}

function openEnquiry(productName) {
  closeModal('productModal');
  document.getElementById('contactSubject').value = 'Custom Order Enquiry';
  document.getElementById('contactMessage').value = `I'm interested in customizing: ${productName}\n\nMy requirements: `;
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

/* ══════════════════════════
   GALLERY
══════════════════════════ */
function initGallery() {
  const galleryGrid = document.getElementById('galleryGrid');
  if (!galleryGrid) return;

  const galleryItems = [
    { title: 'Home Name Plate', cat: 'Nameplates', img: 'images/products/img_1Ymi7Xvu4O7SmwoARfyWePOLVUh7eff31.jpg' },
    { title: 'Wall Art Decor', cat: 'Home Decor', img: 'images/products/img_17hN6BXLK68x0N82sgF9RLZGBuivOhvFc.jpg' },
    { title: 'LED Night Lamp', cat: 'Lamps', img: 'images/products/img_1of8chjYWWS3rSWz3vYjbvy2hAA_Vj4Ew.jpg' },
    { title: 'Laser Cut Gift Box', cat: 'Boxes', img: 'images/products/img_1IsD94_LB4jwKBaTGQiG--ll6Q8aK0x65.jpg' },
    { title: 'Gayatri Mantra Frame', cat: 'Mantras', img: 'images/products/img_1uHDutbw_rGF1RtuuxkPdbGKzG4hJEmPb.jpg' },
    { title: 'Fridge Magnets', cat: 'Gifts', img: 'images/products/img_1ikmmib-VWRLx1-28MKyeRPJdDyxM78lR.jpg' },
    { title: 'Wedding Decor', cat: 'Marriage', img: 'images/products/img_1oIDeJCNUolNd6_JgMFQ_vfqko7DipKVg.jpg' },
    { title: 'MDF Cutouts', cat: 'Craft', img: 'images/products/img_1pJSHGMIEuRBsAj0ooVCTdbC1pHyV3cWP.jpg' },
  ];

  galleryGrid.innerHTML = galleryItems.map(item => `
    <div class="gallery-item" data-aos="fade-up">
      <img src="${item.img}" alt="${item.title}" loading="lazy" />
      <div class="gallery-item-overlay">
        <div>
          <div class="gallery-item-title">${item.title}</div>
          <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);">${item.cat}</div>
        </div>
      </div>
    </div>`
  ).join('');

  // Re-trigger AOS for gallery items
  setTimeout(triggerAOS, 100);
}

/* ══════════════════════════
   ANIMATIONS
══════════════════════════ */
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
}

function triggerAOS() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animated');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('[data-aos]:not(.animated)').forEach(el => observer.observe(el));
}

function initAnimatedCounters() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-num[data-target]').forEach(el => observer.observe(el));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.target);
  const duration = 2000;
  const steps = 60;
  const stepVal = target / steps;
  let current = 0;
  const timer = setInterval(() => {
    current += stepVal;
    if (current >= target) { el.textContent = target.toLocaleString(); clearInterval(timer); }
    else el.textContent = Math.floor(current).toLocaleString();
  }, duration / steps);
}

function initTestimonialAutoScroll() {
  const inner = document.querySelector('.testimonials-inner');
  if (!inner) return;
  // Duplicate for seamless loop
  inner.innerHTML = inner.innerHTML + inner.innerHTML;
}

/* ══════════════════════════
   HELPERS
══════════════════════════ */
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  document.body.style.overflow = '';
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// Add search result item styles
const styleEl = document.createElement('style');
styleEl.textContent = `
  .search-result-item {
    display: flex; align-items: center; gap: 1rem;
    padding: 0.875rem; border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer; transition: all 0.2s;
  }
  .search-result-item:hover {
    border-color: rgba(233,69,96,0.4);
    background: rgba(233,69,96,0.05);
  }
  .modal-thumbnails { display: flex; gap: 8px; margin-top: 1rem; overflow-x: auto; padding-bottom: 4px; }
  .modal-thumb { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; opacity: 0.6; }
  .modal-thumb:hover { opacity: 1; }
  .modal-thumb.active { opacity: 1; border-color: var(--accent); }
  .modal-img { transition: opacity 0.3s ease; }
`;
document.head.appendChild(styleEl);
