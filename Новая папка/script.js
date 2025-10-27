// Данные приложения
let cart = [];
let currentOrder = null;
let userData = {};
let orders = [];
let referrals = [];

// Ключ для админ-доступа (можно поменять)
const ADMIN_PASSWORD = 'admin123';

// Инициализация Telegram Web App
if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
    
    // Получаем данные пользователя
    const tgUser = Telegram.WebApp.initDataUnsafe.user;
    if (tgUser) {
        userData = {
            userId: tgUser.id,
            firstName: tgUser.first_name,
            username: tgUser.username
        };
    }
} else {
    // Режим браузера - создаем тестового пользователя
    userData = {
        userId: Math.floor(Math.random() * 1000000),
        firstName: 'Тестовый',
        username: 'test_user'
    };
}

// Инициализация данных
function initApp() {
    loadOrders();
    loadReferrals();
    loadProducts();
    handleReferral();
}

// Товары
const products = [
    {
        id: 'shaft',
        name: '🔩 Шахта для кальяна',
        price: 2000,
        colors: ['⚫️ Черный', '🔴 Красный', '🟢 Зеленый', '🔵 Синий', '⚪️ Серебристый'],
        description: 'Металлическая шахта с современным дизайном и защитной сеткой',
        specs: {
            size: '24см × 6,5см',
            material: 'Металл',
            features: ['Защитная сетка', 'Легкая чистка', 'Качественные материалы']
        }
    },
    {
        id: 'bowl',
        name: '🔮 Колба для кальяна',
        price: 1000,
        description: 'Стеклянная колба для комфортного использования',
        specs: {
            material: 'Стекло',
            features: ['Совместима с большинством шахт', 'Легко чистится', 'Улучшает процесс использования']
        }
    }
];

// Проверка возраста
function confirmAge() {
    localStorage.setItem('ageConfirmed', 'true');
    document.getElementById('ageWarning').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    initApp();
}

function rejectAge() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.showAlert('Доступ запрещен для лиц младше 18 лет');
        Telegram.WebApp.close();
    } else {
        alert('Доступ запрещен для лиц младше 18 лет');
        document.body.innerHTML = '<div class="age-warning"><h2>Доступ запрещен</h2></div>';
    }
}

// Проверяем подтверждение возраста при загрузке
if (localStorage.getItem('ageConfirmed') === 'true') {
    document.getElementById('ageWarning').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    initApp();
}

// Навигация
function showScreen(screenName) {
    document.querySelectorAll('.screen-content').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenName).classList.remove('hidden');
    
    // Загружаем данные для определенных экранов
    if (screenName === 'orders') {
        loadUserOrders();
    } else if (screenName === 'admin') {
        showAdminPanel();
    } else if (screenName === 'referral') {
        loadReferralInfo();
    }
}

// Загрузка товаров
function loadProducts() {
    const productsList = document.getElementById('productsList');
    productsList.innerHTML = '';
    
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        
        let colorsHTML = '';
        if (product.colors) {
            colorsHTML = `
                <div class="color-selector">
                    <strong>Цвет:</strong><br>
                    ${product.colors.map((color, index) => 
                        `<span class="color-option ${index === 0 ? 'selected' : ''}" 
                              onclick="selectColor(this, '${product.id}')">${color}</span>`
                    ).join('')}
                </div>
            `;
        }
        
        productCard.innerHTML = `
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            ${product.specs ? `
                <div class="specs">
                    <strong>Характеристики:</strong>
                    <ul>
                        ${product.specs.features ? product.specs.features.map(feature => `<li>${feature}</li>`).join('') : ''}
                    </ul>
                </div>
            ` : ''}
            ${colorsHTML}
            <div class="product-price">${product.price}₽</div>
            <div class="product-actions">
                <button class="btn-secondary" onclick="addToCart('${product.id}')">
                    ➕ Добавить в корзину
                </button>
            </div>
        `;
        
        productsList.appendChild(productCard);
    });
}

function selectColor(element, productId) {
    // Снимаем выделение со всех цветов этого товара
    element.parentElement.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    // Выделяем выбранный цвет
    element.classList.add('selected');
}

// Работа с корзиной
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);
    
    // Получаем выбранный цвет
    let selectedColor = null;
    const colorElement = document.querySelector(`[onclick*="selectColor"][onclick*="${productId}"].selected`);
    if (colorElement) {
        selectedColor = colorElement.textContent;
    }
    
    if (existingItem) {
        existingItem.quantity++;
        if (selectedColor) existingItem.selectedColor = selectedColor;
    } else {
        cart.push({
            ...product,
            quantity: 1,
            selectedColor: selectedColor
        });
    }
    
    updateCart();
    showScreen('cart');
    showNotification('Товар добавлен в корзину!');
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
    showNotification('Товар удален из корзины');
}

function updateCartQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCart();
        }
    }
}

function updateCart() {
    const cartItems = document.getElementById('cartItems');
    const totalPrice = document.getElementById('totalPrice');
    
    cartItems.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'product-card';
        cartItem.innerHTML = `
            <h4>${item.name}</h4>
            ${item.selectedColor ? `<p><strong>Цвет:</strong> ${item.selectedColor}</p>` : ''}
            <div class="product-actions">
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                    <span>${item.quantity} шт.</span>
                    <button class="quantity-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                </div>
                <div class="product-price">${itemTotal}₽</div>
                <button class="btn-secondary" onclick="removeFromCart('${item.id}')">🗑️ Удалить</button>
            </div>
        `;
        
        cartItems.appendChild(cartItem);
    });
    
    totalPrice.textContent = total;
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p>Корзина пуста</p>';
    }
    
    // Сохраняем корзину
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Загрузка корзины из localStorage
function loadCart() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCart();
    }
}

// Оформление заказа
function checkout() {
    if (cart.length === 0) {
        showNotification('Корзина пуста!');
        return;
    }
    
    showScreen('checkout');
}

// Отправка заказа
document.getElementById('orderForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const orderData = {
        name: formData.get('name'),
        telegram: formData.get('telegram'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        cart: [...cart], // копируем корзину
        total: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        userId: userData.userId,
        userFirstName: userData.firstName,
        username: userData.username
    };
    
    createOrder(orderData);
});

function createOrder(orderData) {
    const orderId = 'ORD' + Date.now();
    const prepayment = Math.ceil(orderData.total * 0.5); // 50% предоплата
    
    const order = {
        id: orderId,
        ...orderData,
        prepayment: prepayment,
        status: 'new',
        date: new Date().toLocaleDateString('ru-RU'),
        timestamp: Date.now()
    };
    
    // Сохраняем заказ
    saveOrder(order);
    
    // Показываем реквизиты
    showPaymentDetails(orderId, prepayment);
    
    // Показываем уведомление
    showNotification('Заказ создан! Оплатите предоплату.');
}

function showPaymentDetails(orderId, amount) {
    document.getElementById('orderId').textContent = orderId;
    document.getElementById('paymentAmount').textContent = amount;
    showScreen('payment');
}

function confirmPayment() {
    if (currentOrder) {
        // Обновляем статус заказа
        updateOrderStatus(currentOrder.id, 'paid');
    }
    
    showNotification('Спасибо! Ожидайте подтверждения оплаты. Пришлите скриншот чека в Telegram.');
    
    // Очищаем корзину
    cart = [];
    updateCart();
    localStorage.removeItem('cart');
    
    // Показываем главный экран
    showScreen('catalog');
}

// Система заказов
function saveOrder(order) {
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    currentOrder = order;
}

function loadOrders() {
    const savedOrders = localStorage.getItem('orders');
    if (savedOrders) {
        orders = JSON.parse(savedOrders);
    }
}

function loadUserOrders() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '';
    
    const userOrders = orders.filter(order => order.userId === userData.userId);
    
    if (userOrders.length === 0) {
        ordersList.innerHTML = '<p>У вас пока нет заказов</p>';
        return;
    }
    
    userOrders.sort((a, b) => b.timestamp - a.timestamp).forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = `order-card ${order.status}`;
        orderCard.innerHTML = `
            <h4>Заказ #${order.id}</h4>
            <p><strong>Статус:</strong> ${getStatusText(order.status)}</p>
            <p><strong>Сумма:</strong> ${order.total}₽</p>
            <p><strong>Предоплата:</strong> ${order.prepayment}₽</p>
            <p><strong>Дата:</strong> ${order.date}</p>
            <p><strong>Адрес:</strong> ${order.address}</p>
            <p><strong>Telegram:</strong> ${order.telegram}</p>
            <div class="order-items">
                <strong>Товары:</strong>
                ${order.cart.map(item => `
                    <div>${item.name} - ${item.quantity}шт. - ${item.price * item.quantity}₽</div>
                `).join('')}
            </div>
        `;
        ordersList.appendChild(orderCard);
    });
}

function getStatusText(status) {
    const statuses = {
        'new': '🆕 Ожидает оплаты',
        'paid': '💳 Оплачен',
        'completed': '✅ Завершен',
        'cancelled': '❌ Отменен'
    };
    return statuses[status] || status;
}

function updateOrderStatus(orderId, status) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        localStorage.setItem('orders', JSON.stringify(orders));
    }
}

