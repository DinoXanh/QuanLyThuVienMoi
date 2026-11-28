const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const passwordInput = document.getElementById('password');
const showPassword = document.getElementById('showPassword');

const registerForm = document.getElementById('registerForm');
const registerButton = document.getElementById('registerButton');
const regMessage = document.getElementById('regMessage');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const authTitle = document.getElementById('authTitle');
const authSubtitle = document.getElementById('authSubtitle');
const demoAccounts = document.getElementById('demoAccounts');

if (getToken() && getUser()) {
    redirectByRole();
}

function switchAuthMode(mode) {
    loginMessage.textContent = '';
    regMessage.textContent = '';
    regMessage.className = 'login-message';

    if (mode === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (demoAccounts) demoAccounts.style.display = 'none';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        authTitle.textContent = 'Đăng ký tài khoản';
        authSubtitle.textContent = 'Tạo tài khoản độc giả để mượn sách';
        document.getElementById('regUsername').focus();
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        if (demoAccounts) demoAccounts.style.display = 'block';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        authTitle.textContent = 'Chào mừng trở lại';
        authSubtitle.textContent = 'Cổng đăng nhập dành cho Độc giả và Thủ thư';
        document.getElementById('username').focus();
    }
}

showPassword.addEventListener('change', () => {
    passwordInput.type = showPassword.checked ? 'text' : 'password';
});

loginForm.addEventListener('submit', async event => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = passwordInput.value;

    loginMessage.className = 'login-message';
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
        loginButton.textContent = 'Đăng nhập hệ thống';
    }
});

registerForm.addEventListener('submit', async event => {
    event.preventDefault();

    const username = document.getElementById('regUsername').value.trim();
    const fullName = document.getElementById('regFullName').value.trim();
    const mssv = document.getElementById('regMssv').value.trim();
    const className = document.getElementById('regClass').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    regMessage.className = 'login-message';
    regMessage.textContent = '';

    if (password !== confirmPassword) {
        regMessage.textContent = 'Mật khẩu xác nhận không khớp!';
        return;
    }

    if (password.length < 6) {
        regMessage.textContent = 'Mật khẩu phải có ít nhất 6 ký tự!';
        return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Đang tạo tài khoản...';

    try {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username,
                full_name: fullName,
                mssv,
                class_name: className,
                password
            })
        });

        // Hiển thị thông báo thành công màu xanh
        regMessage.className = 'login-message success';
        regMessage.textContent = data.message || 'Đăng ký tài khoản độc giả thành công!';

        // Sau 1.5 giây, tự động chuyển về tab đăng nhập và điền sẵn username
        setTimeout(() => {
            switchAuthMode('login');
            document.getElementById('username').value = username;
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
            loginMessage.className = 'login-message success';
            loginMessage.textContent = 'Đăng ký thành công! Vui lòng nhập mật khẩu để đăng nhập.';
        }, 1500);

    } catch (error) {
        regMessage.className = 'login-message';
        regMessage.textContent =
            error.message === 'Failed to fetch'
                ? 'Không thể kết nối đến máy chủ'
                : error.message;

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Tạo tài khoản độc giả';
    }
});