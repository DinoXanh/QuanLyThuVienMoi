function applyTheme() {
    const darkMode = localStorage.getItem('theme') === 'dark';

    document.body.classList.toggle('dark-mode', darkMode);

    const button = document.getElementById('themeToggle');

    if (button) {
        button.textContent = darkMode ? 'Chế độ sáng' : 'Chế độ tối';
    }
}

function toggleTheme() {
    const darkMode = document.body.classList.contains('dark-mode');

    localStorage.setItem('theme', darkMode ? 'light' : 'dark');

    applyTheme();
}

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();

    document.getElementById('themeToggle')
        ?.addEventListener('click', toggleTheme);
});
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function closeModal() {
    document.getElementById('modalOverlay')?.remove();
}

function openModal(title, content, footer = '') {
    closeModal();

    const overlay = document.createElement('div');

    overlay.id = 'modalOverlay';
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
        <section class="modal" role="dialog"
            aria-modal="true" aria-labelledby="modalTitle">

            <div class="modal-header">
                <h3 id="modalTitle">${escapeHTML(title)}</h3>
                <button type="button" class="modal-close"
                    aria-label="Đóng">&times;</button>
            </div>

            <div class="modal-body">
                ${content}
            </div>

            ${footer ? `
                <div class="modal-footer">
                    ${footer}
                </div>
            ` : ''}

        </section>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.modal-close')
        .addEventListener('click', closeModal);

    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            closeModal();
        }
    });

    overlay.querySelector('.modal-close').focus();
}

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        closeModal();
    }
});