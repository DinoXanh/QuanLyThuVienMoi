let adminUsers = [];

const userRoleLabels = {
    super_admin: 'Quản trị viên',
    librarian: 'Thủ thư',
    reader: 'Độc giả'
};

function canManageUser(user) {
    const currentUser = getUser();

    if (!currentUser) return false;

    if (user.role === 'super_admin') return false;

    if (Number(user.id) === Number(currentUser.id)) {
        return false;
    }

    return currentUser.role === 'super_admin' ||
        (
            currentUser.role === 'librarian' &&
            user.role === 'reader'
        );
}

async function loadUsers(version) {
    try {
        const users = await apiRequest('/users');

        if (version !== pageVersion) return;

        adminUsers = users;

        pageContent.innerHTML = `
            <div class="stats-grid">
                ${statCard('Tổng tài khoản', users.length)}

                ${statCard(
                    'Tài khoản độc giả',
                    users.filter(u => u.role === 'reader').length
                )}

                ${statCard(
                    'Đang hoạt động',
                    users.filter(u => u.is_active).length,
                    'success'
                )}

                ${statCard(
                    'Đã bị khóa',
                    users.filter(u => !u.is_active).length,
                    'danger'
                )}
            </div>

            <div class="toolbar">
                <div class="toolbar-filters">

                    <input type="search"
                        id="userSearch"
                        class="search-input"
                        placeholder="Tìm họ tên, tài khoản, MSSV...">

                    <select id="userRoleFilter">
                        <option value="">Tất cả quyền</option>
                        <option value="super_admin">Quản trị viên</option>
                        <option value="librarian">Thủ thư</option>
                        <option value="reader">Độc giả</option>
                    </select>

                    <select id="userStatusFilter">
                        <option value="">Tất cả trạng thái</option>
                        <option value="active">Hoạt động</option>
                        <option value="locked">Đã khóa</option>
                    </select>

                </div>

                <button class="btn-primary"
                    id="addUserButton">
                    Tạo tài khoản
                </button>
            </div>

            <div id="userTable"></div>
        `;

        document.getElementById('userSearch')
            .addEventListener('input', renderUserTable);

        document.getElementById('userRoleFilter')
            .addEventListener('change', renderUserTable);

        document.getElementById('userStatusFilter')
            .addEventListener('change', renderUserTable);

        document.getElementById('addUserButton')
            .addEventListener('click', openCreateUserForm);

        document.getElementById('userTable')
            .addEventListener('click', handleUserAction);

        renderUserTable();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderUserTable() {
    const table = document.getElementById('userTable');

    if (!table) return;

    const search = document.getElementById('userSearch')
        .value.trim().toLowerCase();

    const role = document.getElementById('userRoleFilter').value;

    const status = document.getElementById('userStatusFilter').value;

    const users = adminUsers.filter(user => {
        const content = [
            user.full_name,
            user.username,
            user.mssv,
            user.class_name
        ].join(' ').toLowerCase();

        const matchSearch = content.includes(search);

        const matchRole = !role || user.role === role;

        const matchStatus =
            !status ||
            (status === 'active' && user.is_active) ||
            (status === 'locked' && !user.is_active);

        return matchSearch && matchRole && matchStatus;
    });

    if (!users.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy tài khoản.
            </div>
        `;
        return;
    }

    table.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Tên đăng nhập</th>
                        <th>Họ và tên</th>
                        <th>MSSV</th>
                        <th>Lớp</th>
                        <th>Quyền</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${users.map(user => `
                        <tr>
                            <td>${Number(user.id)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(user.username)}
                                </strong>
                            </td>

                            <td>${escapeHTML(user.full_name)}</td>

                            <td>${escapeHTML(user.mssv || '—')}</td>

                            <td>${escapeHTML(user.class_name || '—')}</td>

                            <td>
                                ${escapeHTML(userRoleLabels[user.role])}
                            </td>

                            <td>
                                <span class="status-badge
                                    ${user.is_active
                                        ? 'status-success'
                                        : 'status-danger'}">

                                    ${user.is_active
                                        ? 'Hoạt động'
                                        : 'Đã khóa'}

                                </span>
                            </td>

                            <td>
                                <div class="action-group">

                                    <button class="btn-view"
                                        data-action="view"
                                        data-id="${Number(user.id)}">
                                        Xem
                                    </button>

                                    ${canManageUser(user) ? `
                                        <button class="btn-edit"
                                            data-action="password"
                                            data-id="${Number(user.id)}">
                                            Đổi mật khẩu
                                        </button>

                                        <button class="${user.is_active
                                            ? 'btn-danger'
                                            : 'btn-secondary'}"
                                            data-action="status"
                                            data-id="${Number(user.id)}">

                                            ${user.is_active
                                                ? 'Khóa'
                                                : 'Mở khóa'}

                                        </button>
                                    ` : ''}

                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function handleUserAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button || button.disabled) return;

    const user = adminUsers.find(
        item => Number(item.id) === Number(button.dataset.id)
    );

    if (!user) return;

    switch (button.dataset.action) {
        case 'view':
            viewUser(user);
            break;

        case 'password':
            if (canManageUser(user)) {
                openResetPasswordForm(user);
            }
            break;

        case 'status':
            if (canManageUser(user)) {
                changeUserStatus(user);
            }
            break;
    }
}

function userDetailRow(label, value) {
    return `
        <div class="detail-row">
            <strong>${escapeHTML(label)}</strong>
            <span>${escapeHTML(value || '—')}</span>
        </div>
    `;
}

function viewUser(user) {
    openModal(
        'Thông tin tài khoản',
        `
            ${userDetailRow('Tên đăng nhập', user.username)}
            ${userDetailRow('Họ và tên', user.full_name)}
            ${userDetailRow('MSSV', user.mssv)}
            ${userDetailRow('Lớp', user.class_name)}

            ${userDetailRow(
                'Quyền',
                userRoleLabels[user.role]
            )}

            ${userDetailRow(
                'Trạng thái',
                user.is_active ? 'Hoạt động' : 'Đã khóa'
            )}

            ${userDetailRow(
                'Ngày tạo',
                user.created_at
                    ? new Date(user.created_at).toLocaleString('vi-VN')
                    : '—'
            )}
        `,
        `
            <button class="btn-secondary"
                id="closeUserDetail">
                Đóng
            </button>
        `
    );

    document.getElementById('closeUserDetail')
        .addEventListener('click', closeModal);
}

function openCreateUserForm() {
    const currentUser = getUser();

    openModal(
        'Tạo tài khoản mới',
        `
            <form id="createUserForm">

                <div class="form-grid">

                    <div class="form-group full-width">
                        <label for="newFullName">
                            Họ và tên *
                        </label>

                        <input id="newFullName"
                            maxlength="100"
                            required>
                    </div>

                    <div class="form-group">
                        <label for="newUsername">
                            Tên đăng nhập *
                        </label>

                        <input id="newUsername"
                            maxlength="50"
                            autocomplete="off"
                            required>
                    </div>

                    <div class="form-group">
                        <label for="newRole">
                            Quyền tài khoản *
                        </label>

                        <select id="newRole">
                            <option value="reader">
                                Độc giả
                            </option>

                            ${currentUser.role === 'super_admin' ? `
                                <option value="librarian">
                                    Thủ thư
                                </option>
                            ` : ''}
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="newPassword">
                            Mật khẩu *
                        </label>

                        <input type="password"
                            id="newPassword"
                            minlength="8"
                            autocomplete="new-password"
                            required>
                    </div>

                    <div class="form-group">
                        <label for="confirmNewPassword">
                            Xác nhận mật khẩu *
                        </label>

                        <input type="password"
                            id="confirmNewPassword"
                            autocomplete="new-password"
                            required>
                    </div>

                    <div class="form-group reader-field">
                        <label for="newMssv">
                            MSSV *
                        </label>

                        <input id="newMssv"
                            maxlength="20"
                            required>
                    </div>

                    <div class="form-group reader-field">
                        <label for="newClassName">
                            Lớp *
                        </label>

                        <input id="newClassName"
                            maxlength="50"
                            required>
                    </div>

                </div>

                <p class="form-message"
                    id="createUserMessage"
                    role="alert"></p>

            </form>
        `,
        `
            <button class="btn-secondary"
                id="cancelCreateUser">
                Hủy
            </button>

            <button type="submit"
                form="createUserForm"
                class="btn-primary"
                id="saveUserButton">
                Tạo tài khoản
            </button>
        `
    );

    document.getElementById('newRole')
        .addEventListener('change', updateReaderFields);

    document.getElementById('cancelCreateUser')
        .addEventListener('click', closeModal);

    document.getElementById('createUserForm')
        .addEventListener('submit', createUser);

    updateReaderFields();
}

function updateReaderFields() {
    const isReader =
        document.getElementById('newRole').value === 'reader';

    document.querySelectorAll('.reader-field')
        .forEach(field => {
            field.classList.toggle('hidden', !isReader);

            const input = field.querySelector('input');

            input.required = isReader;
            input.disabled = !isReader;
        });
}

function isValidUserPassword(password) {
    return password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[a-z]/.test(password) &&
        /[0-9]/.test(password) &&
        new TextEncoder().encode(password).length <= 72;
}

async function createUser(event) {
    event.preventDefault();

    const button = document.getElementById('saveUserButton');
    const message = document.getElementById('createUserMessage');
    const modal = document.getElementById('modalOverlay');

    const role = document.getElementById('newRole').value;

    const password = document.getElementById('newPassword').value;

    const confirmation = document
        .getElementById('confirmNewPassword').value;

    const data = {
        username: document.getElementById('newUsername').value.trim(),
        full_name: document.getElementById('newFullName').value.trim(),
        password,
        role
    };

    if (role === 'reader') {
        data.mssv = document.getElementById('newMssv').value.trim();

        data.class_name = document
            .getElementById('newClassName').value.trim();
    }

    if (
        !data.username ||
        !data.full_name ||
        (role === 'reader' && (!data.mssv || !data.class_name))
    ) {
        message.textContent = 'Vui lòng nhập đầy đủ thông tin.';
        return;
    }

    if (!isValidUserPassword(password)) {
        message.textContent =
            'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số, tối đa 72 byte.';
        return;
    }

    if (password !== confirmation) {
        message.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang tạo...';
    message.textContent = '';

    try {
        const result = await apiRequest('/users', {
            method: 'POST',
            body: JSON.stringify(data)
        });

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Tạo tài khoản thành công');

        if (currentPage === 'users') {
            await navigateTo('users');
        }

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = 'Tạo tài khoản';
    }
}

async function changeUserStatus(user) {
    if (!canManageUser(user)) return;

    const newStatus = !user.is_active;

    const action = newStatus ? 'mở khóa' : 'khóa';

    if (!confirm(
        `Bạn có chắc muốn ${action} tài khoản "${user.username}"?`
    )) {
        return;
    }

    const buttons = document.querySelectorAll('#userTable button');

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await apiRequest(
            `/users/${user.id}/status`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    is_active: newStatus
                })
            }
        );

        alert(result.message || 'Cập nhật trạng thái thành công');

        if (currentPage === 'users') {
            await navigateTo('users');
        }

    } catch (error) {
        alert(error.message);

    } finally {
        buttons.forEach(button => {
            button.disabled = false;
        });
    }
}

