/**
 * ADUKE ALAGBO - DEDICATED SHOP PAGE CONTROLLER
 * ================================================
 * Handles sidebar filtering, price ranges, search, sort,
 * and category counters on shop.html.
 */

(function () {
  "use strict";

  // Additional filter state for shop page
  const shopFilterState = {
    selectedCategory: "all",
    searchQuery: "",
    priceRange: "all",
    sortBy: "featured"
  };

  // Helper currency format
  function formatNaira(num) {
    return "₦" + Number(num).toLocaleString("en-NG");
  }

  // Dynamically render sidebar categories with live counters
  function renderSidebarCategories() {
    const list = document.getElementById("sidebarCategoryList");
    if (!list) return;

    const categories = typeof getStoreCategories === "function" 
      ? getStoreCategories(true) 
      : [
          { id: "all", label: "All Remedies", icon: "🌱" },
          { id: "agbo", label: "Agbo & Tonics", icon: "🏺" },
          { id: "men", label: "Men's Vitality", icon: "⚡" },
          { id: "women", label: "Women's Wellness", icon: "🌸" },
          { id: "raw", label: "Raw Roots & Spices", icon: "🪵" },
          { id: "wellness", label: "Immunity & Detox", icon: "🛡️" }
        ];

    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;

    const counts = { all: products.length };
    categories.forEach(c => {
      if (c.id !== "all") counts[c.id] = 0;
    });

    products.forEach(p => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });

    list.innerHTML = categories.map(cat => {
      const count = counts[cat.id] || 0;
      const isActive = cat.id === shopFilterState.selectedCategory;
      const iconStr = cat.icon ? `<span style="font-size: 1.05rem; margin-right: 0.35rem;">${cat.icon}</span>` : "";
      return `
        <button class="sidebar-cat-btn ${isActive ? 'active' : ''}" data-category="${cat.id}">
          <span style="display: inline-flex; align-items: center;">${iconStr}${cat.label}</span>
          <span class="cat-count">${count}</span>
        </button>
      `;
    }).join("");

    list.querySelectorAll(".sidebar-cat-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        list.querySelectorAll(".sidebar-cat-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        shopFilterState.selectedCategory = btn.dataset.category;
        renderShopGrid();
      });
    });
  }

  function updateCategoryCounts() {
    renderSidebarCategories();
  }

  // Filter and sort products for shop.html
  function getShopProducts() {
    let list = typeof getStoreProducts === "function" ? getStoreProducts() : [...PRODUCTS_DATA];

    // Filter by category
    if (shopFilterState.selectedCategory !== "all") {
      list = list.filter(p => p.category === shopFilterState.selectedCategory);
    }

    // Filter by search query
    if (shopFilterState.searchQuery.trim()) {
      const q = shopFilterState.searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
        p.shortDesc.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        (p.healthGoals && p.healthGoals.some(g => g.toLowerCase().includes(q)))
      );
    }

    // Filter by price range
    if (shopFilterState.priceRange === "under-7k") {
      list = list.filter(p => p.price < 7000);
    } else if (shopFilterState.priceRange === "7k-12k") {
      list = list.filter(p => p.price >= 7000 && p.price <= 12000);
    } else if (shopFilterState.priceRange === "above-12k") {
      list = list.filter(p => p.price > 12000);
    }

    // Sort
    if (shopFilterState.sortBy === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (shopFilterState.sortBy === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (shopFilterState.sortBy === "rating") {
      list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }

    return list;
  }

  // Render product cards on shop.html
  function renderShopGrid() {
    const grid = document.getElementById("productsGrid");
    const countEl = document.getElementById("shopProductCount");
    if (!grid) return;

    const products = getShopProducts();

    if (countEl) {
      countEl.textContent = `Showing ${products.length} authentic remed${products.length === 1 ? 'y' : 'ies'}`;
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="shop-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 4.5rem 1.5rem; background: #ffffff; border-radius: var(--radius-xl); border: 1px dashed rgba(24, 66, 46, 0.2);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🌿</div>
          <h3 style="font-family: var(--font-heading); color: var(--deep-forest); font-size: 1.5rem; margin-bottom: 0.5rem;">No herbal remedies matched your filter</h3>
          <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 1.5rem;">Try clearing your search query or selecting a different category to view our natural remedies.</p>
          <button class="btn-primary" id="emptyStateResetBtn" style="margin: 0 auto;">
            <span>View All Remedies</span>
          </button>
        </div>
      `;
      const resetBtn = document.getElementById("emptyStateResetBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", resetAllFilters);
      }
      return;
    }

    grid.innerHTML = products.map(product => {
      const origPriceHtml = product.originalPrice && product.originalPrice > product.price
        ? `<span class="original-price">${formatNaira(product.originalPrice)}</span>`
        : "";

      return `
        <div class="product-card" data-id="${product.id}">
          <div class="product-thumb-container" onclick="window.app && window.app.openQuickView ? window.app.openQuickView('${product.id}') : null" style="cursor: pointer;">
            ${product.badge ? `<span class="product-badge ${product.badgeType || 'standard'}">${product.badge}</span>` : ''}
            <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='images/agbo-jedi.jpg'">
            <button class="quick-view-overlay-btn" onclick="event.stopPropagation(); window.app && window.app.openQuickView ? window.app.openQuickView('${product.id}') : null">
              🔍 Quick Details
            </button>
          </div>

          <div class="product-card-body">
            <div class="product-meta-row">
              <span class="product-category-tag">${product.categoryLabel || 'Agbo & Tonics'}</span>
              <span class="product-rating">★ ${(product.rating || 5).toFixed(1)} (${product.reviewsCount || 120})</span>
            </div>

            <h3 class="product-title">${product.name}</h3>
            ${product.subtitle ? `<p class="product-subtitle-tag">${product.subtitle}</p>` : ''}
            <p class="product-desc">${product.shortDesc}</p>

            <div class="product-card-footer">
              <div class="product-price-stack">
                <span class="current-price">${formatNaira(product.price)}</span>
                ${origPriceHtml}
              </div>
              <button class="add-to-cart-btn" onclick="window.app && window.app.addToCart ? window.app.addToCart('${product.id}') : null">
                <span>+ Add</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Reset all filters
  function resetAllFilters() {
    shopFilterState.selectedCategory = "all";
    shopFilterState.searchQuery = "";
    shopFilterState.priceRange = "all";
    shopFilterState.sortBy = "featured";

    const searchInput = document.getElementById("shopSearchInput");
    if (searchInput) searchInput.value = "";

    const sortSelect = document.getElementById("shopSortSelect");
    if (sortSelect) sortSelect.value = "featured";

    const defaultRadio = document.querySelector("#priceFilterGroup input[value='all']");
    if (defaultRadio) defaultRadio.checked = true;

    renderSidebarCategories();
    renderShopGrid();
  }

  // Initialize shop page controls
  function initShopPage() {
    // 1. Check for URL category parameter (e.g. shop.html?category=men)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get("category");
    if (categoryParam) {
      shopFilterState.selectedCategory = categoryParam;
    }

    // 2. Render sidebar categories with active selection
    renderSidebarCategories();

    // 3. Search input
    const searchInput = document.getElementById("shopSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        shopFilterState.searchQuery = e.target.value;
        renderShopGrid();
      });
    }

    // 4. Price range radios
    const priceRadios = document.querySelectorAll("#priceFilterGroup input[name='priceRange']");
    priceRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        if (e.target.checked) {
          shopFilterState.priceRange = e.target.value;
          renderShopGrid();
        }
      });
    });

    // 5. Sort select
    const sortSelect = document.getElementById("shopSortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        shopFilterState.sortBy = e.target.value;
        renderShopGrid();
      });
    }

    // 6. Reset button
    const resetBtn = document.getElementById("sidebarResetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetAllFilters);
    }

    // 7. Update counts & initial render
    updateCategoryCounts();
    renderShopGrid();

    // 8. Listen for storage updates (e.g. when Admin adds/removes products or categories in another tab or window!)
    window.addEventListener("storage", (e) => {
      if (
        e.key === "quadace_custom_products" ||
        e.key === "quadace_deleted_products" ||
        e.key === "quadace_custom_categories" ||
        e.key === "quadace_deleted_categories"
      ) {
        renderSidebarCategories();
        renderShopGrid();
      }
    });
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initShopPage);
  } else {
    initShopPage();
  }

  // Export helper
  window.shopApp = {
    renderShopGrid,
    resetAllFilters,
    updateCategoryCounts
  };
})();
