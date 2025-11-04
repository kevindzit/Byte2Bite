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
  const response = await fetch(`http://127.0.0.1:5000/api/menu/${location}`);
  const menu = await response.json();
  const container = document.getElementById("menu-container");
  container.innerHTML = "";

  menu.forEach(item => {
    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p>$${item.price.toFixed(2)}</p>
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
