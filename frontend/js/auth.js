function saveSession(data) {
    if (!data.token || !data.user) {
        throw new Error('Dữ liệu đăng nhập không hợp lệ');
    }

    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('user', JSON.stringify(data.user));
}

function getToken() {
    return sessionStorage.getItem('token');
}

function getUser() {
    try {
        return JSON.parse(sessionStorage.getItem('user'));
    } catch {
        return null;
    }
}

function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.replace('index.html');
}

function redirectByRole() {
    const user = getUser();

    if (!user || !getToken()) {
        logout();
        return;
    }

    if (['super_admin', 'librarian'].includes(user.role)) {
        window.location.replace('admin.html');
    } else if (user.role === 'reader') {
        window.location.replace('reader.html');
    } else {
        logout();
    }
}

function requireAuth(allowedRoles = []) {
    const user = getUser();

    if (!getToken() || !user) {
        logout();
        return false;
    }

    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        redirectByRole();
        return false;
    }

    return true;
}