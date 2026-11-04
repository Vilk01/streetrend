const API_URL = "http://localhost:8000";

const token = () => localStorage.getItem("token");

async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token()) headers["Authorization"] = `Bearer ${token()}`;
    if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

    const res = await fetch(API_URL + path, { ...opts, headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Ошибка сервера" }));
        throw new Error(typeof err.detail === "string" ? err.detail : "Ошибка запроса");
    }
    return res.json();
}

async function checkAuth() {
    if (!token()) return null;

    if (localStorage.getItem("is_admin") === "true") {
        return { is_admin: true, name: "Админ", role: localStorage.getItem("admin_role") };
    }

    try {
        const u = await api("/api/auth/me");
        u.is_admin = false;
        return u;
    } catch {
        localStorage.removeItem("token");
        return null;
    }
}

function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}

async function renderMenu() {
    const list = document.querySelector(".menu-list");
    if (!list) return;
    const user = await checkAuth();

    if (user) {
        let profileLink = user.is_admin
            ? ""
            : `<li><a href="profile.html" class="menu-item">Личный кабинет</a></li>`;

        let adminLink = user.is_admin
            ? `<li><a href="admin.html" class="menu-item" style="color: #ff4d4d;">⚙ Панель управления</a></li>`
            : "";

        list.innerHTML = `
            <li><a href="index.html" class="menu-item">Главная</a></li> <!-- ДОБАВИЛИ ВОТ ЭТУ СТРОКУ -->
            ${profileLink}
            <li><a href="catalog.html" class="menu-item">Каталог</a></li>
            ${adminLink}
            <li><a href="#" class="menu-item" onclick="logout()">Выйти (${user.name})</a></li>
        `;
    } else {
        list.innerHTML = `
            <li><a href="index.html" class="menu-item">Главная</a></li>
            <li><a href="catalog.html" class="menu-item">Каталог</a></li>
            <li><a href="signIn.html" class="menu-item">Вход</a></li>
        `;
    }
}

function togglePassword(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btnElement.style.color = '#ffffff';
    } else {
        input.type = 'password';
        btnElement.style.color = '#a8a8a8';
    }
}

document.addEventListener("DOMContentLoaded", () => {

    const btn = document.getElementById("burgerBtn");
    const menu = document.getElementById("burgerMenu");
    const overlay = document.getElementById("menuOverlay");
    if (btn) {
        btn.onclick = () => {
            btn.classList.toggle("active");
            menu.classList.toggle("active");
            overlay.classList.toggle("active");
        };
        overlay.onclick = () => {
            btn.classList.remove("active");
            menu.classList.remove("active");
            overlay.classList.remove("active");
        };
    }

    renderMenu();
    const page = document.body.dataset.page;

    if (page === "signin") {
        document.querySelector(".auth-form").onsubmit = async (e) => {
            e.preventDefault();
            const form = new FormData(e.target);
            const body = new URLSearchParams({
                username: form.get("email"),
                password: form.get("password")
            });

            try {

                let res = await fetch(API_URL + "/api/auth/login", {
                    method: "POST",
                    headers: {"Content-Type":"application/x-www-form-urlencoded"},
                    body
                });

                if (!res.ok) {
                    res = await fetch(API_URL + "/api/auth/admin-login", {
                        method: "POST",
                        headers: {"Content-Type":"application/x-www-form-urlencoded"},
                        body
                    });
                }

                if (!res.ok) throw new Error("Неверный логин или пароль");

                const data = await res.json();
                localStorage.setItem("token", data.access_token);

                if (data.user.is_admin) {
                    localStorage.setItem("is_admin", "true");
                    localStorage.setItem("admin_role", data.user.role);
                }

                window.location.href = data.user.is_admin ? "admin.html" : "catalog.html";
            } catch (err) {
                alert(err.message);
            }
        };
    }

    if (page === "signup") {
        document.querySelector(".auth-form").onsubmit = async (e) => {
            e.preventDefault();
            const form = new FormData(e.target);
            if (form.get("password") !== form.get("confirm_password")) {
                return alert("Пароли не совпадают");
            }
            try {
                const res = await fetch(API_URL + "/api/auth/register", {
                    method: "POST",
                    headers: {"Content-Type":"application/json"},
                    body: JSON.stringify({
                        name: form.get("name"),
                        lastname: form.get("lastname"),
                        phone: form.get("phone"),
                        email: form.get("email"),
                        city: form.get("city"),
                        password: form.get("password")
                    })
                });
                if (!res.ok) throw new Error("Ошибка регистрации (возможно, почта занята)");
                const data = await res.json();
                localStorage.setItem("token", data.access_token);
                window.location.href = "catalog.html";
            } catch (err) {
                alert(err.message);
            }
        };
    }

    if (page === "catalog") loadCatalog();

    if (page === "admin") loadAdminOrders();

    if (page === "booking") initBooking();

    if (page === "profile") loadProfile();
});

