//---------------------------------------------------------
// CONFIG
//---------------------------------------------------------
const BOOKS_PATH = "books";
let currentBook = null;
let currentBookData = [];
let currentPage = 0;
let currentLang = "en";
let currentBookMeta = {};

//---------------------------------------------------------
// DOM ELEMENTS
//---------------------------------------------------------
const categoryMenu = document.getElementById("category-menu");
const bookContainerAr = document.getElementById("book-ar");
const bookContainerEn = document.getElementById("book-en");
const metaContainer = document.getElementById("book-meta");
const pagination = document.getElementById("book-pagination");

const toggleLangBtn = document.getElementById("toggleLang");
const toggleArBtn = document.getElementById("toggleLangAr");
const toggleEnBtn = document.getElementById("toggleLangEn");

// NEW UI ELEMENTS (you must add these to HTML)
// <input id="categorySearch" placeholder="Search categories or books...">
// <button id="toggleAllCats">Show / Hide All</button>
const categorySearch = document.getElementById("categorySearch");
const toggleAllCatsBtn = document.getElementById("toggleAllCats");

// hide initial containers
bookContainerAr.style.display = "none";
bookContainerEn.style.display = "none";
metaContainer.style.display = "none";
pagination.style.display = "none";

//---------------------------------------------------------
// LOAD BOOK INDEX
//---------------------------------------------------------
let GLOBAL_BOOK_INDEX = [];

async function loadBooksIndex() {
    try {
        const res = await fetch(`${BOOKS_PATH}/books_index.json`);
        GLOBAL_BOOK_INDEX = await res.json();
        buildMenu(GLOBAL_BOOK_INDEX);
    } catch (err) {
        categoryMenu.innerHTML = `<p style="color:red;">Error loading index: ${err}</p>`;
    }
}

