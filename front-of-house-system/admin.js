const API_BASE = "http://127.0.0.1:5000";
    let staffSession = JSON.parse(localStorage.getItem("staffSession") || "null");

    function initDashboard() {
      const lock = document.getElementById("admin-lock");
      const dash = document.getElementById("admin-dashboard");

      // Check if user is admin
      if (!staffSession || !staffSession.role || staffSession.role.toLowerCase() !== "admin") {
        lock.style.display = "block";
        dash.style.display = "none";
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

    async function attemptAdminLogin() {
      const email = document.getElementById("adminEmail").value.trim();
      const password = document.getElementById("adminPassword").value;
      const statusEl = document.getElementById("adminLoginStatus");

      if (!email || !password) {
        statusEl.textContent = "Please enter email and password.";
        statusEl.style.color = "#ff6666";
        return;
      }

      statusEl.textContent = "Signing in...";
      statusEl.style.color = "#ffcc00";

      try {
        const res = await fetch(`${API_BASE}/api/staff/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
          statusEl.textContent = "Login failed. Check credentials.";
          statusEl.style.color = "#ff6666";
          return;
        }

        const data = await res.json();

        // Check if the account is an admin
        if (!data.role || data.role.toLowerCase() !== "admin") {
          statusEl.textContent = "This account does not have admin access.";
          statusEl.style.color = "#ff6666";
          return;
        }

        // Admin login successful - update session and reload
        localStorage.setItem("staffSession", JSON.stringify(data));
        staffSession = data;
        statusEl.textContent = "Admin access granted!";
        statusEl.style.color = "#66ff66";

        // Reload to show dashboard
        setTimeout(() => {
          initDashboard();
        }, 500);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Server error. Please try again.";
        statusEl.style.color = "#ff6666";
      }
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
            <th>Set To</th>
          </tr>
        `;

        data.forEach(i => {
          const tr = document.createElement("tr");
          tr.dataset.id = i.id;
          // Add stock level classes
          if (i.quantity <= 10) {
            tr.className = "stock-critical";
          } else if (i.quantity <= 25) {
            tr.className = "stock-low";
          }
          tr.innerHTML = `
            <td>${i.name}</td>
            <td>${i.quantity}</td>
            <td>${i.unit || ""}</td>
            <td>
              <input type="number" class="inv-adjust-input small-input" value="0">
            </td>
            <td>
              <input type="number" class="inv-setto-input small-input" placeholder="${i.quantity}">
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
      const deltaUpdates = [];
      const setToUpdates = [];

      rows.forEach(row => {
        const id = parseInt(row.dataset.id, 10);
        const adjustInput = row.querySelector(".inv-adjust-input");
        const setToInput = row.querySelector(".inv-setto-input");

        // Check "Set To" first (takes priority)
        if (setToInput && setToInput.value.trim() !== "") {
          const setToVal = parseInt(setToInput.value.trim(), 10);
          if (!isNaN(setToVal) && setToVal >= 0) {
            setToUpdates.push({ id, quantity: setToVal });
          }
        }
        // Otherwise check adjust delta
        else if (adjustInput) {
          const raw = adjustInput.value.trim();
          if (raw) {
            const delta = parseInt(raw, 10);
            if (!isNaN(delta) && delta !== 0) {
              deltaUpdates.push({ inventoryItemId: id, delta });
            }
          }
        }
      });

      if (!deltaUpdates.length && !setToUpdates.length) {
        statusEl.textContent = "No changes to apply.";
        return;
      }

      try {
        // Process "Set To" updates first
        for (const item of setToUpdates) {
          await fetch(`${API_BASE}/api/admin/inventory/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity: item.quantity }),
          });
        }

        // Process delta updates
        if (deltaUpdates.length) {
          await fetch(`${API_BASE}/api/admin/inventory/bulk-update`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurantId: branchId,
              updates: deltaUpdates,
            }),
          });
        }

        const totalChanges = setToUpdates.length + deltaUpdates.length;
        statusEl.textContent = `Updated ${totalChanges} item(s).`;
        await loadInventory(); 
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error applying changes.";
      }
    }

    function showConfirm(message) {
      return new Promise((resolve) => {
        const modal = document.getElementById("confirm-modal");
        const msgEl = document.getElementById("confirm-modal-message");
        const okBtn = document.getElementById("confirm-modal-ok");
        const cancelBtn = document.getElementById("confirm-modal-cancel");

        msgEl.textContent = message;
        modal.style.display = "flex";

        function cleanup() {
          modal.style.display = "none";
          okBtn.removeEventListener("click", onOk);
          cancelBtn.removeEventListener("click", onCancel);
        }

        function onOk() {
          cleanup();
          resolve(true);
        }

        function onCancel() {
          cleanup();
          resolve(false);
        }

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
      });
    }

    async function restockAll() {
      const branchId = getSelectedBranchId();
      const statusEl = document.getElementById("inventory-changes-status");
      const quantityInput = document.getElementById("restock-quantity");
      const quantity = parseInt(quantityInput.value, 10) || 100;

      const confirmed = await showConfirm(`Reset ALL inventory items to ${quantity} for this location?`);
      if (!confirmed) {
        return;
      }

      statusEl.textContent = "Restocking all items...";

      try {
        const res = await fetch(`${API_BASE}/api/admin/inventory/restock-all`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurantId: branchId, quantity: quantity }),
        });

        const data = await res.json();
        if (!res.ok) {
          statusEl.textContent = data.error || "Error restocking.";
          return;
        }

        statusEl.textContent = data.message || "All items restocked to 100.";
        await loadInventory();
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error restocking items.";
      }
    }

    function setupInventoryAddForm() {
      const form = document.getElementById("inventory-add-form");
      const statusEl = document.getElementById("inventory-add-status");

      const checkbox = document.getElementById("add-item-create-menu");
      const extra = document.getElementById("add-menu-extra");

      checkbox.addEventListener("change", () => {
        extra.style.display = checkbox.checked ? "block" : "none";
      })

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        statusEl.textContent = "Adding item...";

        const branchId = getSelectedBranchId();
        const name = document.getElementById("add-item-name").value.trim();
        const quantity = document.getElementById("add-item-quantity").value;
        const unit = (document.getElementById("add-item-unit").value || "units").trim();

        // menu fields
        const createMenu = document.getElementById("add-item-create-menu").checked;
        const menuName = document.getElementById("add-menu-name")?.value.trim() || "";
        const menuPrice = document.getElementById("add-menu-price")?.value;
        const menuCategory = document.getElementById("add-menu-category")?.value.trim() || "";
        const menuDescription = document.getElementById("add-menu-description")?.value.trim() || "";
        const menuImage = document.getElementById("add-menu-image")?.value.trim() || "";
        
        // Image upload
        const imageFileInput = document.getElementById("add-menu-image-file");
        const imageFile = imageFileInput?.files?.[0] || null;

        const payload = {
          restaurantId: branchId,
          name,
          quantity,
          unit,
        };

        if (createMenu) {
          payload.createMenuItem = true;
          payload.menuName = menuName || name; 
          payload.menuPrice = menuPrice;
          payload.menuCategory = menuCategory;
          payload.menuDescription = menuDescription;
          payload.menuImage = menuImage;
        }

        try {
          // Create / update inventory + optional menu item
          const res = await fetch(`${API_BASE}/api/admin/inventory/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) {
            statusEl.textContent = data.error || "Error adding item.";
            return;
          }

          // If a menu item was created AND a file was chosen, upload it
          if (createMenu && imageFile && data.menuItemId) {
            const formData = new FormData();
            formData.append("image_file", imageFile);

            const imgRes = await fetch(`${API_BASE}/api/admin/menu-items/${data.menuItemId}/image`, {
              method: "POST",
              body: formData,
            });

            const imgData = await imgRes.json();
            if (!imgRes.ok) {
              console.error(imgData);
              statusEl.textContent = "Item added, but error uploading image.";
              return;
            }
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
            <td>
              <div class="name-with-image">
                <input 
                    type="text" 
                    value="${item.name}" 
                    id="name-${item.id}"
                    class="name-input"
                >
                <img 
                    src="${item.image}" 
                    id="preview-${item.id}" 
                    class="menu-preview"
                >
              </div>
            </td>
            <td><input type="text" value="${item.description || ""}" id="desc-${item.id}"></td>
            <td><input type="number" step="0.01" value="${item.price}" id="price-${item.id}" class="small-input"></td>
            <td><input type="text" value="${item.category || ""}" id="cat-${item.id}"></td>

            <td style="text-align:center;">
              <input type="checkbox" ${item.available ? "checked" : ""} id="avail-${item.id}">
            </td>

            <td>
              <input type="file" id="file-${item.id}" accept="image/*" style="margin-bottom:4px;">
              <button type="button" onclick="uploadMenuItemImage(${item.id})">Upload</button>
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

    // =======================
    // Upload Menu Item Image
    // =======================
    async function uploadMenuItemImage(itemId) {
        const fileInput = document.getElementById(`file-${itemId}`);
        const file = fileInput?.files?.[0];

        if (!file) {
            alert("Please choose an image first.");
            return;
        }

        const formData = new FormData();
        formData.append("image_file", file);

        const res = await fetch(`${API_BASE}/api/admin/menu-items/${itemId}/image`, {
            method: "POST",
            body: formData
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Error uploading image.");
            return;
        }

        // Update preview image
        const img = document.getElementById(`preview-${itemId}`);
        if (img && data.signedUrl) {
            img.src = data.signedUrl;
        }

        alert("Image updated!");
    }

    // =======================
    // Save menu Item Function
    // =======================
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

    
    // ==========================
    // Staff Management Functions
    // ==========================
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
            <th>Actions</th>
          </tr>
        `;

        filteredStaff.forEach(staff => {
          const tr = document.createElement("tr");
          tr.dataset.staffId = staff.id;

          tr.innerHTML = `
            <td>${staff.firstName} ${staff.lastName}</td>
            <td>${staff.email}</td>
            <td>${staff.role}</td>
            <td>${staff.restaurantName}</td>
            <td class="staff-actions">
              <button type="button" class="edit-btn" onclick="openEditStaffModal(${staff.id})">Edit</button>
              <button type="button" class="delete-btn" onclick="deleteStaff(${staff.id})">Delete</button>
            </td>
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

    function openEditStaffModal(staffId) {
      const staff = allStaff.find(s => s.id === staffId);
      if (!staff) {
        alert("Staff member not found.");
        return;
      }

      // Populate form fields
      document.getElementById("edit-staff-id").value = staff.id;
      document.getElementById("edit-staff-first").value = staff.firstName;
      document.getElementById("edit-staff-last").value = staff.lastName;
      document.getElementById("edit-staff-email").value = staff.email;
      document.getElementById("edit-staff-password").value = "";
      document.getElementById("edit-staff-role").value = staff.role;

      // Populate location dropdown
      const locationSelect = document.getElementById("edit-staff-location");
      locationSelect.innerHTML = `<option value="">Unassigned</option>`;
      restaurants.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        if (staff.restaurantId === r.id) opt.selected = true;
        locationSelect.appendChild(opt);
      });

      // Clear status
      document.getElementById("edit-staff-status").textContent = "";

      // Show modal
      document.getElementById("edit-staff-modal").style.display = "flex";
    }

    function closeEditStaffModal() {
      document.getElementById("edit-staff-modal").style.display = "none";
    }

    async function saveStaffFromModal() {
      const staffId = document.getElementById("edit-staff-id").value;
      const statusEl = document.getElementById("edit-staff-status");

      const payload = {
        firstName: document.getElementById("edit-staff-first").value.trim(),
        lastName: document.getElementById("edit-staff-last").value.trim(),
        email: document.getElementById("edit-staff-email").value.trim(),
        role: document.getElementById("edit-staff-role").value,
        restaurantId: document.getElementById("edit-staff-location").value || null,
        sessionToken: staffSession.sessionToken
      };

      // Only include password if provided
      const password = document.getElementById("edit-staff-password").value;
      if (password) {
        payload.password = password;
      }

      if (!payload.firstName || !payload.lastName || !payload.email) {
        statusEl.textContent = "Name and email are required.";
        statusEl.style.color = "#ff6666";
        return;
      }

      statusEl.textContent = "Saving...";
      statusEl.style.color = "#ffcc00";

      try {
        const res = await fetch(`${API_BASE}/api/staff/${staffId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          statusEl.textContent = data.message || "Error updating staff member.";
          statusEl.style.color = "#ff6666";
          return;
        }

        statusEl.textContent = "Staff member updated!";
        statusEl.style.color = "#66ff66";

        // Close modal and refresh list after short delay
        setTimeout(() => {
          closeEditStaffModal();
          loadStaffList();
        }, 1000);
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Error updating staff member.";
        statusEl.style.color = "#ff6666";
      }
    }

    async function deleteStaff(staffId) {
      const staff = allStaff.find(s => s.id === staffId);
      if (!staff) return;

      const confirmed = await showConfirm(`Delete staff member "${staff.firstName} ${staff.lastName}"? This cannot be undone.`);
      if (!confirmed) return;

      try {
        const res = await fetch(`${API_BASE}/api/staff/${staffId}?sessionToken=${encodeURIComponent(staffSession.sessionToken)}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken: staffSession.sessionToken }),
        });

        const data = await res.json();
        if (!res.ok) {
          alert(data.message || "Error deleting staff member.");
          return;
        }

        // Refresh the list
        loadStaffList();
      } catch (err) {
        console.error(err);
        alert("Error deleting staff member.");
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
      // Update the status text with selected branch name
      const select = document.getElementById("branch-select");
      const statusEl = document.getElementById("branch-status");
      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption && statusEl) {
        const branchName = selectedOption.textContent.split(" – ")[0];
        statusEl.textContent = `Showing data for: ${branchName}`;
      }

      loadInventory();
      loadTopItems();
      loadMenuForEditing();
    }

    document
      .getElementById("apply-inventory-changes-btn")
      .addEventListener("click", applyInventoryChanges);

    // Edit Staff Modal event listeners
    document
      .getElementById("edit-staff-save")
      .addEventListener("click", saveStaffFromModal);

    document
      .getElementById("edit-staff-cancel")
      .addEventListener("click", closeEditStaffModal);

    // Init
    initDashboard();