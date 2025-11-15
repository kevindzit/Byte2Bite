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

let menuItems = [];
let menuImageMap = null;   


// =====================
// LOAD menu_images.json
// =====================
const IMAGE_JSON_PATH = "../menu_images.json"
async function loadMenuImages() {
  if (menuImageMap) return menuImageMap;

  try {
    const res = await fetch(IMAGE_JSON_PATH);
    menuImageMap = await res.json();
    return menuImageMap;
  } catch (e) {
    console.error("Could not load menu_images.json", e);
    return null;
  }
}

function getImageForItem(name) {
  if (!menuImageMap) return "Food.webp";

  const items = menuImageMap.menu_items;
  const defaultImg = menuImageMap.default_image;

  if (items[name]) {
    return items[name] === "default" ? defaultImg : items[name];
  }
  return defaultImg;
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

function setItemQuantity(id, name, price, quantity) {
  let cart = getCart();
  const existing = cart.find(i => i.id === id);

  if (quantity <= 0) {
    cart = cart.filter(i => i.id !== id);
  } else if (existing) {
    existing.quantity = quantity;
  } else {
    cart.push({ id, name, price, quantity });
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
    const qty = cart.find(i => i.id === item.id)?.quantity || 0;

    const imageSrc = getImageForItem(item.name);

    const row = document.createElement("div");
    row.className = "menu-row";

    row.innerHTML = `
      <img class="menu-row-image" src="${imageSrc}" alt="${item.name}" />

      <div class="menu-row-text">
        <div class="menu-row-name">${item.name}</div>
        <div class="menu-row-desc-label">Description</div>
        <div class="menu-row-desc">${desc}</div>
      </div>

      <div class="menu-row-right">
        <div class="menu-row-price">$${price.toFixed(2)}</div>

        <div class="qty-controls">
          <button class="qty-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}" data-action="minus">−</button>

          <input class="qty-input" type="text" value="${qty}" maxlength="2"
                 data-id="${item.id}" data-name="${item.name}" data-price="${price}" />

          <button class="qty-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}" data-action="plus">+</button>
        </div>

        <button class="menu-row-add-btn add-btn" data-id="${item.id}" data-name="${item.name}" data-price="${price}"
          style="display:${qty > 0 ? "none" : "block"};">
          Add
        </button>
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

      let cart = getCart();
      let existing = cart.find(i => i.id === id);
      let qty = existing ? existing.quantity : 0;

      if (action === "plus") qty++;
      if (action === "minus") qty--;

      setItemQuantity(id, name, price, qty);
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

      const qty = Number(input.value) || 0;
      setItemQuantity(id, name, price, qty);
    });
  });

  // “Add” button
  document.querySelectorAll(".add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const name = btn.dataset.name;
      const price = Number(btn.dataset.price);

      setItemQuantity(id, name, price, 1);
    });
  });
}


// =====================
// CHECKOUT
// =====================
async function loadCart() {
  await loadMenuImages();

  const cart = getCart();
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("total");

  container.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    total += item.price * item.quantity;

    const row = document.createElement("div");
    row.className = "cart-row";

    const imageSrc = getImageForItem(item.name);

    row.innerHTML = `
      <img class="cart-item-image" src="${imageSrc}" alt="${item.name}" />

      <div class="cart-item-left">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
      </div>

      <div class="cart-item-controls">
        <button class="qty-btn" data-index="${index}" data-action="minus">−</button>

        <input
          class="qty-input cart-qty-input"
          type="text"
          value="${item.quantity}"
          maxlength="2"
          data-index="${index}"
        />

        <button class="qty-btn" data-index="${index}" data-action="plus">+</button>
      </div>

      <button class="remove-btn" onclick="removeItem(${index})">Remove</button>
    `;

    container.appendChild(row);
  });

  totalEl.textContent = `Total: $${total.toFixed(2)}`;

  document.querySelectorAll(".qty-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      const action = btn.dataset.action;

      let cart = getCart();
      let qty = cart[index].quantity;

      if (action === "plus") qty++;
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
      const qty = Number(input.value) || 0;
      updateCartQuantity(index, qty);
    });
  });
}


function updateCartQuantity(index, qty) {
  let cart = getCart();

  if (qty <= 0) {
    cart.splice(index, 1);
  } else {
    cart[index].quantity = qty;
  }

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
  if (cart.length === 0) return alert("Your cart is empty!");

  const { id: locationId, label } = getStoredLocation();

  const payload = {
    locationId,
    items: cart.map(i => ({ id: i.id, quantity: i.quantity })),
    customerName: name
  };

  try {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    localStorage.removeItem("cart");

    localStorage.setItem(
      "orderMsg",
      data.orderId
        ? `Order #${data.orderId} placed for ${label}.`
        : "Your order has been placed."
    );

    window.location.href = "confirmation.html";
  } catch (e) {
    alert("Unable to place order.");
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

function enterZip() {
  const zip = document.getElementById("zip").value.trim();
  if (!zip) return alert("Enter ZIP");

  localStorage.setItem("selectedLocationLabel", `ZIP ${zip}`);
  localStorage.setItem("selectedLocationId", 1);
  window.location.href = "menu.html";
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