const API_BASE = "http://127.0.0.1:5000";
const LOCATION_MAP = {
  Wheaton: 1,
  Elmhurst: 2,
  "Oak Brook": 3,
  "Wood Dale": 4,
  Roselle: 5,
  "Glendale Heights": 6,
  Bartlett: 7,
  "Hoffman Estates": 8,
  Westmont: 9,
  Darien: 10,
  Bolingbrook: 11,
  "Western Springs": 12
};

const ZIP_LOCATION_MAP = {
  Wheaton: ["60187", "60188", "60189"],
  Elmhurst: ["60126", "60181"],
  "Oak Brook": ["60521", "60522", "60523"],
  "Wood Dale": ["60191"],
  Roselle: ["60172"],
  "Glendale Heights": ["60139", "60137"],
  Bartlett:  ["60103", "60108", "60133"],
  "Hoffman Estates": ["60169", "60179", "60192"],
  Westmont: ["60559"],
  Darien: ["60517", "60561"],
  Bolingbrook: ["60440", "60490"],
  "Western Springs": ["60558"],
};

let menuItems = [];
let menuImageMap = null;   


// =====================
// LOAD menu_items.json
// =====================
const IMAGE_JSON_PATH = "../menu_items.json"
async function loadMenuImages() {
  if (menuImageMap) return menuImageMap;

  try {
    const res = await fetch(IMAGE_JSON_PATH);
    menuImageMap = await res.json();
    return menuImageMap;
  } catch (e) {
    console.error("Could not load menu_items.json", e);
    return null;
  }
}

function getImageForItem(itemOrName) {
  const mapItems = (menuImageMap && menuImageMap.menu_items) || {};
  const defaultImg = (menuImageMap && menuImageMap.default_image) || "Food.webp";

  if (itemOrName && typeof itemOrName === "object") {
    if (itemOrName.image) {
      return itemOrName.image;
    }
    if (itemOrName.name) {
      const match = menuItems.find(i => i.name === itemOrName.name);
      if (match && match.image) {
        return match.image;
      }
      if (mapItems[itemOrName.name]) {
        return mapItems[itemOrName.name] === "default"
          ? defaultImg
          : mapItems[itemOrName.name];
      }
      return defaultImg;
    }
  }

  if (typeof itemOrName === "string" && mapItems[itemOrName]) {
    return mapItems[itemOrName] === "default"
      ? defaultImg
      : mapItems[itemOrName];
  }

  if (typeof itemOrName === "string") {
    const match = menuItems.find(i => i.name === itemOrName);
    if (match && match.image) {
      return match.image;
    }
  }

  return defaultImg;
}

function getMaxQuantityForItem(item) {
  const val = Number(item?.availableQuantity ?? item?.stock ?? item?.maxQuantity);
  if (Number.isFinite(val)) {
    return Math.max(0, val);
  }
  return null; // null = unlimited / unknown
}


// =====================
// GLOBAL CART FUNCTIONS
// =====================
function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  badge.textContent = total;
}

function setItemQuantity(id, name, price, quantity, maxQuantity) {
  if (typeof maxQuantity === "number" && Number.isFinite(maxQuantity)) {
    quantity = Math.min(quantity, Math.max(0, maxQuantity));
  }

  let cart = getCart();
  const existing = cart.find(i => i.id === id);

  if (quantity <= 0) {
    cart = cart.filter(i => i.id !== id);
  } else if (existing) {
    existing.quantity = quantity;
    if (typeof maxQuantity === "number" && Number.isFinite(maxQuantity)) {
      existing.maxQuantity = maxQuantity;
    }
  } else {
    const itemPayload = { id, name, price, quantity };
    if (typeof maxQuantity === "number" && Number.isFinite(maxQuantity)) {
      itemPayload.maxQuantity = maxQuantity;
    }
    cart.push(itemPayload);
  }

  saveCart(cart);
  updateCartCount();
  displayMenuItems(menuItems); 
}


