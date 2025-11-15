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

function getStoredLocation() {
  const storedId = parseInt(localStorage.getItem("selectedLocationId"), 10);
  const label = localStorage.getItem("selectedLocationLabel") || "Default Location";
  return {
    id: Number.isInteger(storedId) ? storedId : 1,
    label
  };
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

function addToCart(id, name, price) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice)) {
    alert("Unable to add this item right now.");
    return;
  }

  let cart = getCart();
  let existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ id, name, price: numericPrice, quantity: 1 });
  }

  saveCart(cart);
  alert(`${name} added to cart!`);
}

// =====================
// LOAD MENU FROM BACKEND
// =====================
async function loadMenu(locationId = 1) {
  const container = document.getElementById("menu-container");
  if (!container) return;

  container.textContent = "Loading menu...";

  try {
    const response = await fetch(`${API_BASE}/api/menu/${locationId}`);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const menu = await response.json();
    menuItems = menu;

    if (!menu || menu.length === 0) {
      container.textContent = "No menu items available for this location.";
      return;
    }

    displayMenuItems(menu);
  } catch (error) {
    console.error("Error loading menu:", error);
    container.textContent = "⚠️ Unable to load the menu. Please try again later.";
  }
}

function displayMenuItems(menu) {
  const container = document.getElementById("menu-container");
  if (!container) return;

  container.innerHTML = "";

  menu.forEach(item => {
    const priceNumber = Number.parseFloat(item.price);
    const hasValidPrice = Number.isFinite(priceNumber);
    const priceDisplay = hasValidPrice ? `$${priceNumber.toFixed(2)}` : "Price unavailable";
    const description = item.description || "Delicious house specialty.";

    const card = document.createElement("div");
    card.className = "menu-item";

    const title = document.createElement("h3");
    title.textContent = item.name;
    card.appendChild(title);

    if (item.category) {
      const categoryTag = document.createElement("p");
      categoryTag.className = "menu-item-category";
      categoryTag.textContent = item.category;
      card.appendChild(categoryTag);
    }

    const desc = document.createElement("p");
    desc.className = "menu-item-description";
    desc.textContent = description;
    card.appendChild(desc);

    const price = document.createElement("p");
    price.className = "menu-item-price";
    price.textContent = priceDisplay;
    card.appendChild(price);

    if (hasValidPrice) {
      const button = document.createElement("button");
      button.textContent = "Add to Cart";
      button.addEventListener("click", () => addToCart(item.id, item.name, priceNumber));
      card.appendChild(button);
    } else {
      const note = document.createElement("p");
      note.className = "menu-item-note";
      note.textContent = "Unable to add to cart";
      card.appendChild(note);
    }

    container.appendChild(card);
  });
}

function initMenuPage() {
  const heading = document.getElementById("menu-heading");
  const { id: locationId, label } = getStoredLocation();

  if (heading) {
    heading.textContent = label ? `Mi Casa Menu - ${label}` : "Mi Casa Menu";
  }

  loadMenu(locationId);
}

// =====================
// CHECKOUT PAGE SUPPORT
// =====================
function loadCart() {
  const cart = getCart();
  const container = document.getElementById("cart-items");
  const totalEl = document.getElementById("total");
  container.innerHTML = "";

  let total = 0;

  cart.forEach((item, index) => {
    total += item.price * item.quantity;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <p>${item.name} - $${item.price.toFixed(2)} x ${item.quantity}</p>
      <button onclick="removeItem(${index})">Remove</button>
    `;
    container.appendChild(row);
  });

  totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

function removeItem(index) {
  let cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
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

  const missingIds = cart.some(item => typeof item.id === "undefined");
  if (missingIds) {
    alert("Please re-add your items to the cart to continue.");
    saveCart([]);
    return;
  }

  const { id: locationId, label } = getStoredLocation();
  const payload = {
    locationId,
    items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
  };

  if (name && name !== "Guest") {
    payload.customerName = name;
  }

  try {
    const response = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to place order");
    }

    const data = await response.json();

    localStorage.removeItem("cart");
    const msg = data.orderId
      ? `Order #${data.orderId} placed for ${label}.`
      : "Your order has been placed.";
    localStorage.setItem("orderMsg", msg);
    window.location.href = "confirmation.html";
  } catch (error) {
    console.error("Order error:", error);
    alert(error.message || "Unable to place your order right now.");
  }
}


// =====================
// LOCATION SELECTION
// =====================
function selectLocation(locationLabel) {
  const locationId = LOCATION_MAP[locationLabel] || 1;
  localStorage.setItem("selectedLocationLabel", locationLabel);
  localStorage.setItem("selectedLocationId", locationId);
  window.location.href = "menu.html";
}

function enterZip() {
  const zip = document.getElementById("zip").value.trim();
  if (zip === "") {
    alert("Please enter a ZIP code!");
    return;
  }

  localStorage.setItem("selectedLocationLabel", `ZIP ${zip}`);
  localStorage.setItem("selectedLocationId", 1);
  window.location.href = "menu.html";
}