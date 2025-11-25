const API_BASE = "http://127.0.0.1:5000";
    const staffSession = JSON.parse(localStorage.getItem("staffSession") || "null");

    function initDashboard() {
      const lock = document.getElementById("admin-lock");
      const dash = document.getElementById("admin-dashboard");

      // Enhanced security: Verify admin role strictly
      if (!staffSession || !staffSession.role || staffSession.role.toLowerCase() !== "admin") {
        lock.style.display = "block";
        dash.style.display = "none";

        // If they're a regular staff member, redirect them back to front-of-house
        if (staffSession && staffSession.role && staffSession.role.toLowerCase() === "staff") {
          const redirectMsg = document.createElement("p");
          redirectMsg.textContent = "Staff members cannot access the admin dashboard. Redirecting to Front of House...";
          redirectMsg.style.color = "#ff6666";
          lock.appendChild(redirectMsg);

          setTimeout(() => {
            window.location.href = "foh.html";
          }, 2000);
        }
        return;
      }

      // Admin access granted
      lock.style.display = "none";
      dash.style.display = "block";
      setupInventoryAddForm();
      bindStaffForm();
      loadBranches();
      loadStaffList();
      setupStaffLocationFilter();
    }

    function getSelectedBranchId() {
      const select = document.getElementById("branch-select");
      return parseInt(select.value, 10);
    }

    async function loadBranches() {
      const select = document.getElementById("branch-select");
      const statusEl = document.getElementById("branch-status");
      select.innerHTML = "<option>Loading...</option>";
      statusEl.textContent = "";

      try {
        const res = await fetch(`${API_BASE}/api/restaurants`);
        if (!res.ok) throw new Error("Failed to load restaurants");
        const data = await res.json();

        select.innerHTML = "";
        if (!Array.isArray(data) || !data.length) {
          select.innerHTML = "<option>No restaurants found</option>";
          statusEl.textContent = "No restaurants configured.";
          return;
        }

        data.forEach(r => {
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = `${r.name} – ${r.address}`;
          select.appendChild(opt);
        });

        select.addEventListener("change", onBranchChange);

        select.value = data[0].id;
        statusEl.textContent = `Showing data for: ${data[0].name}`;
        onBranchChange();
      } catch (err) {
        console.error(err);
        select.innerHTML = "<option>Error loading restaurants</option>";
        statusEl.textContent = "Error loading restaurants.";
      }
    }

    // Inventory 
    async function loadInventory() {
      const branchId = getSelectedBranchId();
      const container = document.getElementById("inventory-container");
      const statusEl = document.getElementById("inventory-changes-status");
      container.textContent = "Loading inventory...";
      statusEl.textContent = "";

      try {
        const res = await fetch(`${API_BASE}/api/admin/inventory/${branchId}`);
        if (!res.ok) throw new Error("Failed to load inventory");
        const data = await res.json();

        if (!Array.isArray(data) || !data.length) {
          container.textContent = "No inventory items found for this branch.";
          return;
        }

        const table = document.createElement("table");
        table.innerHTML = `
          <tr>
            <th>Name</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Adjust (+/–)</th>
          </tr>
        `;

        data.forEach(i => {
          const tr = document.createElement("tr");
          tr.dataset.id = i.id; 
          tr.innerHTML = `
            <td>${i.name}</td>
            <td>${i.quantity}</td>
            <td>${i.unit || ""}</td>
            <td>
              <input type="number" class="inv-adjust-input small-input" value="0">
            </td>
          `;
          table.appendChild(tr);
        });

        container.innerHTML = "";
        container.appendChild(table);
      } catch (err) {
        console.error(err);
        container.textContent = "Error loading inventory.";
      }
    }

    async function applyInventoryChanges() {
      const branchId = getSelectedBranchId();
      const statusEl = document.getElementById("inventory-changes-status");
      statusEl.textContent = "Applying changes...";

      const rows = document.querySelectorAll("#inventory-container table tr[data-id]");
      const updates = [];

      rows.forEach(row => {
        const id = parseInt(row.dataset.id, 10);
        const input = row.querySelector(".inv-adjust-input");
        if (!input) return;

        const raw = input.value.trim();
        if (!raw) return;

        const delta = parseInt(raw, 10);
        if (isNaN(delta) || delta === 0) return;

        updates.push({ inventoryItemId: id, delta });
      });

      if (!updates.length) {
        statusEl.textContent = "No changes to apply.";
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/admin/inventory/bulk-update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId: branchId,
            updates: updates,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          statusEl.textContent = data.error || "Error applying changes.";
          return;
        }

        statusEl.textContent = data.message || "Inventory updated.";
        await loadInventory(); 
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error applying changes.";
      }
    }

    function setupInventoryAddForm() {
      const form = document.getElementById("inventory-add-form");
      const statusEl = document.getElementById("inventory-add-status");

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusEl.textContent = "Adding item...";

        const branchId = getSelectedBranchId();
        const name = document.getElementById("add-item-name").value.trim();
        const quantity = document.getElementById("add-item-quantity").value;
        const unit = (document.getElementById("add-item-unit").value || "units").trim();

        try {
          const res = await fetch(`${API_BASE}/api/admin/inventory/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: branchId,
              name,
              quantity,
              unit,
            }),
          });

          const data = await res.json();
          if (!res.ok) {
            statusEl.textContent = data.error || "Error adding item.";
            return;
          }

          statusEl.textContent = data.message || "Item added.";
          form.reset();
          await loadInventory();
        } catch (err) {
          console.error(err);
          statusEl.textContent = "Error adding item.";
        }
      });
    }

    // Top Items 
    async function loadTopItems() {
      const branchId = getSelectedBranchId();
      const container = document.getElementById("top-items-container");
      container.textContent = "Loading top items...";

      try {
        const res = await fetch(`${API_BASE}/api/admin/top-menu-items/${branchId}`);
        if (!res.ok) throw new Error("Failed to load top items");
        const data = await res.json();

        if (!Array.isArray(data) || !data.length) {
          container.textContent = "No order data yet.";
          return;
        }

        const table = document.createElement("table");
        table.innerHTML = `
          <tr>
            <th>Name</th>
            <th>Total Ordered</th>
            <th>Total Revenue ($)</th>
          </tr>
        `;

        data.forEach(i => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${i.name}</td>
            <td>${i.total_quantity}</td>
            <td>${i.total_revenue.toFixed(2)}</td>
          `;
          table.appendChild(tr);
        });

        container.innerHTML = "";
        container.appendChild(table);
      } catch (err) {
        console.error(err);
        container.textContent = "Error loading top items.";
      }
    }

    // Menu Editor 
    async function loadMenuForEditing() {
      const branchId = getSelectedBranchId();
      const container = document.getElementById("menu-edit-container");
      container.textContent = "Loading menu items...";

      try {
        const res = await fetch(`${API_BASE}/api/menu/${branchId}`);
        if (!res.ok) throw new Error("Failed to load menu");
        const data = await res.json();

        if (!Array.isArray(data) || !data.length) {
          container.textContent = "No menu items for this branch.";
          return;
        }

        const table = document.createElement("table");
        table.innerHTML = `
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Price ($)</th>
            <th>Category</th>
            <th>Available</th>
            <th>Save</th>
          </tr>
        `;

        data.forEach(item => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><input type="text" value="${item.name}" id="name-${item.id}"></td>
            <td><input type="text" value="${item.description || ""}" id="desc-${item.id}"></td>
            <td><input type="number" step="0.01" value="${item.price}" id="price-${item.id}" class="small-input"></td>
            <td><input type="text" value="${item.category || ""}" id="cat-${item.id}"></td>
            <td style="text-align:center;">
              <input type="checkbox" ${item.available ? "checked" : ""} id="avail-${item.id}">
            </td>
            <td>
              <button type="button" onclick="saveMenuItem(${item.id})">Save</button>
            </td>
          `;
          table.appendChild(tr);
        });

        container.innerHTML = "";
        container.appendChild(table);
      } catch (err) {
        console.error(err);
        container.textContent = "Error loading menu items.";
      }
    }

    async function saveMenuItem(id) {
      const name = document.getElementById(`name-${id}`).value;
      const description = document.getElementById(`desc-${id}`).value;
      const price = parseFloat(document.getElementById(`price-${id}`).value);
      const category = document.getElementById(`cat-${id}`).value;
      const available = document.getElementById(`avail-${id}`).checked;

      try {
        const res = await fetch(`${API_BASE}/api/admin/menu-items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, price, category, available }),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Error saving menu item.");
          return;
        }

        alert("Saved: " + (data.message || "Menu item updated."));
      } catch (err) {
        console.error(err);
        alert("Error saving menu item.");
      }
    }

    // Staff Management Functions
    let allStaff = [];
    let restaurants = [];

    async function loadStaffList() {
      const container = document.getElementById("staff-list-container");
      const filter = document.getElementById("staff-location-filter");
      const filterValue = filter.value;

      container.innerHTML = "<p>Loading staff members...</p>";

      try {
        const res = await fetch(`${API_BASE}/api/staff?sessionToken=${encodeURIComponent(staffSession.sessionToken)}`);
        if (!res.ok) throw new Error("Failed to load staff");

        allStaff = await res.json();

        let filteredStaff = allStaff;

        if (filterValue === "unassigned") {
          filteredStaff = allStaff.filter(s => !s.restaurantId);
        } else if (filterValue !== "all") {
          const locationId = parseInt(filterValue, 10);
          if (!isNaN(locationId)) {
            filteredStaff = allStaff.filter(s => s.restaurantId === locationId);
          }
        }

        if (!filteredStaff.length) {
          container.innerHTML = "<p>No staff members found for this filter.</p>";
          return;
        }

        const table = document.createElement("table");
        table.innerHTML = `
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Location</th>
          </tr>
        `;

        filteredStaff.forEach(staff => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${staff.firstName} ${staff.lastName}</td>
            <td>${staff.email}</td>
            <td>${staff.role}</td>
            <td>${staff.restaurantName}</td>
          `;
          table.appendChild(tr);
        });

        container.innerHTML = "";
        container.appendChild(table);
      } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error loading staff members.</p>";
      }
    }

    async function setupStaffLocationFilter() {
      const filter = document.getElementById("staff-location-filter");
      const restaurantSelect = document.getElementById("staff-restaurant");

      try {
        const res = await fetch(`${API_BASE}/api/restaurants`);
        if (!res.ok) throw new Error("Failed to load restaurants");
        restaurants = await res.json();

        // Populate filter dropdown
        restaurants.forEach(r => {
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = r.name;
          filter.appendChild(opt);
        });

        // Populate form dropdown
        restaurants.forEach(r => {
          const opt = document.createElement("option");
          opt.value = r.id;
          opt.textContent = r.name;
          restaurantSelect.appendChild(opt);
        });

        filter.addEventListener("change", loadStaffList);

        // Load initial staff list
        loadStaffList();
      } catch (err) {
        console.error(err);
      }
    }

    function bindStaffForm() {
      const form = document.getElementById("staff-form");
      const status = document.getElementById("staff-status");
      if (!form) return;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!staffSession) {
          status.textContent = "Admin session required.";
          return;
        }
        const payload = {
          firstName: document.getElementById("staff-first").value.trim(),
          lastName: document.getElementById("staff-last").value.trim(),
          email: document.getElementById("staff-email").value.trim(),
          password: document.getElementById("staff-password").value,
          role: document.getElementById("staff-role").value,
          restaurantId: document.getElementById("staff-restaurant").value || null,
          sessionToken: staffSession.sessionToken
        };
        if (!payload.firstName || !payload.lastName || !payload.email || !payload.password) {
          status.textContent = "All fields required.";
          return;
        }
        status.textContent = "Saving...";
        try {
          const res = await fetch(`${API_BASE}/api/staff`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok) {
            status.textContent = data.message || "Error creating staff.";
            return;
          }
          status.textContent = data.message + " - Refreshing list...";
          form.reset();
          // Reload staff list after creating new staff
          setTimeout(() => {
            loadStaffList();
            status.textContent = "";
          }, 1500);
        } catch (err) {
          console.error(err);
          status.textContent = "Server error.";
        }
      });
    }

    // Orchestration 
    function onBranchChange() {
      loadInventory();
      loadTopItems();
      loadMenuForEditing();
    }

    document
      .getElementById("apply-inventory-changes-btn")
      .addEventListener("click", applyInventoryChanges);

    // Check if coming from customer portal or other non-admin context
    const urlParams = new URLSearchParams(window.location.search);
    const fromCustomer = urlParams.get('from') === 'customer';
    const referrer = document.referrer;
    const isFromCustomerSite = referrer.includes('/byte2bite_customer/') || fromCustomer;

    // For security: Clear session if coming from customer portal
    if (isFromCustomerSite) {
      localStorage.removeItem('staffSession');
      window.location.reload();
    }

    // Init
    initDashboard();