// =====================
// LOAD MENU
// =====================
async function loadMenu(locationId = 1) {
  const container = document.getElementById("menu-container");
  container.textContent = "Loading menu...";

  try {
    await loadMenuImages();

    const response = await fetch(`${API_BASE}/api/menu/${locationId}`);
    const menu = await response.json();

    menuItems = menu;
    displayMenuItems(menu);
  } catch (e) {
    console.error(e);
    container.textContent = "Unable to load menu.";
  }
}


// =====================
// MENU RENDERING (with quantity)
// =====================
function displayMenuItems(menu) {
  const container = document.getElementById("menu-container");
  container.innerHTML = "";

  const cart = getCart();

  menu.forEach(item => {
    const price = Number(item.price);
    const desc = item.description || "Freshly prepared.";
    const maxQty = getMaxQuantityForItem(item);
    const qtyInCart = cart.find(i => i.id === item.id)?.quantity || 0;
    const qty = maxQty === null ? qtyInCart : Math.min(qtyInCart, maxQty);
    const hasStock = maxQty === null ? true : maxQty > 0;
    const isAvailable = item.available !== false && hasStock;

    const imageSrc = getImageForItem(item);

    const addDisabled = !isAvailable || (maxQty !== null && qty >= maxQty);
    const plusDisabled = maxQty !== null && qty >= maxQty;

    const row = document.createElement("div");
    row.className = isAvailable ? "menu-row" : "menu-row menu-row-unavailable";

    row.innerHTML = `
      <img class="menu-row-image" src="${imageSrc}" alt="${item.name}" />

      <div class="menu-row-text">
        <div class="menu-row-name">${item.name}</div>
        <div class="menu-row-desc-label">Description</div>
        <div class="menu-row-desc">${desc}</div>
      </div>

      <div class="menu-row-right">
        <div class="menu-row-price">$${price.toFixed(2)}</div>

        ${isAvailable ? `
        <div class="qty-controls">
          <button class="qty-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}" data-action="minus" data-max="${maxQty ?? ''}">−</button>

          <input class="qty-input" type="text" value="${qty}" maxlength="2"
                 data-id="${item.id}" data-name="${item.name}" data-price="${price}" data-max="${maxQty ?? ''}" />

          <button class="qty-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}" data-action="plus" data-max="${maxQty ?? ''}" ${plusDisabled ? "disabled" : ""}>+</button>
        </div>

        <button class="menu-row-add-btn add-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}"
          data-max="${maxQty ?? ''}" ${addDisabled ? "disabled" : ""}
          style="display:${qty > 0 ? "none" : "block"};">
          Add
        </button>
        ${maxQty !== null ? `<div class="stock-note">In stock: ${Math.max(0, maxQty - qty)}</div>` : ""}
        ` : `
        <div class="out-of-stock-label">Out of Stock</div>
        `}
      </div>
    `;

    container.appendChild(row);
  });

  attachQuantityControls();
}


// =====================
// QUANTITY CONTROL HANDLER
// =====================
function attachQuantityControls() {
  // + / - buttons
  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      const price = Number(btn.dataset.price);
      const action = btn.dataset.action;
      const max = Number(btn.dataset.max);
      const maxQty = Number.isFinite(max) ? max : null;

      let cart = getCart();
      let existing = cart.find(i => i.id === id);
      let qty = existing ? existing.quantity : 0;

      if (action === "plus") {
        if (maxQty !== null && qty >= maxQty) return;
        qty++;
      }
      if (action === "minus") qty--;

      if (maxQty !== null && qty > maxQty) {
        qty = maxQty;
      }

      setItemQuantity(id, name, price, qty, maxQty === null ? undefined : maxQty);
    });
  });

  // Input box for typing
  document.querySelectorAll(".qty-input").forEach(input => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 2);
    });

    input.addEventListener("change", () => {
      const id = Number(input.dataset.id);
      const name = input.dataset.name;
      const price = Number(input.dataset.price);
      const max = Number(input.dataset.max);
      const maxQty = Number.isFinite(max) ? max : null;

      const qty = Number(input.value) || 0;
      const clampedQty = (maxQty !== null && qty > maxQty) ? maxQty : qty;
      setItemQuantity(id, name, price, clampedQty, maxQty === null ? undefined : maxQty);
    });
  });

  // “Add” button
  document.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      const price = Number(btn.dataset.price);
      const max = Number(btn.dataset.max);
      const maxQty = Number.isFinite(max) ? max : null;

      if (maxQty !== null && maxQty <= 0) return;
      setItemQuantity(id, name, price, 1, maxQty === null ? undefined : maxQty);
    });
  });
}


