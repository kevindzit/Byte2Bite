// API endpoint
const API_BASE = 'http://127.0.0.1:5000';

// =====================
// GLOBAL CART FUNCTIONS
// =====================
function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(name, price) {
  let cart = getCart();
  let existing = cart.find(item => item.name === name);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ name, price, quantity: 1 });
  }

  saveCart(cart);
  alert(`${name} added to cart!`);
}

// =====================
// LOAD MENU FROM BACKEND
// =====================
async function loadMenu(location) {
  const container = document.getElementById("menu-container");

  //Loading message
  container.textContent = "Loading menu...";

  try {
    const response = await fetch(`${API_BASE}/api/menu/${location}`);

    if (!response.ok) {
      //Backend returned a bad response (like 404 or 500)
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const menu = await response.json();

    //If no menu items are found,
    if (!menu || menu.length === 0) {
      container.textContent = "No menu items available for this location.";
      return;
    }

    //Show message with clear loading text and display menu items
    container.innerHTML = "";
    displayMenuItems(menu);
  } catch (error) {
    console.error("Error loading menu:", error);
    container.textContent = "⚠️ Unable to load the menu. Please try again later.";
  }
}

function displayMenuItems(menu) {
  const container = document.getElementById("menu-container");

  menu.forEach(item => {
    const div = document.createElement("div");
    div.className = "menu-item";
    // Use image from API, fallback to placeholder if not available
    const imageUrl = item.image || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400';
    div.innerHTML = `
      <img src="${imageUrl}" alt="${item.name}" style="width: 100%; height: 200px; object-fit: cover;">
      <h3>${item.name}</h3>
      <p>${item.description || ''}</p>
      <p>$${parseFloat(item.price).toFixed(2)}</p>
      <button onclick="addToCart('${item.name}', ${item.price})">Add to Cart</button>
    `;
    container.appendChild(div);
  });
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

  const items = cart.map(i => `${i.name} (${i.quantity})`).join(", ");

  await fetch("http://127.0.0.1:5000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer_name: name, items })
  });

  alert("Order placed successfully!");
  localStorage.removeItem("cart");
  window.location.href = "confirmation.html";
}


// =====================
// LOCATION SELECTION
// =====================
function selectLocation(location) {
  localStorage.setItem("selectedLocation", location);
  window.location.href = "menu.html";
}

function enterZip() {
  const zip = document.getElementById("zip").value.trim();
  if (zip === "") {
    alert("Please enter a ZIP code!");
    return;
  }

  // Can later map ZIP codes to locations here if needed
  localStorage.setItem("selectedLocation", zip);
  window.location.href = "menu.html";
}