async function loadCatalog(search = "") {
    const grid = document.querySelector(".grid-layout"); if (!grid) return;
    const user = await checkAuth();

    if (user?.is_admin) {
        document.getElementById("admin-controls").innerHTML = `<button class="btn" style="margin-bottom:15px; width:200px;" onclick="openModal()">+ Добавить товар</button>`;
    }

    try {
        const items = await api("/api/catalog/?search=" + search);

        if (items.length === 0) {
            grid.innerHTML = `<p style="grid-column:1/-1; text-align:center;">Ничего не найдено</p>`;
            return;
        }

        grid.innerHTML = items.map(i => `
            <div class="card" style="position:relative;">
                ${user?.is_admin ? `<div style="position:absolute; top:5px; right:5px; z-index:10; display:flex; gap:5px; background:rgba(0,0,0,0.6); padding:5px; border-radius:5px;">
                    <span onclick='editItem(${i.item_id}, "${i.item_title}", "${(i.description||'').replace(/"/g, '&quot;')}", ${i.rent_price})' style="cursor:pointer;" title="Редактировать">✏️</span>
                    <span onclick="deleteItem(${i.item_id})" style="cursor:pointer; color:red; font-weight:bold;" title="Удалить">×</span>
                </div>` : ''}

                <div onclick='openBooking(${JSON.stringify(i).replace(/'/g, "&#39;")})' style="cursor:pointer; height:100%; display:flex; flex-direction:column;">
                    <img src="${i.image_url ? API_URL + i.image_url : 'https://via.placeholder.com/170x200'}" alt="${i.item_title}" style="pointer-events:none;">
                    <div class="card-bottom">
                        <span>${i.item_title}</span>
                        <span>${i.rent_price}₽/ч</span>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (err) {
        grid.innerHTML = `<p style="color:red;">Ошибка: ${err.message}</p>`;
    }
}

let editId = null;

async function loadBranchesForModal() {
    const select = document.getElementById("m-branches");
    if (!select) return;
    try {
        const branches = await api("/api/catalog/branches");
        select.innerHTML = branches.map(b => `
            <option value="${b.branch_id}">${b.city}, ${b.address}</option>
        `).join("");
    } catch (e) { console.log(e); }
}

function openModal() {
    editId = null;
    document.getElementById("modal-title").innerText = "Новый товар";
    document.getElementById("m-title").value = "";
    document.getElementById("m-desc").value = "";
    document.getElementById("m-price").value = "";
    document.getElementById("m-image").value = "";
    document.getElementById("m-preview").style.display = "none";
    loadBranchesForModal();
    document.getElementById("modal").style.display = "flex";
}

function editItem(id, title, desc, price) {
    editId = id;
    document.getElementById("modal-title").innerText = "Редактировать товар";
    document.getElementById("m-title").value = title;
    document.getElementById("m-desc").value = desc;
    document.getElementById("m-price").value = price;
    document.getElementById("m-image").value = "";
    document.getElementById("m-preview").style.display = "none";
    loadBranchesForModal();
    document.getElementById("modal").style.display = "flex";
}

async function saveItem() {
    let imageUrl = null;
    const fileInput = document.getElementById("m-image");

    if (fileInput.files.length > 0) {
        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        const res = await fetch(API_URL + "/api/admin/catalog/upload", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token()}` },
            body: formData
        });
        const uploadData = await res.json();
        imageUrl = uploadData.image_url;
    }

        const select = document.getElementById("m-branches");
    const selectedBranches = Array.from(select.selectedOptions).map(opt => parseInt(opt.value));

    const data = {
        item_title: document.getElementById("m-title").value,
        rent_price: parseFloat(document.getElementById("m-price").value),
        description: document.getElementById("m-desc").value,
        image_url: imageUrl,
        category: "Самокаты",
        branch_ids: selectedBranches
    };

    try {
        await api(editId ? `/api/admin/catalog/${editId}` : "/api/admin/catalog", {
            method: editId ? "PUT" : "POST",
            body: JSON.stringify(data)
        });
        document.getElementById("modal").style.display="none";
        loadCatalog();
    } catch (e) { alert(e.message); }
}