// =====================
// CHECKOUT
// =====================
async function loadCart() {
  try {
    await loadMenuImages();
  } catch (e) {
    console.warn("Could not load menu images:", e);
    // Continue anyway - don't let image loading failure break cart
  }

  const cart = getCart();
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("total");

  // Clamp any quantities that exceed known max
  let cartUpdated = false;
  cart.forEach(item => {
    const max = Number(item.maxQuantity);
    if (Number.isFinite(max) && item.quantity > max) {
      item.quantity = max;
      cartUpdated = true;
    }
  });
  if (cartUpdated) {
    saveCart(cart);
  }

  if (!container) {
    console.error("Cart container not found!");
    return;
  }

  container.innerHTML = "";
  let total = 0;

  // Check if cart is empty
  if (cart.length === 0) {
    container.innerHTML = '<div class="empty-cart-message">Your cart is empty</div>';
    // Still update totals to show $0.00
    if (typeof window.cartTotal !== 'undefined') {
      window.cartTotal = 0;
    }
    if (typeof window.updateRedemption === 'function') {
      try {
        window.updateRedemption();
      } catch (e) {
        console.error("Error updating totals for empty cart:", e);
      }
    }
    return;
  }

  cart.forEach((item, index) => {
    total += item.price * item.quantity;

    const row = document.createElement("div");
    row.className = "cart-row";

    const imageSrc = getImageForItem(item);

    const max = Number(item.maxQuantity);
    const maxQty = Number.isFinite(max) ? max : null;

    const plusDisabled = maxQty !== null && item.quantity >= maxQty;

    row.innerHTML = `
      <img class="cart-item-image" src="${imageSrc}" alt="${item.name}" />

      <div class="cart-item-left">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
      </div>

      <div class="cart-item-controls">
        <button class="qty-btn" data-index="${index}" data-action="minus" data-max="${maxQty ?? ''}">−</button>

        <input
          class="qty-input cart-qty-input"
          type="text"
          value="${item.quantity}"
          maxlength="2"
          data-index="${index}"
          data-max="${maxQty ?? ''}"
        />

        <button class="qty-btn" data-index="${index}" data-action="plus" data-max="${maxQty ?? ''}" ${plusDisabled ? "disabled" : ""}>+</button>
      </div>

      <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
    `;

    container.appendChild(row);
  });

  // Update the global cartTotal first
  if (typeof window.cartTotal !== 'undefined') {
    window.cartTotal = total;
  }

  // Then update the display using the updateRedemption function if it exists
  try {
    if (typeof window.updateRedemption === 'function') {
      window.updateRedemption();
    } else if (document.getElementById("subtotal")) {
      // Fallback for pages without updateRedemption
      const TAX_RATE = 0.0875;
      const tax = total * TAX_RATE;
      const finalTotal = total + tax;

      document.getElementById("subtotal").textContent = `$${total.toFixed(2)}`;
      document.getElementById("tax-amount").textContent = `$${tax.toFixed(2)}`;
      document.getElementById("final-total").textContent = `$${finalTotal.toFixed(2)}`;
    }

    // Show rewards if applicable
    if (typeof window.showRewardsIfApplicable === 'function') {
      window.showRewardsIfApplicable();
    }
  } catch (error) {
    console.error("Error updating cart totals:", error);
    // Still try to display basic totals as fallback
    if (document.getElementById("subtotal")) {
      document.getElementById("subtotal").textContent = `$${total.toFixed(2)}`;
    }
  }

  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;
      const max = Number(btn.dataset.max);
      const maxQty = Number.isFinite(max) ? max : null;

      let cart = getCart();
      let qty = cart[index].quantity;

      if (action === "plus") {
        if (maxQty !== null && qty >= maxQty) return;
        qty++;
      }
      if (action === "minus") qty--;

      updateCartQuantity(index, qty);
    });
  });

  document.querySelectorAll(".cart-qty-input").forEach(input => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 2);
    });

    input.addEventListener("change", () => {
      const index = Number(input.dataset.index);
      const max = Number(input.dataset.max);
      const maxQty = Number.isFinite(max) ? max : null;

      let qty = Number(input.value) || 0;
      if (maxQty !== null && qty > maxQty) {
        qty = maxQty;
        input.value = maxQty;
      }

      updateCartQuantity(index, qty);
    });
  });
}


