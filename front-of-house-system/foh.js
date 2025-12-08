// Global state
        let currentTab = 'order';
        let selectedRestaurant = 1;
        let menuItems = [];
        let cart = [];
        let selectedCustomer = null;
        let paymentMethod = 'Cash';
        let amountEntered = '0';
        let staffSession = null;
        let rewardsApplied = false;

        // Stripe variables
        let fohStripe = null;
        let fohCardElement = null;

        // Initialize Stripe for card payments
        async function initFohStripe() {
            if (fohStripe) return;

            try {
                const res = await fetch('http://127.0.0.1:5000/api/stripe-key');
                const data = await res.json();
                fohStripe = Stripe(data.publishable_key);
                const elements = fohStripe.elements();
                fohCardElement = elements.create('card', {
                    style: {
                        base: {
                            fontSize: '18px',
                            color: '#32325d',
                        }
                    }
                });
                fohCardElement.mount('#foh-card-element');

                fohCardElement.on('change', event => {
                    const displayError = document.getElementById('foh-card-errors');
                    displayError.textContent = event.error ? event.error.message : '';
                });
            } catch (error) {
                console.error('Error initializing Stripe:', error);
            }
        }

        function loadStaffSession() {
            staffSession = JSON.parse(localStorage.getItem('staffSession') || 'null');
            const overlay = document.getElementById('staffLoginOverlay');
            const info = document.getElementById('staffInfo');
            const adminLink = document.getElementById('adminLink');

            if (staffSession) {
                overlay.classList.add('hidden');
                if (info) {
                    info.textContent = `${staffSession.firstName} (${staffSession.role})`;
                }
                // Show admin dashboard link for all logged-in staff
                if (adminLink) {
                    adminLink.style.display = 'block';
                }
            } else {
                overlay.classList.remove('hidden');
                if (info) info.textContent = '';
                if (adminLink) adminLink.style.display = 'none';
            }
        }

        async function submitStaffLogin() {
            const email = document.getElementById('staffEmail').value.trim();
            const password = document.getElementById('staffPassword').value;
            const status = document.getElementById('staffLoginStatus');
            if (!email || !password) {
                status.textContent = 'Email and password required.';
                return;
            }
            status.textContent = 'Signing in...';
            try {
                const res = await fetch('http://127.0.0.1:5000/api/staff/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                if (!res.ok) {
                    status.textContent = 'Login failed.';
                    return;
                }
                const data = await res.json();
                localStorage.setItem('staffSession', JSON.stringify(data));
                status.textContent = 'Welcome!';
                loadStaffSession();
                loadMenu();
            } catch (err) {
                console.error(err);
                status.textContent = 'Server unavailable.';
            }
        }

        function logoutStaff() {
            localStorage.removeItem('staffSession');
            staffSession = null;
            loadStaffSession();
        }

        function requireStaff() {
            if (!staffSession) {
                loadStaffSession();
                return false;
            }
            return true;
        }

        // Load list of restaurants/locations
        async function loadRestaurants() {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/restaurants');
                const restaurants = await response.json();

                const select = document.getElementById('locationSelect');
                select.innerHTML = restaurants.map(r => {
                    const locationName = r.name.replace('Mi Casa ', '');
                    return `<option value="${r.id}" ${r.id === selectedRestaurant ? 'selected' : ''}>${locationName}</option>`;
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
            selectedRestaurant = parseInt(select.value) || 1;

            // Reload menu for new location
            loadMenu();

            // Reload orders if on those tabs
            if (currentTab === 'current-orders') {
                loadCurrentOrders();
            } else if (currentTab === 'past-orders') {
                loadPastOrders();
            }
        }

        // Initialize on load
        window.onload = function() {
            loadStaffSession();
            loadRestaurants();
            loadMenu();
        };

        // Auto-refresh interval for order tabs
        let refreshInterval = null;

        // Past orders sort direction (true = newest first, false = oldest first)
        let pastOrdersSortNewestFirst = true;
        let cachedPastOrders = [];

        // Tab navigation
        function showTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            document.getElementById(tabName + '-tab').classList.add('active');
            document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
            currentTab = tabName;

            // Clear any existing refresh interval
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }

            if (tabName === 'payment') {
                updatePaymentDisplay();
            } else if (tabName === 'current-orders') {
                loadCurrentOrders();
                // Auto-refresh every 5 seconds
                refreshInterval = setInterval(loadCurrentOrders, 5000);
            } else if (tabName === 'past-orders') {
                loadPastOrders();
                // Auto-refresh every 5 seconds
                refreshInterval = setInterval(loadPastOrders, 5000);
            }
        }

        // Menu drawer
        function toggleMenu() {
            const drawer = document.getElementById('menuDrawer');
            const overlay = document.getElementById('menuOverlay');
            drawer.classList.toggle('open');
            overlay.classList.toggle('active');
        }

        // Load menu items
        async function loadMenu() {
            try {
                await loadMenuImages();

                const response = await fetch(`http://127.0.0.1:5000/api/menu/${selectedRestaurant}`);
                const items = await response.json();
                menuItems = items;
                displayMenuItems(items);
            } catch (error) {
                console.error('Error loading menu:', error);
            }
        }


        // ============ //
        // Image config //
        // ============ //
        const IMAGE_JSON_PATH = "../menu_items.json";  
        const IMAGE_BASE = "..";                       
        let menuImageMap = null;

        function buildImagePath(relativePath) {
            if (!relativePath) {
                return IMAGE_BASE + "/Food.webp"; 
            }

            if (relativePath.startsWith("/") || relativePath.startsWith("http")) {
                return relativePath;
            }

            return IMAGE_BASE + "/" + relativePath;
        }

        async function loadMenuImages() {
            if (menuImageMap) return menuImageMap;

            try {
                const res = await fetch(IMAGE_JSON_PATH);
                menuImageMap = await res.json();
                return menuImageMap;
            } catch (e) {
                console.error("Could not load menu_items.json", e);
                menuImageMap = null;
                return null;
            }
        }

        function getImageForItem(itemOrName) {
            const defaultImg = buildImagePath(
                (menuImageMap && menuImageMap.default_image) || "Food.webp"
            );
            const items = (menuImageMap && menuImageMap.menu_items) || {};

            if (itemOrName && typeof itemOrName === "object") {
                if (itemOrName.image) {
                    return buildImagePath(itemOrName.image);
                }

                if (itemOrName.name) {
                    if (items[itemOrName.name]) {
                        return items[itemOrName.name] === "default"
                            ? defaultImg
                            : buildImagePath(items[itemOrName.name]);
                    }

                    const match = menuItems.find(i => i.name === itemOrName.name);
                    if (match && match.image) {
                        return buildImagePath(match.image);
                    }
                }
            }

            if (typeof itemOrName === "string" && items[itemOrName]) {
                return items[itemOrName] === "default"
                    ? defaultImg
                    : buildImagePath(items[itemOrName]);
            }

            if (typeof itemOrName === "string") {
                const match = menuItems.find(i => i.name === itemOrName);
                if (match && match.image) {
                    return buildImagePath(match.image);
                }
            }

            return defaultImg;
        }

        // Display menu items
        function displayMenuItems(items) {
            const container = document.getElementById('menuItems');
            container.innerHTML = '';

            items.forEach(item => {
                const cartItem = cart.find(ci => ci.id === item.id);
                const quantity = cartItem ? cartItem.quantity : 0;
                const price = parseFloat(item.price);

                const itemDiv = document.createElement('div');
                itemDiv.className = 'menu-item';
                itemDiv.innerHTML = `
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="decreaseQuantity(${item.id})">−</button>
                        <div class="quantity-checkbox">${quantity || 0}</div>
                        <button class="quantity-btn" onclick="increaseQuantity(${item.id})">+</button>
                    </div>
                    <img class="menu-item-image" src="${getImageForItem(item)}" alt="${item.name}">
                    <div class="menu-item-details">
                        <div class="menu-item-name">${item.name}</div>
                        <div class="menu-item-description">
                            ${item.description || 'Delicious menu item with fresh ingredients.'}
                        </div>
                    </div>
                    <div class="menu-item-price">$${price.toFixed(2)}</div>
                `;
                container.appendChild(itemDiv);
            });
        }

        // Cart management
        function increaseQuantity(itemId) {
            const menuItem = menuItems.find(item => item.id === itemId);
            const cartItem = cart.find(item => item.id === itemId);

            if (cartItem) {
                if (cartItem.quantity >= 99) return;
                cartItem.quantity++;
            } else {
                cart.push({
                    id: itemId,
                    name: menuItem.name,
                    price: parseFloat(menuItem.price),
                    quantity: 1
                });
            }

            updateCart();
            displayMenuItems(menuItems);
        }

        function decreaseQuantity(itemId) {
            const cartItemIndex = cart.findIndex(item => item.id === itemId);

            if (cartItemIndex !== -1) {
                if (cart[cartItemIndex].quantity > 1) {
                    cart[cartItemIndex].quantity--;
                } else {
                    cart.splice(cartItemIndex, 1);
                }
            }

            updateCart();
            displayMenuItems(menuItems);
        }

        function updateCart() {
            const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
            document.getElementById('cartBadge').textContent = totalItems;
        }

        // Phone search with auto-formatting
        document.getElementById('phoneInput')?.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 10) {
                value = value.substring(0, 10);
                const formatted = `${value.substring(0,1)}-${value.substring(1,4)}-${value.substring(4,7)}-${value.substring(7,10)}`;
                e.target.value = formatted;
                searchCustomer();
            }
        });

        function clearPhoneSearch() {
            document.getElementById('phoneInput').value = '';
            document.getElementById('customerList').innerHTML = '';
        }

        // Customer search
        async function searchCustomer() {
            const phone = document.getElementById('phoneInput').value.replace(/\D/g, '');

            if (!phone || phone.length < 10) {
                return;
            }

            try {
                const response = await fetch(`http://127.0.0.1:5000/api/customers/search?phone=${phone}`);

                if (response.ok) {
                    const customer = await response.json();
                    displayCustomer(customer);
                } else {
                    document.getElementById('customerList').innerHTML = `
                        <div style="padding: 15px; color: #666;">No customer found</div>
                    `;
                }
            } catch (error) {
                console.error('Error searching customer:', error);
            }
        }

        function displayCustomer(customer) {
            const listDiv = document.getElementById('customerList');
            const rewardsInfo = customer.rewardsPoints ? `<div style="color: #f5b12a; font-size: 14px;">Rewards: ${customer.rewardsPoints} points ($${(customer.rewardsPoints/100).toFixed(2)})</div>` : '';
            listDiv.innerHTML = `
                <div class="customer-item" onclick="selectCustomer(${customer.id}, '${customer.firstName} ${customer.lastName}', '${customer.phoneNumber}', ${customer.rewardsPoints || 0})">
                    <div class="customer-phone">${customer.phoneNumber}</div>
                    <div class="customer-name">${customer.firstName} ${customer.lastName.charAt(0)}.</div>
                    ${rewardsInfo}
                </div>
            `;
        }

        function selectCustomer(id, name, phone, rewardsPoints = 0) {
            selectedCustomer = { id, name, phone, rewardsPoints };
            document.querySelectorAll('.customer-item').forEach(item => {
                item.classList.remove('selected');
            });
            event.currentTarget.classList.add('selected');
        }

        function selectGuest() {
            const guestName = document.getElementById('guestName').value.trim();
            if (!guestName) {
                alert('Please enter a guest name');
                return;
            }
            selectedCustomer = { id: null, name: guestName };
            showTab('payment');
        }

        // Payment
        function selectPaymentMethod(method) {
            paymentMethod = method;
            document.querySelectorAll('.payment-method-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            event.currentTarget.classList.add('selected');

            // Show/hide appropriate input section
            const cashSection = document.getElementById('cash-input-section');
            const cardSection = document.getElementById('card-input-section');

            if (method === 'Card') {
                cashSection.style.display = 'none';
                cardSection.style.display = 'block';
                initFohStripe();
            } else {
                cashSection.style.display = 'block';
                cardSection.style.display = 'none';
            }

            updatePaymentDisplay();
        }

        function addDigit(digit) {
            if (digit === '.' && amountEntered.includes('.')) return;
            if (amountEntered === '0' && digit !== '.') {
                amountEntered = digit;
            } else {
                amountEntered += digit;
            }
            updatePaymentDisplay();
        }

        function clearAmount() {
            if (amountEntered.length > 1) {
                amountEntered = amountEntered.slice(0, -1);
            } else {
                amountEntered = '0';
            }
            updatePaymentDisplay();
        }

        function toggleRewards() {
            rewardsApplied = !rewardsApplied;
            updatePaymentDisplay();

            const btn = document.getElementById('applyRewardsBtn');
            const discountLine = document.getElementById('rewardsDiscountLine');

            if (rewardsApplied) {
                btn.textContent = 'Remove';
                btn.style.background = '#f44336';
                discountLine.style.display = 'block';
            } else {
                btn.textContent = 'Apply All';
                btn.style.background = '#4CAF50';
                discountLine.style.display = 'none';
            }
        }

        function updatePaymentDisplay() {
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            document.getElementById('paymentTotal').textContent = total.toFixed(2);

            // Show rewards section if customer is selected and has points
            const rewardsSection = document.getElementById('rewards-section');
            if (selectedCustomer?.rewardsPoints > 0) {
                rewardsSection.style.display = 'block';
                const availablePoints = selectedCustomer.rewardsPoints;
                const availableDollars = (availablePoints / 100).toFixed(2);
                document.getElementById('availablePoints').textContent = availablePoints;
                document.getElementById('availablePointsDollars').textContent = `$${availableDollars}`;
            } else {
                rewardsSection.style.display = 'none';
                rewardsApplied = false;
            }

            // Calculate discount based on whether rewards are applied
            let discount = 0;
            if (rewardsApplied && selectedCustomer?.rewardsPoints > 0) {
                // Automatically use all available points up to the order total
                const maxUsablePoints = Math.min(selectedCustomer.rewardsPoints, Math.floor(total * 100));
                discount = maxUsablePoints / 100;
            }

            const finalTotal = Math.max(total - discount, 0);

            document.getElementById('rewardsDiscount').textContent = discount.toFixed(2);
            document.getElementById('finalTotal').textContent = finalTotal.toFixed(2);

            const amount = parseFloat(amountEntered) || 0;
            document.getElementById('amountEntered').textContent = amount.toFixed(2);

            const change = Math.max(0, amount - finalTotal);
            document.getElementById('changeAmount').textContent = change.toFixed(2);
        }

        // Complete order
        async function completeOrder() {
            if (cart.length === 0) {
                alert('Cart is empty!');
                return;
            }

            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Calculate actual points being redeemed
            let pointsToRedeem = 0;
            if (rewardsApplied && selectedCustomer?.rewardsPoints > 0) {
                pointsToRedeem = Math.min(selectedCustomer.rewardsPoints, Math.floor(total * 100));
            }

            const discount = pointsToRedeem / 100;
            const finalTotal = Math.max(total - discount, 0);
            const amount = parseFloat(amountEntered) || 0;

            if (paymentMethod === 'Cash' && amount < finalTotal) {
                alert('Insufficient payment amount');
                return;
            }

            // Verify order total before submission
            if (total <= 0) {
                alert("Please add at least one item to the order.");
                return;
            }

            const orderData = {
                locationId: parseInt(selectedRestaurant),
                customerId: selectedCustomer?.id || null,
                customerName: selectedCustomer?.name || 'Guest',
                items: cart.map(item => ({
                    id: item.id,
                    quantity: item.quantity
                })),
                pointsToRedeem: pointsToRedeem
            };

            try {
                if (paymentMethod === 'Card') {
                    // Card payment with Stripe
                    if (!fohStripe || !fohCardElement) {
                        showError('Payment Error', 'Card payment is not ready. Please try again.');
                        return;
                    }

                    const response = await fetch('http://127.0.0.1:5000/api/orders/stripe-payment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });

                    if (!response.ok) {
                        showError('Payment Error', 'Unable to process payment. Please try again.');
                        return;
                    }

                    const data = await response.json();

                    if (data.error) {
                        showError('Payment Error', data.error);
                        return;
                    }

                    // Process payment with Stripe card element
                    const { paymentIntent, error } = await fohStripe.confirmCardPayment(data.client_secret, {
                        payment_method: {
                            card: fohCardElement
                        }
                    });

                    if (error) {
                        // Check if card was declined or invalid
                        if (error.code === 'card_declined') {
                            showError('Card Declined', 'Your card was declined. Please try a different card.');
                        } else {
                            showError('Invalid Card', 'Please check your card details and try again.');
                        }
                        return;
                    }

                    if (paymentIntent.status === 'succeeded') {
                        // Confirm payment on backend
                        const confirmResponse = await fetch(`http://127.0.0.1:5000/api/orders/${data.order_id}/confirm-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                payment_intent_id: paymentIntent.id,
                                points_redeemed: pointsToRedeem
                            })
                        });

                        if (confirmResponse.ok) {
                            showConfirmation(data.order_id);
                        } else {
                            showError('Order Error', 'Payment successful but order update failed.');
                        }
                    }
                } else {
                    // Cash payment (existing flow)
                    orderData.payment = {
                        method: 'Cash',
                        amount: amount
                    };

                    const response = await fetch('http://127.0.0.1:5000/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });

                    if (response.ok) {
                        const result = await response.json();
                        showConfirmation(result.orderId || Math.floor(Math.random() * 10000));
                    } else {
                        alert('Error placing order. Please try again.');
                    }
                }
            } catch (error) {
                console.error('Error submitting order:', error);
                showError('Error', 'Something went wrong. Please try again.');
            }
        }

        function showConfirmation(orderId) {
            document.getElementById('orderNumber').textContent = orderId;
            document.getElementById('confirmationModal').classList.add('active');
        }

        function showError(title, message) {
            document.getElementById('errorTitle').textContent = title;
            document.getElementById('errorMessage').textContent = message;
            document.getElementById('errorModal').classList.add('active');
        }

        function closeErrorModal() {
            document.getElementById('errorModal').classList.remove('active');
        }

        function startNewOrder() {
            cart = [];
            selectedCustomer = null;
            amountEntered = '0';
            paymentMethod = 'Cash';
            rewardsApplied = false;

            document.getElementById('phoneInput').value = '';
            document.getElementById('guestName').value = '';
            document.getElementById('customerList').innerHTML = '';

            // Reset rewards button appearance
            const btn = document.getElementById('applyRewardsBtn');
            const discountLine = document.getElementById('rewardsDiscountLine');
            if (btn) {
                btn.textContent = 'Apply All';
                btn.style.background = '#4CAF50';
            }
            if (discountLine) {
                discountLine.style.display = 'none';
            }

            // Reset payment method selection to Cash
            document.querySelectorAll('.payment-method-btn').forEach(b => b.classList.remove('selected'));
            document.querySelector('.payment-method-btn').classList.add('selected');
            document.getElementById('cash-input-section').style.display = 'block';
            document.getElementById('card-input-section').style.display = 'none';

            document.getElementById('confirmationModal').classList.remove('active');
            updateCart();
            showTab('order');
            displayMenuItems(menuItems);
        }

        // Load current orders (all active orders: pending, preparing, and completed)
        async function loadCurrentOrders() {
            try {
                // Fetch active orders (Pending, Preparing) - filtered by location
                const activeResponse = await fetch(`http://127.0.0.1:5000/api/orders?restaurant_id=${selectedRestaurant}`);
                const activeOrders = await activeResponse.json();

                // Fetch completed orders - filtered by location
                const historyResponse = await fetch(`http://127.0.0.1:5000/api/history?restaurant_id=${selectedRestaurant}`);
                const historyOrders = await historyResponse.json();

                // Filter history to only get Completed (exclude Delivered)
                const completedOrders = historyOrders.filter(order =>
                    order.status && order.status.toLowerCase() === 'completed'
                );

                // Combine all current orders
                const allCurrentOrders = [...activeOrders, ...completedOrders];

                // Sort: Completed at top, then Preparing, then Pending
                allCurrentOrders.sort((a, b) => {
                    const statusA = (a.status || '').toLowerCase();
                    const statusB = (b.status || '').toLowerCase();

                    // Completed orders first (ready to be marked as delivered)
                    if (statusA === 'completed' && statusB !== 'completed') return -1;
                    if (statusB === 'completed' && statusA !== 'completed') return 1;

                    // Then Preparing orders
                    if (statusA === 'preparing' && statusB === 'pending') return -1;
                    if (statusB === 'preparing' && statusA === 'pending') return 1;

                    return 0;
                });

                displayCurrentOrders(allCurrentOrders);
            } catch (error) {
                console.error('Error loading current orders:', error);
                document.getElementById('current-orders-list').innerHTML =
                    '<p style="text-align: center; color: #d32f2f; padding: 40px;">Error loading orders</p>';
            }
        }

        function displayCurrentOrders(orders) {
            const container = document.getElementById('current-orders-list');

            if (!orders || orders.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">No current orders</p>';
                return;
            }

            container.innerHTML = orders.map(order => {
                const status = (order.status || 'Unknown').toLowerCase();
                const statusDisplay = order.status || 'Unknown';
                const isCompleted = status === 'completed';

                // Status badge color
                let statusColor = '#666';
                if (status === 'completed') statusColor = '#4CAF50';
                else if (status === 'preparing') statusColor = '#FF9800';
                else if (status === 'pending') statusColor = '#2196F3';

                return `
                    <div class="order-card">
                        <div class="order-header">
                            <div class="order-number">Order #${order.id || order.orderId}</div>
                            ${order.created_at ? `<div class="order-time">${formatOrderTime(order.created_at)}</div>` : ''}
                        </div>
                        <div class="order-customer">
                            <strong>Customer:</strong> ${order.customer_name || 'Guest'}
                        </div>
                        <div class="order-items">
                            <strong>Items:</strong> ${order.items || 'No items'}
                        </div>
                        <div class="order-status" style="margin-top: 10px; color: ${statusColor}; font-weight: 500;">
                            Status: ${statusDisplay}
                        </div>
                        ${isCompleted ? `
                            <button class="mark-delivered-btn" onclick="markOrderDelivered(${order.id || order.orderId})">
                                Mark as Complete
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }

        // Load past orders (historical delivered orders)
        async function loadPastOrders() {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/history?restaurant_id=${selectedRestaurant}`);
                const orders = await response.json();

                // Filter for orders that have been delivered
                const pastOrders = orders.filter(order =>
                    order.status && order.status.toLowerCase() === 'delivered'
                );

                // Cache the orders
                cachedPastOrders = pastOrders;

                // Sort and display
                sortAndDisplayPastOrders();
            } catch (error) {
                console.error('Error loading past orders:', error);
                document.getElementById('past-orders-list').innerHTML =
                    '<p style="text-align: center; color: #d32f2f; padding: 40px;">Error loading orders</p>';
            }
        }

        function sortAndDisplayPastOrders() {
            if (!cachedPastOrders || cachedPastOrders.length === 0) {
                document.getElementById('past-orders-list').innerHTML =
                    '<p style="text-align: center; color: #666; padding: 40px;">No past orders</p>';
                return;
            }

            // Sort by date
            const sorted = [...cachedPastOrders].sort((a, b) => {
                const dateA = new Date(a.created_at);
                const dateB = new Date(b.created_at);
                return pastOrdersSortNewestFirst ? dateB - dateA : dateA - dateB;
            });

            displayPastOrders(sorted);
        }

        function displayPastOrders(orders) {
            const container = document.getElementById('past-orders-list');

            container.innerHTML = orders.map(order => `
                <div class="order-card">
                    <div class="order-header">
                        <div class="order-number">Order #${order.id}</div>
                        <div class="order-time">${formatOrderTime(order.created_at)}</div>
                    </div>
                    <div class="order-customer">
                        <strong>Customer:</strong> ${order.customer_name || 'Guest'}
                    </div>
                    <div class="order-items">
                        <strong>Items:</strong> ${order.items || 'No items'}
                    </div>
                    <div class="order-status" style="margin-top: 10px; color: #4CAF50; font-weight: 500;">
                        ✓ Completed
                    </div>
                </div>
            `).join('');
        }

        // Toggle sort direction for past orders
        function togglePastOrdersSort() {
            pastOrdersSortNewestFirst = !pastOrdersSortNewestFirst;
            const arrow = document.getElementById('sort-arrow');
            arrow.textContent = pastOrdersSortNewestFirst ? '↓' : '↑';
            sortAndDisplayPastOrders();
        }

        // Mark order as delivered
        async function markOrderDelivered(orderId) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/orders/${orderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Delivered' })
                });

                if (response.ok) {
                    loadCurrentOrders();
                } else {
                    alert('Error marking order as delivered');
                }
            } catch (error) {
                console.error('Error marking order as delivered:', error);
                alert('Error marking order as delivered');
            }
        }

        // Format order time
        function formatOrderTime(timestamp) {
            if (!timestamp) return 'Unknown time';

            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 60) {
                return `${diffMins} min ago`;
            } else if (diffMins < 1440) {
                const hours = Math.floor(diffMins / 60);
                return `${hours}h ago`;
            } else {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
        }