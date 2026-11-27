const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const passwordInput = document.getElementById('password');
const showPassword = document.getElementById('showPassword');

if (getToken() && getUser()) {
    redirectByRole();
}

showPassword.addEventListener('change', () => {
    passwordInput.type = showPassword.checked ? 'text' : 'password';
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value;

    loginMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Đang đăng nhập...';

    try {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username,
                password
            })
        });

        saveSession(data);
        redirectByRole();

    } catch (error) {
        loginMessage.textContent =
            error.message === 'Failed to fetch'
                ? 'Không thể kết nối đến máy chủ'
                : error.message;

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Đăng nhập';
    }
});