function updateCartQuantity(index, qty) {
  let cart = getCart();
  const max = Number(cart[index]?.maxQuantity);
  const maxQty = Number.isFinite(max) ? max : null;

  if (maxQty !== null && qty > maxQty) {
    qty = maxQty;
  }

  if (qty <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = qty;
  }

  saveCart(cart);
  updateCartCount();
  loadCart();
}

function removeItem(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  updateCartCount();
  loadCart();
}


// =====================
// PLACE ORDER
// =====================
async function placeOrder() {
  const name = document.getElementById("customer-name").value || "Guest";
  const cart = getCart();
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }

  // Normalize quantities against any known maxQuantity
  let cartChanged = false;
  const normalizedCart = cart.map(item => {
    const max = Number(item.maxQuantity);
    if (Number.isFinite(max) && item.quantity > max) {
      cartChanged = true;
      return { ...item, quantity: max };
    }
    return item;
  });
  if (cartChanged) {
    saveCart(normalizedCart);
  }

  const { id: locationId, label } = getStoredLocation();
  const session = getCustomerSession();
  const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'in-store';

  // Calculate the subtotal to send to backend (tax is added on backend)
  const subtotal = normalizedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const payload = {
    locationId,
    items: normalizedCart.map(i => ({
      id: i.id,
      quantity: i.quantity
    }))
  };

  if (session) {
    payload.customerId = session.customerId;
    payload.customerName = `${session.firstName} ${session.lastName}`.trim();
    payload.customerEmail = session.email;

    // Check if rewards are applied (from checkout page)
    if (typeof window.rewardsApplied !== 'undefined' && window.rewardsApplied && typeof window.availablePoints !== 'undefined') {
      const subtotal = normalizedCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.0875; // Illinois tax rate
      const maxUsable = Math.min(window.availablePoints, Math.floor((subtotal + tax) * 100));
      payload.pointsToRedeem = maxUsable;
    }
  } else {
    payload.customerName = name;
  }

  console.log("Placing order with payload:", payload);

  try {
    if (paymentMethod === 'online' && typeof window.stripe !== 'undefined' && typeof window.cardElement !== 'undefined') {
      // Online payment with Stripe
      const res = await fetch(`${API_BASE}/api/orders/stripe-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        alert("Failed to create payment. Please try again.");
        return;
      }

      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      // Process payment with Stripe
      const { paymentIntent, error } = await window.stripe.confirmCardPayment(data.client_secret, {
        payment_method: {
          card: window.cardElement
        }
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Confirm payment on backend
        await fetch(`${API_BASE}/api/orders/${data.order_id}/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_intent_id: paymentIntent.id,
            points_redeemed: payload.pointsToRedeem || 0
          })
        });

        // Update rewards points locally
        if (session && session.customerId) {
          try {
            const profileRes = await fetch(`${API_BASE}/api/customers/${session.customerId}`);
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              session.rewardsPoints = profileData.rewardsPoints;
              saveCustomerSession(session);
            }
          } catch (e) {
            console.log("Could not update rewards points:", e);
          }
        }

        localStorage.removeItem("cart");
        localStorage.setItem("orderMsg", `Order #${data.location_order_number || data.order_id} paid and placed for ${label}.`);
        window.location.href = "confirmation.html";
      }
    } else {
      // In-store payment (existing flow)
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      console.log("Order response status:", res.status);
      console.log("Order response body:", text);

      if (!res.ok) {
        alert(`Order failed (${res.status}). Check backend log for details.`);
        return;
      }

      const data = text ? JSON.parse(text) : {};

      // Update customer's rewards points if logged in
      if (session && session.customerId) {
        try {
          const profileRes = await fetch(`${API_BASE}/api/customers/${session.customerId}`);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            session.rewardsPoints = profileData.rewardsPoints;
            saveCustomerSession(session);
          }
        } catch (e) {
          console.log("Could not update rewards points:", e);
        }
      }

      localStorage.removeItem("cart");
      const msg = (data.orderNumber || data.orderId)
        ? `Order #${data.orderNumber || data.orderId} placed for ${label}.`
        : "Your order has been placed.";
      localStorage.setItem("orderMsg", msg);

      window.location.href = "confirmation.html";
    }
  } catch (err) {
    console.error("Network/JS error placing order:", err);
    alert("Unable to place order. Is the API server running?");
  }
}