//---------------------------------------------------------
// COLOR GENERATOR FOR BOOK TITLES
//---------------------------------------------------------
function getColorForString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue},70%,50%)`;
}

//---------------------------------------------------------
// MENU BUILDER (NOW WITH SORTING & SEARCH)
//---------------------------------------------------------
function buildMenu(index) {
    const categories = {};
    const categoryCounts = {};

    // STEP 1: Prepare categories
    index.forEach(book => {
        const catName = currentLang === "en" ? book.category_en : book.category_ar;

        if (!categories[catName]) {
            categories[catName] = [];
            categoryCounts[catName] = 0;
        }

        categoryCounts[catName]++;
        categories[catName].push(book);
    });

    // STEP 2: SORT CATEGORIES A-Z
    const sortedCategories = Object.keys(categories).sort((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" })
    );

    // STEP 3: Build HTML
    let html = "<ul>";

    sortedCategories.forEach(cat => {
        const books = categories[cat];

        // sort book titles A–Z
        books.sort((a, b) => {
            const tA = currentLang === "en" ? a.book_title_en : a.book_title_ar;
            const tB = currentLang === "en" ? b.book_title_en : b.book_title_ar;
            return tA.localeCompare(tB, "en", { sensitivity: "base" });
        });

        html += `
        <li class="category">
            <span class="cat-title" onclick="toggleCategory(this)">
                ${cat} (${categoryCounts[cat]})
            </span>
            <ul class="books-list">
        `;

        books.forEach(book => {
            const title = currentLang === "en" ? book.book_title_en : book.book_title_ar;
            const color = getColorForString(title);

            html += `
                <li>
                    <a href="#" 
                       style="color:${color};font-weight:600;"
                       onclick="loadBook('${book.book_id}'); return false;">
                       ${title}
                    </a>
                </li>`;
        });

        html += "</ul></li>";
    });

    html += "</ul>";
    categoryMenu.innerHTML = html;
}

//---------------------------------------------------------
// SEARCH FUNCTION (CATEGORIES + BOOK TITLES)
//---------------------------------------------------------
categorySearch.addEventListener("input", () => {
    const query = categorySearch.value.toLowerCase();
    const cats = categoryMenu.querySelectorAll(".category");

    cats.forEach(cat => {
        const catTitle = cat.querySelector(".cat-title").textContent.toLowerCase();
        const bookItems = cat.querySelectorAll("li a");

        let showCat = catTitle.includes(query);
        let bookMatch = false;

        bookItems.forEach(book => {
            const matches = book.textContent.toLowerCase().includes(query);
            book.parentElement.style.display = matches ? "" : "none";
            if (matches) bookMatch = true;
        });

        cat.style.display = showCat || bookMatch ? "" : "none";
    });
});

//---------------------------------------------------------
// SHOW / HIDE ALL CATEGORIES BUTTON
//---------------------------------------------------------
toggleAllCatsBtn.addEventListener("click", () => {
    const lists = categoryMenu.querySelectorAll(".books-list");

    const allClosed = [...lists].every(l => l.style.display === "none");

    lists.forEach(list => {
        list.style.display = allClosed ? "block" : "none";
    });
});

//---------------------------------------------------------
// EXPAND SINGLE CATEGORY
//---------------------------------------------------------
function toggleCategory(elem) {
    const list = elem.nextElementSibling;
    list.style.display = list.style.display === "block" ? "none" : "block";
}

//---------------------------------------------------------
// LOAD BOOK
//---------------------------------------------------------
async function loadBook(bookId) {
    currentBook = bookId;
    currentPage = 0;

    try {
        const resAr = await fetch(`${BOOKS_PATH}/book_${bookId}_ar.json`);
        const resEn = await fetch(`${BOOKS_PATH}/book_${bookId}_en.json`);

        const ar = await resAr.json();
        const en = await resEn.json();

        // META
        currentBookMeta = {
            book_title_ar: ar[0]?.book_title || "",
            book_title_en: en[0]?.book_title || "",
            author_ar: ar[0]?.author_name || "",
            author_en: en[0]?.author_name || "",
            author_year: ar[0]?.author_year || "",
            edition: ar[1]?.edition || "",
            publisher: ar[1]?.publisher || "",
            book_id: bookId
        };

        // CLEAN ENGLISH DUPLICATES
        const cleanedEn = [];
        const seen = new Set();
        en.forEach(e => {
            const p = e.new_page_number || e.page_number;
            if (!seen.has(p)) {
                cleanedEn.push(e);
                seen.add(p);
            }
        });

        // MERGE AR + EN
        currentBookData = ar.map((a, i) => {
            const e = cleanedEn[i] || {};
            return {
                text_ar: splitParagraphs(a.text),
                foot_ar: a.foot_note,
                page_ar: a.new_page_number || a.page_number,
                text_en: splitParagraphs(e.text),
                foot_en: e.foot_note,
                page_en: e.new_page_number || e.page_number
            };
        });

        bookContainerAr.style.display = "";
        bookContainerEn.style.display = "";
        metaContainer.style.display = "";
        pagination.style.display = "";

        renderBook();

    } catch (err) {
        bookContainerAr.innerHTML = `<p>Error: ${err}</p>`;
        bookContainerEn.innerHTML = `<p>Error: ${err}</p>`;
    }
}

//---------------------------------------------------------
// PARAGRAPH SPLITTER
//---------------------------------------------------------
function splitParagraphs(text) {
    if (!text) return [];
    return text
        .replace(/\n+/g, "\n")
        .split(/\.\s+|\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

//---------------------------------------------------------
// RENDER PAGE
//---------------------------------------------------------
function renderBook() {
    if (!currentBookData.length) return;
    const e = currentBookData[currentPage];

    // META
    if (currentPage > 0) {
        metaContainer.innerHTML = `
            <h2>${currentLang === "en" ? currentBookMeta.book_title_en : currentBookMeta.book_title_ar}</h2>
            <p><strong>Edition:</strong> ${currentBookMeta.edition}</p>
            <p><strong>Publisher:</strong> ${currentBookMeta.publisher}</p>
            <p><strong>Book ID:</strong> ${currentBookMeta.book_id}</p>
        `;
    } else metaContainer.innerHTML = "";

    // ENGLISH
    let enHtml = "";
    if (currentPage === 0) {
        enHtml = `
            <div class="book-text book-title-page">
                <div class="title">${currentBookMeta.book_title_en}</div>
                ${currentBookMeta.author_en ? `<div class="author">${currentBookMeta.author_en}</div>` : ""}
                ${currentBookMeta.author_year ? `<div class="author-year">Year of Death: ${currentBookMeta.author_year}</div>` : ""}
            </div>`;
    } else {
        const enParas = e.text_en.map(p => `<p class="en-para">${p}</p>`).join("");
        const enFoot = e.foot_en && e.foot_en !== "None"
            ? `<div class="book-footnote"><strong>Foot Note:</strong> ${e.foot_en}</div>`
            : "";
        enHtml = `
            <div class="book-text">${enParas}</div>
            ${enFoot}
            <div style="text-align:center;margin-top:10px;">Page: ${e.page_en || ""}</div>`;
    }
    bookContainerEn.innerHTML = enHtml;

    // ARABIC
    let arHtml = "";
    if (currentPage === 0) {
        arHtml = `
            <div class="book-text book-title-page ar-text">
                <div class="title">${currentBookMeta.book_title_ar}</div>
                ${currentBookMeta.author_ar ? `<div class="author">${currentBookMeta.author_ar}</div>` : ""}
                ${currentBookMeta.author_year ? `<div class="author-year">سنة الوفاة: ${currentBookMeta.author_year}</div>` : ""}
            </div>`;
    } else {
        const arParas = e.text_ar.map(p => `<p class="ar-para">${p}</p>`).join("");
        const arFoot = e.foot_ar && e.foot_ar !== "None"
            ? `<div class="book-footnote"><strong>Foot Note:</strong> ${e.foot_ar}</div>`
            : "";
        arHtml = `
            <div class="book-text ar-text">${arParas}</div>
            ${arFoot}
            <div style="text-align:center;margin-top:10px;">Page: ${e.page_ar || ""}</div>`;
    }
    bookContainerAr.innerHTML = arHtml;

    updateColumnLayout();
    renderPagination();
}

//---------------------------------------------------------
// PAGINATION
//---------------------------------------------------------
function renderPagination() {
    const total = currentBookData.length;
    let pageOptions = "";

    for (let i = 0; i < total; i++) {
        let label = i === 0 ? "Title" : i === 1 ? "Data" : (i + 1);
        pageOptions += `<option value="${i}" ${i === currentPage ? "selected" : ""}>${label}</option>`;
    }

    pagination.innerHTML = `
        <button onclick="goPage(0)" ${currentPage === 0 ? "disabled" : ""}>First</button>
        <button onclick="goPage(${currentPage - 1})" ${currentPage === 0 ? "disabled" : ""}>Prev</button>

        Page <select id="pageJump">${pageOptions}</select> of ${total}

        <button onclick="goPage(${currentPage + 1})" ${currentPage === total - 1 ? "disabled" : ""}>Next</button>
        <button onclick="goPage(${total - 1})" ${currentPage === total - 1 ? "disabled" : ""}>Last</button>
    `;

    document.getElementById("pageJump").addEventListener("change", e => {
        goPage(parseInt(e.target.value));
    });
}

//---------------------------------------------------------
// UPDATE LAYOUT
//---------------------------------------------------------
function updateColumnLayout() {
    const container = document.getElementById("book-container");
    const arHidden = bookContainerAr.classList.contains("hidden");
    const enHidden = bookContainerEn.classList.contains("hidden");

    container.style.gridTemplateColumns = (!arHidden && !enHidden) ? "1fr 1fr" : "1fr";
}

//---------------------------------------------------------
// PAGE CHANGE
//---------------------------------------------------------
function goPage(index) {
    if (index < 0 || index >= currentBookData.length) return;
    currentPage = index;
    renderBook();
}

//---------------------------------------------------------
// TOGGLE LANGUAGE PANELS
//---------------------------------------------------------
toggleArBtn.textContent = "Hide Arabic";
toggleEnBtn.textContent = "Hide English";

toggleArBtn.addEventListener("click", () => {
    bookContainerAr.classList.toggle("hidden");
    updateColumnLayout();
});

toggleEnBtn.addEventListener("click", () => {
    bookContainerEn.classList.toggle("hidden");
    updateColumnLayout();
});

//---------------------------------------------------------
// CHANGE MENU LANGUAGE
//---------------------------------------------------------
toggleLangBtn.addEventListener("click", () => {
    currentLang = currentLang === "ar" ? "en" : "ar";
    buildMenu(GLOBAL_BOOK_INDEX);
});

//---------------------------------------------------------
// INIT
//---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadBooksIndex();
});