// Реферальная система
function loadReferralInfo() {
    const userId = userData.userId;
    if (userId) {
        // Генерируем ссылку на сайт с реферальным параметром
        const webAppUrl = `https://minishishaa.netlify.app/?ref=${userId}`;
        
        document.getElementById('referralLink').textContent = webAppUrl;
        document.getElementById('referralLink').href = webAppUrl;
        
        // Обновляем статистику
        updateReferralStats();
    }
}

function copyReferralLink() {
    const link = document.getElementById('referralLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
        showNotification('Ссылка скопирована! Делитесь с друзьями!');
    }).catch(err => {
        showNotification('Ошибка копирования ссылки');
    });
}

function handleReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const refParam = urlParams.get('ref');
    
    if (refParam && refParam !== userData.userId.toString()) {
        const referrerId = refParam;
        
        // Сохраняем реферера
        localStorage.setItem('referrer', referrerId);
        
        // Сохраняем реферала
        saveReferral(referrerId, userData.userId);
        
        showNotification('🎉 Вы перешли по реферальной ссылке! Получите скидку 10% на первый заказ!');
    }
}

function saveReferral(referrerId, referredId) {
    const referral = {
        id: Date.now(),
        referrerId: parseInt(referrerId),
        referredId: referredId,
        date: new Date().toLocaleDateString('ru-RU'),
        bonusApplied: false
    };
    
    referrals.push(referral);
    localStorage.setItem('referrals', JSON.stringify(referrals));
}

function loadReferrals() {
    const savedReferrals = localStorage.getItem('referrals');
    if (savedReferrals) {
        referrals = JSON.parse(savedReferrals);
    }
}

function updateReferralStats() {
    const userReferrals = referrals.filter(ref => ref.referrerId === userData.userId);
    document.getElementById('referralCount').textContent = userReferrals.length;
    
    // Скидка зависит от количества рефералов
    const discount = Math.min(10 + userReferrals.length * 5, 50); // макс 50%
    document.getElementById('discountPercent').textContent = discount + '%';
}

// Админ панель
function showAdminPanel() {
    // Простая проверка пароля (в реальном приложении нужно сделать безопаснее)
    const password = prompt('Введите пароль администратора:');
    if (password !== ADMIN_PASSWORD) {
        showNotification('Неверный пароль');
        showScreen('catalog');
        return;
    }
    
    loadAdminOrders();
    updateAdminStats();
}

function loadAdminOrders() {
    const adminOrdersList = document.getElementById('adminOrdersList');
    adminOrdersList.innerHTML = '';
    
    if (orders.length === 0) {
        adminOrdersList.innerHTML = '<p>Заказов нет</p>';
        return;
    }
    
    orders.sort((a, b) => b.timestamp - a.timestamp).forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = `order-card ${order.status}`;
        orderCard.innerHTML = `
            <h4>Заказ #${order.id} <span class="status-badge status-${order.status}">${getStatusText(order.status)}</span></h4>
            <p><strong>Клиент:</strong> ${order.name} (${order.telegram})</p>
            <p><strong>Телефон:</strong> ${order.phone}</p>
            <p><strong>Адрес:</strong> ${order.address}</p>
            <p><strong>Сумма:</strong> ${order.total}₽ (Предоплата: ${order.prepayment}₽)</p>
            <p><strong>Дата:</strong> ${order.date}</p>
            <div class="order-items">
                <strong>Товары:</strong>
                ${order.cart.map(item => `
                    <div>${item.name} - ${item.quantity}шт. - ${item.price * item.quantity}₽</div>
                `).join('')}
            </div>
            <div class="admin-actions">
                <button class="btn-secondary" onclick="updateOrderStatus('${order.id}', 'paid')">Отметить оплаченным</button>
                <button class="btn-secondary" onclick="updateOrderStatus('${order.id}', 'completed')">Завершить</button>
                <button class="btn-danger" onclick="updateOrderStatus('${order.id}', 'cancelled')">Отменить</button>
            </div>
        `;
        adminOrdersList.appendChild(orderCard);
    });
}

function updateAdminStats() {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('totalRevenue').textContent = totalRevenue;
}

function exportOrders() {
    const dataStr = JSON.stringify(orders, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `orders_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    showNotification('Заказы экспортированы!');
}

function clearAllData() {
    if (confirm('Вы уверены? Это удалит ВСЕ данные (заказы, рефералы, корзины).')) {
        localStorage.clear();
        orders = [];
        referrals = [];
        cart = [];
        showNotification('Все данные очищены');
        loadAdminOrders();
        updateAdminStats();
    }
}

// Вспомогательные функции
function showNotification(message) {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.showAlert(message);
    } else {
        alert(message);
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    loadCart();
    document.getElementById('orders').addEventListener('click', loadUserOrders);
});

// Открываем каталог по умолчанию
showScreen('catalog');