// =====================
// LOCATION
// =====================
function getStoredLocation() {
  const id = Number(localStorage.getItem("selectedLocationId")) || 1;
  let label = localStorage.getItem("selectedLocationLabel");

  if (!label) {
    for (const [name, value] of Object.entries(LOCATION_MAP)) {
      if (value === id) {
        label = name;
        break;
      }
    }
  }

  if (!label) {
    label = "Mi Casa";
  }

  return { id, label };
}
function selectLocation(label) {
  const id = LOCATION_MAP[label] || 1;
  localStorage.setItem("selectedLocationLabel", label);
  localStorage.setItem("selectedLocationId", id);
  window.location.href = "menu.html";
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function findLocationByZip(zip) {
  const normalizedZip = (zip || "").replace(/\D/g, "").slice(0, 5);
  if (!normalizedZip) return null;

  // Try exact match using ZIP_LOCATION_MAP
  for (const [location, zips] of Object.entries(ZIP_LOCATION_MAP)) {
    if (zips.includes(normalizedZip)) {
      return {location, mode: "exact" };
    }
  }

  // If we don't know this ZIP at all, bail out
  const userCoords = ZIP_COORDS[normalizedZip];
  if (!userCoords) {
    return { location: null, mode: "unknown" };
  }

  // Pick the nearest *location* using coordinates
  let bestLocation = null;
  let bestDistance = Infinity;

  for (const [location, coords] of Object.entries(LOCATION_COORDS)) {
    const dist = haversine(
      userCoords.lat,
      userCoords.lng,
      coords.lat,
      coords.lng
    );

    if (dist < bestDistance) {
      bestDistance = dist;
      bestLocation = location;
    }
  }

  return { location: bestLocation, mode: "nearest" };
}

function enterZip() {
  const zipInput = document.getElementById("zip");
  const messageEl = document.getElementById("zipMessage");

  // Clear old message
  if (messageEl) {
    messageEl.textContent = "";
    messageEl.style.color = "";
  }

  const zip = zipInput ? zipInput.value.trim() : "";

  if (!zip) {
    if (messageEl) {
      messageEl.textContent = "Enter ZIP";
      messageEl.style.color = "#b00020";
    } else {
      alert("Enter ZIP");
    }
    return;
  }

  const result = findLocationByZip(zip);
  const location = result?.location;
  const mode = result?.mode;

  if (!location) {
    if (messageEl) {
      messageEl.textContent = "No restaurants in your area yet. Please choose a location manually.";
      messageEl.style.color = "#b00020";
    } else {
      alert("No restaurants in your area yet. Please choose a location manually.");
    }
    return;
  }

  // Show a friendly message based on how we matched
  if (messageEl) {
    if (mode === "exact") {
      messageEl.textContent = `Great! We found a restaurant in ${location}.`;
      messageEl.style.color = "green";
    } else if (mode === "nearest") {
      messageEl.textContent = `We don't have a location in that exact ZIP, but your nearest restaurant is in ${location}.`;
      messageEl.style.color = "green";
    } else {
      messageEl.textContent = "";
    }
  }

  // Continue with your existing flow
  selectLocation(location);
}

// =====================
// MENU INIT
// =====================
function initMenuPage() {
  const heading = document.getElementById("menu-heading");
  const { id, label } = getStoredLocation();
  heading.textContent = `${label} Menu`;

  loadMenu(id);
  updateCartCount();
}

// =====================
// CUSTOMER ACCOUNTS
// =====================
function getCustomerSession() {
  return JSON.parse(localStorage.getItem("customerSession") || "null");
}

function saveCustomerSession(session) {
  if (session) {
    localStorage.setItem("customerSession", JSON.stringify(session));
  } else {
    localStorage.removeItem("customerSession");
  }
  renderAccountModal();
}

function openAccountModal() {
  const modal = document.getElementById("accountModal");
  if (!modal) return;
  modal.classList.add("open");
  renderAccountModal();
}

function closeAccountModal() {
  const modal = document.getElementById("accountModal");
  if (!modal) return;
  modal.classList.remove("open");
}

async function registerCustomer() {
  const firstName = (document.getElementById("modal-register-first")?.value || "").trim();
  const lastName = (document.getElementById("modal-register-last")?.value || "").trim();
  const email = (document.getElementById("modal-register-email")?.value || "").trim();
  const phoneNumber = (document.getElementById("modal-register-phone")?.value || "").trim();
  const password = document.getElementById("modal-register-password")?.value;
  const formInputs = [
    "modal-register-first",
    "modal-register-last",
    "modal-register-email",
    "modal-register-phone",
    "modal-register-password",
  ];

  const statusEl = document.getElementById("accountStatusText");

  if (!firstName || !lastName || !email || !password) {
    statusEl.textContent = "All required fields must be filled.";
    statusEl.style.color = "#ff6666";
    return;
  }

  statusEl.textContent = "Creating account...";
  statusEl.style.color = "#ffcc00";

  try {
    const res = await fetch(`${API_BASE}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password, phoneNumber })
    });
    if (!res.ok) {
      const msg = await res.text();
      statusEl.textContent = msg.includes("already exists") ? "Email already registered." : "Unable to create account.";
      statusEl.style.color = "#ff6666";
      return;
    }
    const data = await res.json();
    // After registration, fetch the full profile to get correct rewards points
    const profileRes = await fetch(`${API_BASE}/api/customers/${data.customerId}`);
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      saveCustomerSession(profileData);
    } else {
      saveCustomerSession({ customerId: data.customerId, firstName, lastName, email, phoneNumber, rewardsPoints: 500 });
    }
    formInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = "";
    });

    // Show welcome message with user's name
    const formSection = document.getElementById("accountFormSection");
    const summarySection = document.getElementById("accountSummarySection");
    const summaryName = document.getElementById("accountSummaryName");

    if (formSection && summarySection) {
      formSection.classList.add("hidden");
      summarySection.classList.remove("hidden");
      if (summaryName) {
        summaryName.textContent = `Hi ${firstName}! Your account has been created and you're now signed in.`;
      }

      // Update the welcome heading
      const welcomeHeading = summarySection.querySelector("h3");
      if (welcomeHeading) {
        welcomeHeading.textContent = `Welcome, ${firstName}!`;
      }
    }

    loadCustomerOrders();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Unable to create account. Please try again.";
    statusEl.style.color = "#ff6666";
  }
}