function openResetPasswordForm(user) {
    if (!canManageUser(user)) return;

    openModal(
        'Đặt lại mật khẩu',
        `
            ${userDetailRow('Tài khoản', user.username)}
            ${userDetailRow('Họ và tên', user.full_name)}

            <form id="resetPasswordForm">

                <div class="form-group">
                    <label for="resetPassword">
                        Mật khẩu mới *
                    </label>

                    <input type="password"
                        id="resetPassword"
                        minlength="8"
                        autocomplete="new-password"
                        required>
                </div>

                <div class="form-group">
                    <label for="confirmResetPassword">
                        Xác nhận mật khẩu *
                    </label>

                    <input type="password"
                        id="confirmResetPassword"
                        autocomplete="new-password"
                        required>
                </div>

                <p class="capacity-note">
                    Sau khi đặt lại mật khẩu, các phiên đăng nhập
                    cũ của tài khoản sẽ hết hiệu lực.
                </p>

                <p class="form-message"
                    id="resetPasswordMessage"
                    role="alert"></p>

            </form>
        `,
        `
            <button class="btn-secondary"
                id="cancelResetPassword">
                Hủy
            </button>

            <button type="submit"
                form="resetPasswordForm"
                class="btn-primary"
                id="saveResetPassword">
                Lưu mật khẩu
            </button>
        `
    );

    document.getElementById('cancelResetPassword')
        .addEventListener('click', closeModal);

    document.getElementById('resetPasswordForm')
        .addEventListener('submit', event => {
            resetUserPassword(event, user.id);
        });
}

async function resetUserPassword(event, id) {
    event.preventDefault();

    const password = document.getElementById('resetPassword').value;

    const confirmation = document
        .getElementById('confirmResetPassword').value;

    const message = document.getElementById('resetPasswordMessage');
    const button = document.getElementById('saveResetPassword');
    const modal = document.getElementById('modalOverlay');

    if (!isValidUserPassword(password)) {
        message.textContent =
            'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ thường và số, tối đa 72 byte.';
        return;
    }

    if (password !== confirmation) {
        message.textContent = 'Mật khẩu xác nhận không khớp.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang lưu...';
    message.textContent = '';

    try {
        const result = await apiRequest(
            `/users/${id}/password`,
            {
                method: 'PATCH',
                body: JSON.stringify({ password })
            }
        );

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Đặt lại mật khẩu thành công');

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = 'Lưu mật khẩu';
    }
}