async function deleteItem(id) {
    if (confirm("Удалить товар?")) {
        await api(`/api/admin/catalog/${id}`, { method: "DELETE" });
        loadCatalog();
    }
}

document.addEventListener("change", (e) => {
    if (e.target.id === "m-image" && e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById("m-preview");
            preview.src = event.target.result;
            preview.style.display = "block";
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

function openBooking(item) {
    localStorage.setItem("b_item", JSON.stringify(item));
    window.location.href = "booking.html";
}

async function initBooking() {
    const item = JSON.parse(localStorage.getItem("b_item"));
    if (!item) return window.location.href = "catalog.html";

    document.getElementById("b-title").innerText = item.item_title;
    document.getElementById("b-desc").innerText = item.description || "Описание отсутствует";
    document.getElementById("b-price").innerText = item.rent_price + "₽/час";

    if (item.image_url) {
        document.getElementById("b-img-container").innerHTML = `<img src="${API_URL + item.image_url}" style="width:100%; height:100%; object-fit:cover;">`;
    }

    try {
        const branches = await api(`/api/catalog/item/${item.item_id}/branches`);
        const select = document.getElementById("b-branch");

        if (branches.length === 0) {
            select.innerHTML = `<option value="">Нет в наличии</option>`;
            const bookBtn = document.querySelector('button[onclick="confirmBooking()"]');
            bookBtn.disabled = true;
            bookBtn.innerText = "Нет в наличии";
            bookBtn.style.opacity = "0.5";
        } else {
            select.innerHTML = branches.map(b => `<option value="${b.branch_id}">${b.city}, ${b.address}</option>`).join("");
        }
    } catch (e) {
        console.error("Ошибка загрузки филиалов", e);
    }
}

async function confirmBooking() {
    const item = JSON.parse(localStorage.getItem("b_item"));
    const branchId = parseInt(document.getElementById("b-branch").value);
    const start = document.getElementById("b-start").value;
    const end = document.getElementById("b-end").value;

    if (!start || !end) return alert("Выберите даты!");
    if (new Date(start) >= new Date(end)) return alert("Дата возврата должна быть позже!");

    const data = {
        item_id: item.item_id,
        branch_id: branchId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        payment_method: document.querySelector('input[name="pay"]:checked').value,
        total_price: item.rent_price
    };

    try {
        await api("/api/orders/", { method: "POST", body: JSON.stringify(data) });
        alert("Успешно забронировано!");
        window.location.href = "catalog.html";
    } catch (err) {
        alert(err.message);
    }
}

async function loadAdminOrders() {
    const list = document.getElementById("admin-orders"); if (!list) return;
    try {
        const orders = await api("/api/admin/orders");

        const fDate = (iso) => iso ? new Date(iso).toLocaleString("ru-RU", {day: '2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : "—";

        list.innerHTML = orders.map(o => {
            let statusText = o.status === "pending" ? "Ожидает выдачи" : (o.status === "active" ? "Выдан" : "Завершен");
            let color = o.status === "pending" ? "orange" : (o.status === "active" ? "lightgreen" : "gray");

            let actionBtn = "";
            if (o.status === "pending") actionBtn = `<button class="btn" style="width:150px; background:#2a7b2a;" onclick="issueOrder(${o.order_id})">Выдать</button>`;
            else if (o.status === "active") actionBtn = `<button class="btn" style="width:150px; background:#7b6e0c;" onclick="returnOrder(${o.order_id})">Вернуть</button>`;

            return `
                <div style="background:#2a1f1f; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold; margin-bottom:5px;">Заказ #${o.order_id} — <span style="color:${color}">${statusText}</span></div>
                        <div style="font-size:12px; color:#aaa;">Клиент выбрал: ${fDate(o.start_time)} — ${fDate(o.end_time)}</div>
                        ${o.actual_start_time ? `<div style="font-size:12px; color:#fff;">Факт: Выдан ${fDate(o.actual_start_time)} | Возврат ${fDate(o.actual_return_time)}</div>` : ''}
                        ${o.fine > 0 ? `<div style="color:#ff4d4d; font-size:12px; margin-top:5px;">Штраф: ${o.fine}₽</div>` : ''}
                    </div>
                    <div>${actionBtn}</div>
                </div>
            `;
        }).join("") || "<p>Заявок нет</p>";
    } catch (e) {
        list.innerHTML = `<p style="color:red;">${e.message}</p>`;
    }
}

function getCurrentDateTimeLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function getCurrentDateTimeLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

async function issueOrder(id) {

    const timeStr = prompt("Введите дату и время выдачи (ГГГГ-ММ-ДДTЧЧ:ММ):", getCurrentDateTimeLocal());
    if (timeStr === null) return;

    try {

        await api(`/api/admin/orders/${id}/issue`, {
            method: "POST",
            body: JSON.stringify({ actual_start_time: timeStr })
        });

        loadAdminOrders();
    } catch (err) {
        alert("Ошибка сервера: " + err.message);
    }
}

async function returnOrder(id) {

    const timeStr = prompt("Введите дату и время возврата (ГГГГ-ММ-ДДTЧЧ:ММ):", getCurrentDateTimeLocal());
    if (timeStr === null) return;

    const fine = prompt("Введите сумму штрафа (если есть):", "0");
    if (fine === null) return;

    try {

        await api(`/api/admin/orders/${id}/return`, {
            method: "POST",
            body: JSON.stringify({
                actual_return_time: timeStr,
                fine_amount: parseFloat(fine) || 0
            })
        });
        loadAdminOrders();
    } catch (err) {
        alert("Ошибка сервера: " + err.message);
    }
}

async function loadProfile() {
    const user = await checkAuth();

    if (user && user.is_admin) {
        window.location.href = "admin.html";
        return;
    }

    if (!user) {
        window.location.href = "signIn.html";
        return;
    }

    document.getElementById("pf-name").value = user.name || "";
    document.getElementById("pf-lastname").value = user.lastname || "";
    document.getElementById("pf-fathername").value = user.fathername || "";
    document.getElementById("pf-phone").value = user.phone || "";
    document.getElementById("pf-email").value = user.email || "";
    document.getElementById("pf-city").value = user.city || "";

    const avatar = document.getElementById("pf-avatar");
    if (user.avatar_url) {
        avatar.src = API_URL + user.avatar_url;
    } else {
        avatar.style.display = "none";
    }

    try {
        const orders = await api("/api/orders/my");
        const list = document.getElementById("orders-list");

        if (orders.length === 0) {
            list.innerHTML = `<p style="color:#a8a8a8;">У вас нет заказов.</p>`;
        } else {
            list.innerHTML = orders.map(o => `
                <div class="order-item">
                    <span class="order-title">Заказ #${o.order_id}</span>
                    <span style="color:${o.status === 'pending' ? 'orange' : (o.status === 'active' ? 'lightgreen' : 'gray')}">
                        ${o.status === 'pending' ? 'Ожидает' : (o.status === 'active' ? 'Выдан' : 'Возвращен')}
                    </span>
                    ${o.fine > 0 ? `<span class="order-fine">Штраф: ${o.fine}₽</span>` : ''}
                </div>
            `).join("");
        }
    } catch (e) { console.error(e); }
}

async function saveProfile() {
    const data = {
        name: document.getElementById("pf-name").value,
        lastname: document.getElementById("pf-lastname").value,
        fathername: document.getElementById("pf-fathername").value,
        phone: document.getElementById("pf-phone").value,
        city: document.getElementById("pf-city").value,
    };
    try {
        await api("/api/auth/update", { method: "PATCH", body: JSON.stringify(data) });
        alert("Данные сохранены!");
        renderMenu();
    } catch (e) { alert(e.message); }
}

async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch(API_URL + "/api/auth/avatar", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token()}` },
            body: formData
        });
        if (!res.ok) throw new Error("Ошибка загрузки");
        const data = await res.json();
        document.getElementById("pf-avatar").src = API_URL + data.avatar_url;
        document.getElementById("pf-avatar").style.display = "block";
        alert("Фото обновлено!");
    } catch (e) { alert(e.message); }
}

async function addNewBranch() {
    const city = prompt("Введите город (например, Новосибирск):");
    if (!city) return;

    const address = prompt("Введите адрес (например, ул. Ленина, 10):");
    if (!address) return;

    try {
        await api("/api/admin/branches", {
            method: "POST",
            body: JSON.stringify({ city: city, address: address })
        });
        alert("Филиал успешно добавлен!");
    } catch (err) {
        alert("Ошибка при добавлении: " + err.message);
    }
}

function switchAdminTab(tab) {
    document.getElementById("section-orders").style.display = tab === "orders" ? "block" : "none";
    document.getElementById("section-admins").style.display = tab === "admins" ? "block" : "none";
    document.getElementById("section-branches").style.display = tab === "branches" ? "block" : "none";

    if (tab === "admins") {
        loadAdmins();
        loadBranchesForAdminForm();
    }
    if (tab === "branches") {
        loadBranchesList();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "admin") {
        const isSuper = localStorage.getItem("admin_role") === "super";
        if (isSuper) {
            document.getElementById("tab-btn-admins").style.display = "inline-block";
            document.getElementById("tab-btn-branches").style.display = "inline-block";
        }
    }
});

async function loadBranchesForAdminForm() {
    const select = document.getElementById("adm-branch");
    if (!select) return;
    try {
        const branches = await api("/api/catalog/branches");
        select.innerHTML = `<option value="">Без привязки к филиалу</option>` +
            branches.map(b => `<option value="${b.branch_id}">${b.city}, ${b.address}</option>`).join("");
    } catch (e) { console.log(e); }
}

async function loadAdmins() {
    const list = document.getElementById("admins-list");
    if (!list) return;
    try {
        const admins = await api("/api/admin/admins");
        list.innerHTML = admins.map(a => `
            <li style="padding:10px; background:#382d2d; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; cursor:pointer;" onclick="editAdmin(${a.admin_id}, '${a.name}', '${a.lastname}', '${a.email}', '${a.role}', ${a.branch_id || 'null'})">
                <div>
                    <div style="font-weight:bold;">${a.name} ${a.lastname}</div>
                    <div style="font-size:12px; color:#aaa;">${a.role}</div>
                </div>
                <button onclick="deleteAdmin(event, ${a.admin_id})" style="background:none; border:none; color:red; cursor:pointer; font-size:18px;">×</button>
            </li>
        `).join("");
    } catch (e) {
        list.innerHTML = `<p style="color:red;">Ошибка: ${e.message}</p>`;
    }
}

function resetAdminForm() {
    document.getElementById("admin-form-title").innerText = "Добавить сотрудника";
    document.getElementById("adm-id").value = "";
    document.getElementById("adm-name").value = "";
    document.getElementById("adm-lastname").value = "";
    document.getElementById("adm-email").value = "";
    document.getElementById("adm-pass").value = "";
    document.getElementById("adm-pass").placeholder = "Пароль";
    document.getElementById("adm-role").value = "junior";
    document.getElementById("adm-branch").value = "";
}

function editAdmin(id, name, lastname, email, role, branchId) {
    document.getElementById("admin-form-title").innerText = "Редактировать сотрудника";
    document.getElementById("adm-id").value = id;
    document.getElementById("adm-name").value = name;
    document.getElementById("adm-lastname").value = lastname;
    document.getElementById("adm-email").value = email;
    document.getElementById("adm-pass").value = "";
    document.getElementById("adm-pass").placeholder = "Оставьте пустым, чтобы не менять";
    document.getElementById("adm-role").value = role;
    document.getElementById("adm-branch").value = branchId || "";
}

async function saveAdmin() {
    const id = document.getElementById("adm-id").value;
    const branchVal = document.getElementById("adm-branch").value;

    const data = {
        name: document.getElementById("adm-name").value,
        lastname: document.getElementById("adm-lastname").value,
        email: document.getElementById("adm-email").value,
        role: document.getElementById("adm-role").value,
        branch_id: branchVal ? parseInt(branchVal) : null,
        password: document.getElementById("adm-pass").value || null
    };

    try {
        if (id) {
            await api(`/api/admin/admins/${id}`, { method: "PUT", body: JSON.stringify(data) });
        } else {
            if (!data.password) return alert("Пароль обязателен для нового сотрудника!");
            await api("/api/admin/admins", { method: "POST", body: JSON.stringify(data) });
        }
        resetAdminForm();
        loadAdmins();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteAdmin(event, id) {
    event.stopPropagation();
    if (!confirm("Вы уверены, что хотите удалить этого администратора?")) return;
    try {
        await api(`/api/admin/admins/${id}`, { method: "DELETE" });
        loadAdmins();
    } catch (e) {
        alert(e.message);
    }
}

async function loadBranchesList() {
    const list = document.getElementById("branches-list");
    if (!list) return;
    try {
        const branches = await api("/api/catalog/branches");
        list.innerHTML = branches.map(b => `
            <li style="padding:10px; background:#382d2d; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-weight:bold;">${b.city}</div>
                    <div style="font-size:12px; color:#aaa;">${b.address}</div>
                </div>
                <button onclick="deleteBranch(${b.branch_id})" style="background:none; border:none; color:red; cursor:pointer; font-size:18px;" title="Удалить">×</button>
            </li>
        `).join("");
    } catch (e) {
        list.innerHTML = `<p style="color:red;">Ошибка: ${e.message}</p>`;
    }
}

async function saveBranch() {
    const city = document.getElementById("br-city").value;
    const address = document.getElementById("br-address").value;

    if (!city || !address) return alert("Заполните город и адрес!");

    try {
        await api("/api/admin/branches", {
            method: "POST",
            body: JSON.stringify({ city: city, address: address })
        });
        document.getElementById("br-city").value = "";
        document.getElementById("br-address").value = "";
        loadBranchesList();
        loadBranchesForAdminForm();
        loadBranchesForModal();
    } catch (e) {
        alert(e.message);
    }
}

async function deleteBranch(id) {
    if (!confirm("Вы уверены, что хотите удалить филиал? Товары из него пропадут с витрины.")) return;
    try {
        await api(`/api/admin/branches/${id}`, { method: "DELETE" });
        loadBranchesList();
        loadBranchesForAdminForm();
        loadBranchesForModal();
    } catch (e) {
        alert(e.message);
    }
}