async function loginCustomer() {
  const email = (document.getElementById("modal-login-email")?.value || "").trim();
  const password = document.getElementById("modal-login-password")?.value;
  const statusEl = document.getElementById("accountStatusText");

  if (!email || !password) {
    statusEl.textContent = "Please enter email and password";
    statusEl.style.color = "#ff6666";
    return;
  }

  statusEl.textContent = "Signing in...";
  statusEl.style.color = "#ffcc00";

  try {
    // Try customer login first
    const res = await fetch(`${API_BASE}/api/customers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      // Customer login succeeded
      const data = await res.json();
      saveCustomerSession(data);

      // Show welcome message with user's name
      const formSection = document.getElementById("accountFormSection");
      const summarySection = document.getElementById("accountSummarySection");
      const summaryName = document.getElementById("accountSummaryName");

      if (formSection && summarySection) {
        formSection.classList.add("hidden");
        summarySection.classList.remove("hidden");
        if (summaryName) {
          summaryName.textContent = `Hi ${data.firstName || 'there'}! You're now signed in.`;
        }

        // Update the welcome heading
        const welcomeHeading = summarySection.querySelector("h3");
        if (welcomeHeading) {
          welcomeHeading.textContent = `Welcome, ${data.firstName}!`;
        }
      }

      loadCustomerOrders();
      return;
    }

    // Customer login failed - try staff login
    const staffRes = await fetch(`${API_BASE}/api/staff/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (staffRes.ok) {
      // Staff login succeeded - store session and redirect to FOH
      const staffData = await staffRes.json();
      localStorage.setItem("staffSession", JSON.stringify(staffData));
      statusEl.textContent = "Staff login successful. Redirecting...";
      statusEl.style.color = "#66ff66";

      // Redirect to Front of House
      setTimeout(() => {
        window.location.href = "../front-of-house-system/foh.html";
      }, 500);
      return;
    }

    // Both logins failed
    statusEl.textContent = "Login failed. Check email/password.";
    statusEl.style.color = "#ff6666";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Unable to login. Please try again.";
    statusEl.style.color = "#ff6666";
  }
}

async function loadCustomerOrders() {
  const session = getCustomerSession();
  const list = document.getElementById("order-history");
  if (!list) return;

  if (!session) {
    list.innerHTML = "<p>Login to see your order history.</p>";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/customers/${session.customerId}/orders`);
    const orders = await res.json();
    if (!orders.length) {
      list.innerHTML = "<p>No orders yet.</p>";
      return;
    }
    list.innerHTML = "";
    orders.forEach(order => {
      const div = document.createElement("div");
      const items = order.items.map(i => `${i.quantity}× ${i.name}`).join(", ");
      div.className = "menu-item";
      div.innerHTML = `
        <strong>Order #${order.orderNumber || order.orderId}</strong><br>
        ${order.createdAt} • ${order.status}<br>
        ${items}<br>
        Total: $${Number(order.totalPrice || 0).toFixed(2)}
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p>Unable to load history.</p>";
  }
}

function renderAccountModal() {
  const session = getCustomerSession();
  const status = document.getElementById("accountStatusText");
  const formSection = document.getElementById("accountFormSection");
  const summarySection = document.getElementById("accountSummarySection");
  const summaryName = document.getElementById("accountSummaryName");

  if (status) {
    status.textContent = session ? "" : "Sign in for faster checkout";
    status.style.color = "#ffcc00";
  }
  if (formSection && summarySection) {
    if (session) {
      formSection.classList.add("hidden");
      summarySection.classList.remove("hidden");
      if (summaryName) {
        summaryName.textContent = `${session.firstName} ${session.lastName}`.trim();
      }
    } else {
      formSection.classList.remove("hidden");
      summarySection.classList.add("hidden");
    }
  }

  const profileBtn = document.querySelector(".profile-btn");
  if (profileBtn && session) {
    profileBtn.textContent = `👤 ${session.firstName}`;
    profileBtn.onclick = () => window.location.href = 'profile.html';
  }
}

function logoutCustomer() {
  saveCustomerSession(null);
  loadCustomerOrders();
  closeAccountModal();
}

renderAccountModal();

const accountModal = document.getElementById("accountModal");
if (accountModal) {
  accountModal.addEventListener("click", (event) => {
    if (event.target === accountModal) {
      closeAccountModal();
    }
  });
}
