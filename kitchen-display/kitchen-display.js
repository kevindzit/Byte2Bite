let orders = [];
    let currentIndex = 0;
    let lastAction = null;
    let selectedLocation = localStorage.getItem('kitchenDisplayLocation') || '1';

    // Toast notification
    function showToast(message, duration = 2000) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), duration);
    }

    // Load list of restaurants/locations
    async function loadRestaurants() {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/restaurants');
        const restaurants = await response.json();

        const select = document.getElementById('locationSelect');
        select.innerHTML = restaurants.map(r => {
          const locationName = r.name.replace('Mi Casa ', '');
          return `<option value="${r.id}" ${r.id == selectedLocation ? 'selected' : ''}>${locationName}</option>`;
        }).join('');
      } catch (error) {
        console.error('Error loading restaurants:', error);
        document.getElementById('locationSelect').innerHTML =
          '<option value="1">Restaurant</option>';
      }
    }

    // Handle location change
    function changeLocation() {
      const select = document.getElementById('locationSelect');
      selectedLocation = select.value || '1';
      localStorage.setItem('kitchenDisplayLocation', selectedLocation);
      loadOrders();
    }

    async function loadOrders() {
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/orders?restaurant_id=${selectedLocation}`);
        if (!res.ok) throw new Error("Failed to fetch orders");
        orders = await res.json();
        console.log("Orders received from server:", orders);
        showOrder();
      } catch (err) {
        document.getElementById("order-container").innerHTML =
          "<p style='color:red;'>Error loading orders</p>";
        console.error(err);
      }
    }

    function showOrder() {
      const container = document.getElementById("order-container");
      if (!container) return;

      container.innerHTML = "";
      container.classList.remove("empty");

      if (!orders || orders.length === 0) {
        container.classList.add("empty");
        container.innerHTML = "<p>No active orders</p>";
        const wrapper = document.querySelector(".active-orders-view");
        if (wrapper) wrapper.scrollLeft = 0;
        return;
      }

      if (currentIndex >= orders.length) currentIndex = Math.max(orders.length - 1, 0);

      orders.forEach((order, index) => {
        let borderColor = "orange";
        if (order.status.toLowerCase() === "preparing") borderColor = "yellow";
        else if (order.status.toLowerCase() === "completed") borderColor = "limegreen";

        const div = document.createElement("div");
        div.className = "order-card";
        if (index === currentIndex) div.classList.add("selected");
        div.style.borderLeft = `10px solid ${borderColor}`;
        const customerName = getCustomerName(order);

        div.innerHTML = `
          <h3>
            <span>Order #${order.orderNumber || order.id}</span>
            <span>Status: ${order.status}</span>
          </h3>
          <p><strong>Customer:</strong> ${customerName}</p>
          <ul>${order.items.split(",").map(i => `<li>${i.trim()}</li>`).join("")}</ul>
        `;

        div.addEventListener("click", () => {
          currentIndex = index;
          showOrder();
        });

        container.appendChild(div);
      });

      ensureSelectedVisible();
    }


    function nextOrder() {
      if (orders.length === 0) return;
      currentIndex = (currentIndex + 1) % orders.length;
      showOrder();
    }

    function prevOrder() {
      if (orders.length === 0) return;
      currentIndex = (currentIndex - 1 + orders.length) % orders.length;
      showOrder();
    }

    async function updateStatus(status) {
      if (orders.length === 0) return;
      const currentOrder = orders[currentIndex];
      const id = currentOrder.id;
      const previousStatus = currentOrder.status;
      const previousIndex = currentIndex;
      const removedOrderSnapshot = { ...currentOrder };

      // Prevent completing an order that isn't in Preparing status
      if (status === "Completed" && previousStatus.toLowerCase() !== "preparing") {
        showToast("Mark as Preparing first");
        return;
      }

      try {
        const res = await fetch(`http://127.0.0.1:5000/api/orders/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        });

        if (!res.ok) throw new Error("Failed to update order status");
        console.log(`Order ${id} updated to ${status}`);

        if (status === "Completed") {
          removedOrderSnapshot.status = previousStatus;
          orders.splice(currentIndex, 1);
          if (currentIndex >= orders.length) currentIndex = 0;
          lastAction = {
            orderId: id,
            previousStatus,
            previousIndex,
            removedOrder: removedOrderSnapshot
          };
        } else {
          orders[currentIndex].status = status;
          lastAction = {
            orderId: id,
            previousStatus,
            previousIndex,
            removedOrder: null
          };
        }

        showOrder();
      } catch (err) {
        console.error(err);
        showToast("Error updating order");
      }
    }

    function ensureSelectedVisible() {
      const wrapper = document.querySelector(".active-orders-view");
      const selectedCard = document.querySelector(".order-card.selected");
      if (!wrapper || !selectedCard) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const cardRect = selectedCard.getBoundingClientRect();
      const padding = 20;

      if (cardRect.left < wrapperRect.left + padding) {
        wrapper.scrollBy({
          left: cardRect.left - wrapperRect.left - padding,
          behavior: "smooth"
        });
      } else if (cardRect.right > wrapperRect.right - padding) {
        wrapper.scrollBy({
          left: cardRect.right - wrapperRect.right + padding,
          behavior: "smooth"
        });
      }
    }

async function undoLastAction() {
  if (!lastAction) {
    showToast("Nothing to undo");
    return;
  }

  const { orderId, previousStatus, previousIndex, removedOrder } = lastAction;

  // Always revert the status to "Pending"
  const forcedStatus = "Pending";

  try {
    // Send status update to backend (always set to Pending)
    const res = await fetch(`http://127.0.0.1:5000/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: forcedStatus })
    });

    if (!res.ok) throw new Error("Failed to undo last action");

    // If order was removed (completed), put it back where it was
    if (removedOrder) {
      const restoredOrder = { ...removedOrder, status: forcedStatus };
      orders.splice(previousIndex, 0, restoredOrder);
    } 
    else {
      // Otherwise just update the status in the existing list
      const target = orders.find(o => o.id === orderId);
      if (target) target.status = forcedStatus;
    }

    // Return to original position
    currentIndex = orders.length
      ? Math.min(previousIndex, orders.length - 1)
      : 0;

    lastAction = null;
    showOrder();
  } catch (err) {
    console.error(err);
    showToast("Unable to undo");
  }
}


    function getCustomerName(order) {
      const direct = order.customer_name || order.customerName || order.customer;
      if (direct && direct !== "Guest") return direct;

      if (order.customer && typeof order.customer === "object") {
        const first = order.customer.firstName || order.customer.FirstName || "";
        const last = order.customer.lastName || order.customer.LastName || "";
        const full = `${first} ${last}`.trim();
        if (full) return full;
      }

      return "Guest";
    }

    // Auto-refresh every 1 seconds
    setInterval(loadOrders, 1000);
    loadRestaurants();
    loadOrders();