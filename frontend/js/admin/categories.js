let adminCategories = [];

async function loadCategories(version) {
    try {
        const data = await apiRequest('/categories');

        if (version !== pageVersion) return;

        adminCategories = data;

        pageContent.innerHTML = `
            <div class="toolbar">
                <div class="toolbar-filters">
                    <input type="search"
                        id="categorySearch"
                        class="search-input"
                        placeholder="Tìm kiếm danh mục...">
                </div>

                <button class="btn-primary" id="addCategoryButton">
                    Thêm danh mục
                </button>
            </div>

            <div id="categoryTable"></div>
        `;

        document.getElementById('categorySearch')
            .addEventListener('input', renderCategoryTable);

        document.getElementById('addCategoryButton')
            .addEventListener('click', () => openCategoryForm());

        document.getElementById('categoryTable')
            .addEventListener('click', handleCategoryAction);

        renderCategoryTable();

    } catch (error) {
        if (version !== pageVersion) return;

        pageContent.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;
    }
}

function renderCategoryTable() {
    const table = document.getElementById('categoryTable');

    if (!table) return;

    const search = document.getElementById('categorySearch')
        .value.trim().toLowerCase();

    const categories = adminCategories.filter(category =>
        category.name.toLowerCase().includes(search)
    );

    if (!categories.length) {
        table.innerHTML = `
            <div class="panel empty-message">
                Không tìm thấy danh mục.
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
                        <th>Tên danh mục</th>
                        <th>Mô tả</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>

                <tbody>
                    ${categories.map(category => `
                        <tr>
                            <td>${Number(category.id)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(category.name)}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(category.description || 'Chưa cập nhật')}
                            </td>

                            <td>
                                <div class="action-group">
                                    <button class="btn-edit"
                                        data-action="edit"
                                        data-id="${Number(category.id)}">
                                        Sửa
                                    </button>

                                    <button class="btn-danger"
                                        data-action="delete"
                                        data-id="${Number(category.id)}">
                                        Xóa
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function handleCategoryAction(event) {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    const id = Number(button.dataset.id);

    const category = adminCategories.find(
        item => Number(item.id) === id
    );

    if (!category) return;

    if (button.dataset.action === 'edit') {
        openCategoryForm(category);
    }

    if (button.dataset.action === 'delete') {
        deleteCategory(category);
    }
}

function openCategoryForm(category = null) {
    const editing = Boolean(category);

    openModal(
        editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục',
        `
            <form id="categoryForm">

                <div class="form-group">
                    <label for="categoryName">
                        Tên danh mục *
                    </label>

                    <input id="categoryName"
                        maxlength="100"
                        value="${escapeHTML(category?.name)}"
                        required>
                </div>

                <div class="form-group">
                    <label for="categoryDescription">
                        Mô tả
                    </label>

                    <textarea id="categoryDescription">${escapeHTML(category?.description)}</textarea>
                </div>

                <p class="form-message"
                    id="categoryFormMessage"
                    role="alert"></p>

            </form>
        `,
        `
            <button class="btn-secondary"
                id="cancelCategoryButton">
                Hủy
            </button>

            <button type="submit"
                form="categoryForm"
                class="btn-primary"
                id="saveCategoryButton">
                ${editing ? 'Lưu thay đổi' : 'Thêm danh mục'}
            </button>
        `
    );

    document.getElementById('cancelCategoryButton')
        .addEventListener('click', closeModal);

    document.getElementById('categoryForm')
        .addEventListener('submit', event => {
            saveCategory(event, category?.id);
        });
}

async function saveCategory(event, id) {
    event.preventDefault();

    const button = document.getElementById('saveCategoryButton');
    const message = document.getElementById('categoryFormMessage');
    const modal = document.getElementById('modalOverlay');

    const data = {
        name: document.getElementById('categoryName').value.trim(),
        description: document.getElementById('categoryDescription').value.trim()
    };

    if (!data.name) {
        message.textContent = 'Vui lòng nhập tên danh mục.';
        return;
    }

    button.disabled = true;
    button.textContent = 'Đang lưu...';
    message.textContent = '';

    try {
        const result = await apiRequest(
            id ? `/categories/${id}` : '/categories',
            {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(data)
            }
        );

        if (modal.isConnected) {
            closeModal();
        }

        alert(result.message || 'Lưu danh mục thành công');

        if (currentPage === 'categories') {
            await navigateTo('categories');
        }

    } catch (error) {
        message.textContent = error.message;

    } finally {
        button.disabled = false;
        button.textContent = id ? 'Lưu thay đổi' : 'Thêm danh mục';
    }
}

async function deleteCategory(category) {
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${category.name}"?`)) {
        return;
    }

    try {
        const result = await apiRequest(
            `/categories/${category.id}`,
            {
                method: 'DELETE'
            }
        );

        alert(result.message || 'Xóa danh mục thành công');

        if (currentPage === 'categories') {
            await navigateTo('categories');
        }

    } catch (error) {
        alert(error.message);
    }
}