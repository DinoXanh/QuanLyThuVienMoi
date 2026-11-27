const API_URL = 'https://quanlythuvien-backend-r6lo.onrender.com/api';

async function apiRequest(endpoint, options = {}) {
    const token = sessionStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token && endpoint !== '/auth/login') {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && endpoint !== '/auth/login') {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        window.location.replace('index.html');
        throw new Error('Phiên đăng nhập đã hết hạn');
    }

    if (!response.ok) {
        throw new Error(data.message || 'Yêu cầu thất bại');
    }

    return data;
}