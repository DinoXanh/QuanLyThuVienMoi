let aiSearchVersion = 0;

function loadReaderAISearch(version) {
    if (version !== pageVersion) return;

    pageContent.innerHTML = `
        <section class="panel ai-search-panel">

            <span class="ai-label">
                AI SEMANTIC SEARCH
            </span>

            <h2>Tìm kiếm sách thông minh</h2>

            <p>
                Bạn không cần nhớ chính xác tên sách.
                Hãy mô tả nội dung hoặc kiến thức mà bạn muốn tìm.
            </p>

            <form id="aiSearchForm">

                <textarea id="aiSearchInput"
                    maxlength="500"
                    placeholder="Ví dụ: Tôi muốn học cách xây dựng website bằng HTML và JavaScript..."
                    required></textarea>

                <div class="ai-search-footer">

                    <span id="aiCharacterCount">
                        0 / 500 ký tự
                    </span>

                    <button type="submit"
                        class="btn-primary"
                        id="aiSearchButton">
                        Tìm kiếm AI
                    </button>

                </div>

            </form>

            <div class="ai-suggestions">

                <p>Gợi ý tìm kiếm:</p>

                <button class="btn-secondary ai-suggestion">
                    Học lập trình hướng đối tượng
                </button>

                <button class="btn-secondary ai-suggestion">
                    Thiết kế website responsive
                </button>

                <button class="btn-secondary ai-suggestion">
                    Tìm hiểu về cơ sở dữ liệu
                </button>

                <button class="btn-secondary ai-suggestion">
                    Introduction to Java programming
                </button>

            </div>

            <div class="ai-technology">
                Công nghệ: Multilingual E5 Small · PostgreSQL · pgvector
            </div>

        </section>

        <div id="aiSearchStatus"></div>

        <div id="aiBookGrid"
            class="reader-book-grid"></div>
    `;

    const input = document.getElementById('aiSearchInput');

    input.addEventListener('input', updateAICharacterCount);

    document.getElementById('aiSearchForm')
        .addEventListener('submit', performAISearch);

    document.querySelectorAll('.ai-suggestion')
        .forEach(button => {
            button.addEventListener('click', () => {
                input.value = button.textContent.trim();

                updateAICharacterCount();

                input.focus();
            });
        });

    document.getElementById('aiBookGrid')
        .addEventListener('click', handleReaderBookAction);
}

function updateAICharacterCount() {
    const input = document.getElementById('aiSearchInput');

    document.getElementById('aiCharacterCount')
        .textContent = `${input.value.length} / 500 ký tự`;
}

async function performAISearch(event) {
    event.preventDefault();

    const input = document.getElementById('aiSearchInput');
    const button = document.getElementById('aiSearchButton');
    const status = document.getElementById('aiSearchStatus');
    const grid = document.getElementById('aiBookGrid');

    const query = input.value.trim();

    if (!query) {
        status.innerHTML = `
            <div class="error-message">
                Vui lòng nhập nội dung cần tìm.
            </div>
        `;
        return;
    }

    const version = ++aiSearchVersion;

    button.disabled = true;
    button.textContent = 'Đang tìm kiếm...';

    grid.innerHTML = '';

    status.innerHTML = `
        <div class="panel ai-loading">

            <div class="ai-spinner"></div>

            <strong>AI đang tìm kiếm sách phù hợp...</strong>

            <p>
                Lần tìm kiếm đầu tiên có thể mất nhiều thời gian hơn.
            </p>

        </div>
    `;

    try {
        const params = new URLSearchParams({
            q: query,
            limit: '10'
        });

        const result = await apiRequest(
            `/search?${params.toString()}`
        );

        if (
            version !== aiSearchVersion ||
            !grid.isConnected
        ) return;

        const books = result.results || [];

        status.innerHTML = `
            <div class="ai-result-heading">

                <h3>Kết quả tìm kiếm</h3>

                <p>
                    Tìm thấy ${books.length} đầu sách phù hợp với
                    "${escapeHTML(query)}"
                </p>

            </div>
        `;

        renderReaderBookGrid(grid, books, true);

    } catch (error) {
        if (
            version !== aiSearchVersion ||
            !grid.isConnected
        ) return;

        status.innerHTML = `
            <div class="error-message">
                ${escapeHTML(error.message)}
            </div>
        `;

    } finally {
        if (
            version === aiSearchVersion &&
            button.isConnected
        ) {
            button.disabled = false;
            button.textContent = 'Tìm kiếm AI';
        }
    }
}