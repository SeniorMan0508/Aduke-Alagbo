(function () {
  "use strict";

  // --- STATE ---
  const state = {
    cart: [],
    activeCategory: "all",
    activeSearch: "",
    activeSort: "featured",
    selectedShipping: "local",
    selectedPaymentMethod: "bank",
    appliedCoupon: null,
    discountAmount: 0,
    currentQuickViewProduct: null,
    lastOrder: null,
    attachedReceiptData: null,
    attachedReceiptName: null,
    attachedReceiptSize: null,
    reviews: [],
    visibleReviewsLimit: 6,
    currentOrderForReview: null,
    selectedReceiptRating: 5,
    selectedModalRating: 5
  };

  // --- HELPER: FORMAT CURRENCY ---
  function formatMoney(amount) {
    const symbol = STORE_CONFIG.currencySymbol || "₦";
    return symbol + Number(amount).toLocaleString("en-NG");
  }

  // --- HELPER: API BASE URL (Auto-routes to current host or local server) ---
  function getApiBaseUrl() {
    if (typeof window === "undefined") return "";
    // If hosted online (Render, Railway, or custom domain):
    if (window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.protocol.startsWith("http")) {
      return "";
    }
    // If accessed directly from local port 3000 where server is running:
    if (window.location.port === "3000") {
      return "";
    }
    // In local development (Live Server port 5500, or file://):
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:") {
      if (typeof STORE_CONFIG !== "undefined" && STORE_CONFIG.backendUrl) {
        return STORE_CONFIG.backendUrl.replace(/\/+$/, '');
      }
      return "http://localhost:3000";
    }
    return "";
  }

  // --- LOCAL STORAGE CART PERSISTENCE ---
  function loadCart() {
    try {
      const saved = localStorage.getItem("quadace_cart");
      if (saved) {
        state.cart = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not load cart from storage", e);
      state.cart = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem("quadace_cart", JSON.stringify(state.cart));
    } catch (e) {
      console.warn("Could not save cart", e);
    }
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, icon = "🌿") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Trigger reflow & show
    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }

  // --- INITIALIZE STORE CONFIG DATA INTO UI ---
  function initStoreConfig() {
    // Brand titles
    const navBrand = document.getElementById("navBrandName");
    if (navBrand) navBrand.textContent = STORE_CONFIG.storeName;
    const navTag = document.getElementById("navTagline");
    if (navTag) navTag.textContent = STORE_CONFIG.tagline;

    // Contact info
    const barPhone = document.getElementById("barPhone");
    if (barPhone) barPhone.textContent = STORE_CONFIG.sellerPhone;

    // Current Year in footer
    const currentYear = document.getElementById("currentYear");
    if (currentYear) currentYear.textContent = new Date().getFullYear();
   
    // Bank Details in Checkout
    const checkoutBankName = document.getElementById("checkoutBankName");
    if (checkoutBankName) checkoutBankName.textContent = STORE_CONFIG.bankDetails.bankName;
    const checkoutAccountNumber = document.getElementById("checkoutAccountNumber");
    if (checkoutAccountNumber) checkoutAccountNumber.textContent = STORE_CONFIG.bankDetails.accountNumber;
    const checkoutAccountName = document.getElementById("checkoutAccountName");
    if (checkoutAccountName) checkoutAccountName.textContent = STORE_CONFIG.bankDetails.accountName;
    const checkoutBankInstructions = document.getElementById("checkoutBankInstructions");
    if (checkoutBankInstructions) checkoutBankInstructions.textContent = STORE_CONFIG.bankDetails.transferInstructions;

    // Shipping Rates in Checkout Step 2
    const rateLocal = document.getElementById("rateLocal");
    if (rateLocal) rateLocal.textContent = formatMoney(STORE_CONFIG.shipping.local.price);
    const rateNationwide = document.getElementById("rateNationwide");
    if (rateNationwide) rateNationwide.textContent = STORE_CONFIG.shipping.nationwide.feeLabel || "Sorted with dispatch rider";
    const rateInternational = document.getElementById("rateInternational");
    if (rateInternational) rateInternational.textContent = STORE_CONFIG.shipping.international.feeLabel || "Sorted with courier";
  }

  // --- REVIEWS & TESTIMONIALS SYSTEM ---
  const REVIEWS_STORAGE_KEY = "quadace_customer_reviews";

  const DEFAULT_TESTIMONIALS = [
    {
      id: "rev-1",
      name: "Olumide B.",
      location: "Lekki, Lagos",
      rating: 5,
      remedy: "Agbo Jedi-Jedi Extra Strength",
      comment: "I had suffered from severe Jedi-Jedi and lower back pain for over 8 months. Sitting in traffic was pure torture. After just 4 days of taking Aduke Alagbo Agbo Jedi Extra Strength, the waist stiffness completely dissolved. This is the real deal!",
      verifiedBuyer: true,
      createdAt: "2026-09-28T10:30:00.000Z"
    },
    {
      id: "rev-2",
      name: "Chinedu E.",
      location: "Abuja, FCT",
      rating: 5,
      remedy: "Man-Power Virility Roots",
      comment: "The Man-Power Stamina roots are incredible. No strange chemical headaches or rapid heartbeats like the synthetic pills sold in pharmacies. Just pure, natural, energetic power and lasting confidence. My wife noticed the difference immediately.",
      verifiedBuyer: true,
      createdAt: "2026-10-01T14:15:00.000Z"
    },
    {
      id: "rev-3",
      name: "Amina K.",
      location: "London, United Kingdom",
      rating: 5,
      remedy: "Queen's Hormonal Balance",
      comment: "I ordered the Queen's Hormonal Balance tea from the UK via DHL. It arrived in London in just 4 days! My cycle that had seized for 3 months returned naturally with zero pain. God bless Aduke Alagbo!",
      verifiedBuyer: true,
      createdAt: "2026-10-04T09:45:00.000Z"
    },
    {
      id: "rev-4",
      name: "Folashade A.",
      location: "Ibadan, Oyo State",
      rating: 5,
      remedy: "Raw Prekese & Roots Bundle",
      comment: "The Bitter Kola & Prekese pod infusion cleared my morning fatigue and bloating within a week. Authentic herbs, properly prepared. Aduke Alagbo is now my family's go-to apothecary.",
      verifiedBuyer: true,
      createdAt: "2026-10-06T16:20:00.000Z"
    }
  ];

  function getAvatarGradient(name) {
    const gradients = [
      "linear-gradient(135deg, #18422e, #27ae60)",
      "linear-gradient(135deg, #8c5b23, #d4af37)",
      "linear-gradient(135deg, #7c2d12, #ea580c)",
      "linear-gradient(135deg, #0f766e, #14b8a6)",
      "linear-gradient(135deg, #4338ca, #6366f1)",
      "linear-gradient(135deg, #047857, #10b981)"
    ];
    let hash = 0;
    const str = name || "Q";
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }

  function formatReviewTime(isoString) {
    if (!isoString) return "Verified Purchase";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 5) return "Just now";
      if (diffMins < 60) return `${diffMins} mins ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 30) return `${diffDays} days ago`;
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) {
      return "Verified Purchase";
    }
  }

  function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function loadReviews() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reviews`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.reviews) && data.reviews.length > 0) {
          state.reviews = data.reviews;
          localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(data.reviews));
          renderTestimonials();
          return;
        }
      }
    } catch (e) {
      // Local fallback
    }

    try {
      const saved = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.reviews = parsed;
          renderTestimonials();
          return;
        }
      }
    } catch (e) {}

    state.reviews = [...DEFAULT_TESTIMONIALS];
    renderTestimonials();
  }

  function renderTestimonials(highlightId = null) {
    const container = document.getElementById("testimonialsGrid");
    if (!container) return;

    if (!state.reviews || state.reviews.length === 0) {
      state.reviews = [...DEFAULT_TESTIMONIALS];
    }

    const totalReviews = state.reviews.length;
    const limit = state.visibleReviewsLimit || 6;
    const visibleList = state.reviews.slice(0, limit);

    container.innerHTML = visibleList.map(rev => {
      const initial = (rev.name && rev.name.trim().length > 0) ? rev.name.trim()[0].toUpperCase() : "Q";
      const gradient = getAvatarGradient(rev.name || "Customer");
      const stars = "★".repeat(Math.max(1, Math.min(5, Number(rev.rating) || 5)));
      const isNew = rev.id === highlightId;
      const formattedDate = formatReviewTime(rev.createdAt);

      return `
        <div class="testimonial-card ${isNew ? 'new-review-highlight' : ''}" id="review-${rev.id}">
          <div class="testimonial-card-header">
            <span class="testimonial-remedy-badge">🌿 ${escapeHTML(rev.remedy || 'Traditional Remedy')}</span>
            <span class="testimonial-date">${formattedDate}</span>
          </div>
          <div class="testimonial-stars">${stars}</div>
          <p class="testimonial-text">
            "${escapeHTML(rev.comment)}"
          </p>
          <div class="testimonial-author">
            <div class="author-avatar" style="background: ${gradient};">${initial}</div>
            <div class="author-info">
              <h5>${escapeHTML(rev.name)}</h5>
              <span>${escapeHTML(rev.location || 'Nigeria')} • <strong class="verified-badge">✓ Verified Buyer</strong></span>
            </div>
          </div>
        </div>
      `;
    }).join("");

    // Update Load More Button & Remaining Count
    const loadMoreContainer = document.getElementById("reviewsLoadMoreContainer");
    const loadMoreCount = document.getElementById("loadMoreReviewsCount");
    if (loadMoreContainer) {
      if (totalReviews > limit) {
        loadMoreContainer.style.display = "block";
        const remaining = totalReviews - limit;
        if (loadMoreCount) {
          loadMoreCount.textContent = `(${remaining} more)`;
        }
      } else {
        loadMoreContainer.style.display = "none";
      }
    }
  }

  async function postReviewToServerAndLocal(reviewPayload) {
    let createdReview = null;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewPayload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.review) {
          createdReview = data.review;
        }
      }
    } catch (e) {
      console.warn("Could not reach backend /api/reviews, saving to local store", e);
    }

    if (!createdReview) {
      createdReview = {
        id: `local-rev-${Date.now()}`,
        name: reviewPayload.name,
        location: reviewPayload.location || "Abeokuta, Nigeria",
        rating: reviewPayload.rating || 5,
        remedy: reviewPayload.remedy || "Authentic Herbal Remedy",
        comment: reviewPayload.comment,
        verifiedBuyer: true,
        createdAt: new Date().toISOString()
      };
    }

    if (!state.reviews) state.reviews = [];
    state.reviews = [createdReview, ...state.reviews.filter(r => r.id !== createdReview.id)];

    try {
      localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(state.reviews));
    } catch (e) {}

    renderTestimonials(createdReview.id);
    return createdReview;
  }

  function updateStarPickerUI(containerId, textId, rating) {
    const container = document.getElementById(containerId);
    const textEl = document.getElementById(textId);
    if (!container) return;

    const labels = {
      1: "1.0 / 5 (Needs Improvement)",
      2: "2.0 / 5 (Fair)",
      3: "3.0 / 5 (Good)",
      4: "4.0 / 5 (Very Good)",
      5: "5.0 / 5 (Excellent)"
    };

    container.querySelectorAll(".star-item").forEach(star => {
      const starRating = Number(star.dataset.rating);
      if (starRating <= rating) {
        star.classList.add("active");
      } else {
        star.classList.remove("active");
      }
    });

    if (textEl) {
      textEl.textContent = labels[rating] || `${rating}.0 / 5`;
    }
  }

  function initStarRatings() {
    const bindPicker = (containerId, textId, onSelect) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.querySelectorAll(".star-item").forEach(star => {
        star.addEventListener("click", () => {
          const rating = Number(star.dataset.rating);
          updateStarPickerUI(containerId, textId, rating);
          onSelect(rating);
        });

        star.addEventListener("mouseenter", () => {
          const hoverRating = Number(star.dataset.rating);
          container.querySelectorAll(".star-item").forEach(s => {
            if (Number(s.dataset.rating) <= hoverRating) {
              s.classList.add("hovered");
            } else {
              s.classList.remove("hovered");
            }
          });
        });

        star.addEventListener("mouseleave", () => {
          container.querySelectorAll(".star-item").forEach(s => s.classList.remove("hovered"));
        });
      });
    };

    bindPicker("receiptStarRating", "receiptRatingText", (rating) => {
      state.selectedReceiptRating = rating;
    });

    bindPicker("modalStarPicker", "modalRatingText", (rating) => {
      state.selectedModalRating = rating;
    });
  }

  function initReceiptReviewHandler() {
    const submitBtn = document.getElementById("submitReceiptReviewBtn");
    if (!submitBtn) return;

    submitBtn.addEventListener("click", async () => {
      const commentInput = document.getElementById("receiptCommentText");
      const comment = commentInput ? commentInput.value.trim() : "";

      if (!comment || comment.length < 3) {
        showToast("Please enter a short comment about your purchase!", "⚠️");
        if (commentInput) commentInput.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Publishing comment... ⏳</span>`;

      const order = state.currentOrderForReview || {};
      const cust = order.customer || {};
      const remedyName = (order.items && order.items.length > 0 && order.items[0].name)
        ? order.items[0].name
        : "Aduke Alagbo Traditional Formulation";

      let location = "Abeokuta, Nigeria";
      if (cust.city && cust.state) {
        location = `${cust.city}, ${cust.state}`;
      } else if (cust.city || cust.state) {
        location = cust.city || cust.state;
      }

      const reviewPayload = {
        name: cust.name || "Happy Customer",
        location: location,
        remedy: remedyName,
        rating: state.selectedReceiptRating || 5,
        comment: comment,
        verifiedBuyer: true
      };

      await postReviewToServerAndLocal(reviewPayload);

      const reviewInputs = document.getElementById("receiptReviewInputs");
      const reviewSuccess = document.getElementById("receiptReviewSuccess");
      if (reviewInputs) reviewInputs.style.display = "none";
      if (reviewSuccess) reviewSuccess.style.display = "flex";

      showToast("🌿 Your review is now live on our website homepage!", "⭐");
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>🌿 Post Comment to Website</span>`;
    });
  }

  function initWriteReviewModal() {
    const openBtn = document.getElementById("openReviewModalBtn");
    const modal = document.getElementById("writeReviewModalOverlay");
    const closeBtn = document.getElementById("closeReviewModalBtn");
    const cancelBtn = document.getElementById("cancelReviewModalBtn");
    const form = document.getElementById("writeReviewForm");

    if (!modal) return;

    const openModal = () => {
      modal.classList.add("active");
      state.selectedModalRating = 5;
      updateStarPickerUI("modalStarPicker", "modalRatingText", 5);
      const nameIn = document.getElementById("reviewAuthorName");
      if (nameIn) setTimeout(() => nameIn.focus(), 150);
    };

    const closeModal = () => {
      modal.classList.remove("active");
    };

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("reviewAuthorName");
        const locationInput = document.getElementById("reviewAuthorLocation");
        const remedySelect = document.getElementById("reviewRemedySelect");
        const commentInput = document.getElementById("reviewCommentText");
        const submitBtn = document.getElementById("submitModalReviewBtn");

        const name = nameInput ? nameInput.value.trim() : "";
        const location = locationInput ? locationInput.value.trim() : "";
        const remedy = remedySelect ? remedySelect.value : "Agbo Jedi-Jedi Extra Strength";
        const comment = commentInput ? commentInput.value.trim() : "";

        if (!name || !comment) {
          showToast("Please provide your name and review comment!", "⚠️");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Publishing review... ⏳</span>`;
        }

        const reviewPayload = {
          name,
          location: location || "Nigeria",
          remedy,
          rating: state.selectedModalRating || 5,
          comment,
          verifiedBuyer: true
        };

        await postReviewToServerAndLocal(reviewPayload);

        form.reset();
        closeModal();
        showToast("🌿 Thank you! Your review is now live on our website!", "⭐");

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>🌿 Publish Review to Website</span>`;
        }

        const reviewsSection = document.getElementById("reviews");
        if (reviewsSection) {
          reviewsSection.scrollIntoView({ behavior: "smooth" });
        }
      });
    }
  }

  // --- REVIEWS LOAD MORE HANDLER ---
  function initLoadMoreReviews() {
    const loadMoreBtn = document.getElementById("loadMoreReviewsBtn");
    if (!loadMoreBtn) return;

    loadMoreBtn.addEventListener("click", () => {
      state.visibleReviewsLimit = (state.visibleReviewsLimit || 6) + 6;
      renderTestimonials();
    });
  }

  // --- RENDER CATEGORY PILLS ---
  function renderCategories() {
    const pillsContainer = document.getElementById("categoryPills");
    if (!pillsContainer) return;

    const categories = typeof getStoreCategories === "function" 
      ? getStoreCategories(true) 
      : (typeof CATEGORIES !== "undefined" ? CATEGORIES : []);

    pillsContainer.innerHTML = categories.map(cat => `
      <button class="pill-btn ${cat.id === state.activeCategory ? 'active' : ''}" data-category="${cat.id}">
        <span>${cat.icon || '🌱'}</span>
        <span>${cat.label}</span>
      </button>
    `).join("");

    pillsContainer.querySelectorAll(".pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.dataset.category;
        renderCategories();
        renderProducts();
      });
    });
  }

  // --- FILTER & SORT PRODUCTS ---
  function getFilteredProducts() {
    let list = typeof getStoreProducts === "function" ? getStoreProducts() : [...PRODUCTS_DATA];

    // Filter by Category
    if (state.activeCategory !== "all") {
      list = list.filter(p => p.category === state.activeCategory);
    }

    // Filter by Search Query
    if (state.activeSearch.trim()) {
      const q = state.activeSearch.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.shortDesc.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        p.healthGoals.some(g => g.toLowerCase().includes(q))
      );
    }

    // Sort
    if (state.activeSort === "price-low") {
      list.sort((a, b) => a.price - b.price);
    } else if (state.activeSort === "price-high") {
      list.sort((a, b) => b.price - a.price);
    } else if (state.activeSort === "rating") {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }

  // Helper to render an individual product card
  function renderProductCardHTML(product) {
    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-thumb-container">
          ${product.badge ? `<span class="product-badge ${product.badgeType || 'standard'}">${product.badge}</span>` : ''}
          <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.src='images/agbo-jedi.jpg'">
          <button class="quick-view-overlay-btn" onclick="window.app.openQuickView('${product.id}')">
            🔍 Quick Details
          </button>
        </div>

        <div class="product-card-body">
          <div class="product-meta-row">
            <span class="product-category-tag">${product.categoryLabel || (typeof getCategoryLabel === 'function' ? getCategoryLabel(product.category) : product.category)}</span>
            <span class="product-rating">★ ${(product.rating || 5).toFixed(1)} (${product.reviewsCount || 100})</span>
          </div>

          <h3 class="product-title">${product.name}</h3>
          <p class="product-desc">${product.shortDesc}</p>

          <div class="product-card-footer">
            <div class="product-price-stack">
              <span class="current-price">${formatMoney(product.price)}</span>
              ${product.originalPrice ? `<span class="original-price">${formatMoney(product.originalPrice)}</span>` : ''}
            </div>
            <button class="add-to-cart-btn" onclick="window.app.addToCart('${product.id}')">
              <span>+ Add</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // --- RENDER PRODUCTS GRID (CURATED CATEGORIES: LATEST 3 PRODUCTS EACH) ---
  function renderProducts() {
    const container = document.getElementById("productsGrid");
    if (!container) return;

    let allProducts = typeof getStoreProducts === "function" ? getStoreProducts() : [...PRODUCTS_DATA];

    // Case A: User is actively searching
    if (state.activeSearch.trim()) {
      const q = state.activeSearch.toLowerCase().trim();
      let matched = allProducts.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.subtitle && p.subtitle.toLowerCase().includes(q)) ||
        p.shortDesc.toLowerCase().includes(q) ||
        p.categoryLabel.toLowerCase().includes(q) ||
        (p.healthGoals && p.healthGoals.some(g => g.toLowerCase().includes(q)))
      );

      if (state.activeSort === "price-low") matched.sort((a, b) => a.price - b.price);
      else if (state.activeSort === "price-high") matched.sort((a, b) => b.price - a.price);
      else if (state.activeSort === "rating") matched.sort((a, b) => (b.rating || 5) - (a.rating || 5));

      if (matched.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🌿</div>
            <h3 style="font-family: var(--font-heading); color: var(--deep-forest); margin-bottom: 0.5rem;">No remedies matched '${state.activeSearch}'</h3>
            <p>Try searching with another keyword or explore our full herbal catalog in the shop.</p>
            <button class="btn-primary" style="margin-top: 1.5rem;" onclick="window.app.resetFilters()">View All Categories</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="font-size: 1.05rem; color: var(--deep-forest); font-weight: 600;">
            Found ${matched.length} remedy result${matched.length === 1 ? '' : 's'} for <strong>"${state.activeSearch}"</strong>:
          </div>
          <button type="button" class="btn-secondary" style="font-size: 0.82rem; padding: 0.35rem 0.85rem;" onclick="window.app.resetFilters()">
            ✕ Clear Search
          </button>
        </div>
        <div class="products-grid">
          ${matched.map(renderProductCardHTML).join("")}
        </div>
        <div style="text-align: center; margin-top: 3rem;">
          <a href="shop.html" class="home-category-view-more">
            <span>Explore All Remedies in Full Shop Catalog →</span>
          </a>
        </div>
      `;
      return;
    }

    // Case B: Category-by-Category Showcase (Latest 3 remedies per category)
    const allCategories = typeof getStoreCategories === "function" ? getStoreCategories(false) : [];

    // Filter which categories to show: all, or specific pill selected
    const categoriesToShow = (state.activeCategory === "all")
      ? allCategories
      : allCategories.filter(c => c.id === state.activeCategory);

    const categoryBlocks = [];

    categoriesToShow.forEach(cat => {
      let catProducts = allProducts.filter(p => p.category === cat.id);
      if (catProducts.length === 0) return; // Skip empty categories

      // Apply sort if selected
      if (state.activeSort === "price-low") catProducts.sort((a, b) => a.price - b.price);
      else if (state.activeSort === "price-high") catProducts.sort((a, b) => b.price - a.price);
      else if (state.activeSort === "rating") catProducts.sort((a, b) => (b.rating || 5) - (a.rating || 5));

      const totalCount = catProducts.length;
      // Strictly latest 3 products uploaded!
      const latest3 = catProducts.slice(0, 3);

      categoryBlocks.push(`
        <div class="home-category-block" data-category="${cat.id}">
          <div class="home-category-header">
            <div class="home-category-info">
              <span class="home-category-icon">${cat.icon || '🌿'}</span>
              <div>
                <h3 class="home-category-title">${cat.label}</h3>
                ${cat.desc ? `<p class="home-category-desc">${cat.desc}</p>` : ''}
              </div>
            </div>
            <a href="shop.html?category=${cat.id}" class="home-category-link" title="Explore all ${cat.label} in Shop">
              <span>View All ${cat.label} (${totalCount})</span>
              <span class="arrow">→</span>
            </a>
          </div>

          <div class="products-grid">
            ${latest3.map(renderProductCardHTML).join("")}
          </div>

          <div class="home-category-footer">
            <a href="shop.html?category=${cat.id}" class="home-category-view-more">
              <span>View More ${cat.label} in Shop (${totalCount} Available) →</span>
            </a>
          </div>
        </div>
      `);
    });

    if (categoryBlocks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem; color: var(--text-secondary);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🌿</div>
          <h3 style="font-family: var(--font-heading); color: var(--deep-forest); margin-bottom: 0.5rem;">No remedies in this category yet</h3>
          <p>Explore our full catalog on the Shop page.</p>
          <a href="shop.html" class="btn-primary" style="display: inline-flex; margin-top: 1.5rem;">Visit Shop Catalog</a>
        </div>
      `;
      return;
    }

    container.innerHTML = categoryBlocks.join("");
  }

  // --- CART MANAGEMENT ---
  function getCartSubtotal() {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function getCartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function addToCart(productId, quantity = 1) {
    const allProducts = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = state.cart.findIndex(item => item.id === productId);
    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += quantity;
    } else {
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: quantity
      });
    }

    saveCart();
    updateCartUI();
    showToast(`Added ${product.name} to cart!`, "🛒");
  }

  function changeCartQty(productId, delta) {
    const index = state.cart.findIndex(item => item.id === productId);
    if (index === -1) return;

    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) {
      state.cart.splice(index, 1);
      showToast("Item removed from cart", "🗑️");
    }
    saveCart();
    updateCartUI();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showToast("Item removed", "🗑️");
  }

  function updateCartUI() {
    // Badges & Counters
    const cartCountEl = document.getElementById("cartCount");
    const drawerItemCount = document.getElementById("drawerItemCount");
    const count = getCartCount();
    if (cartCountEl) cartCountEl.textContent = count;
    if (drawerItemCount) drawerItemCount.textContent = `(${count} item${count === 1 ? '' : 's'})`;

    // Cart Items Container
    const itemsList = document.getElementById("cartItemsList");
    const cartFooter = document.getElementById("cartFooter");
    const freeShippingContainer = document.getElementById("freeShippingContainer");

    if (!itemsList) return;

    if (state.cart.length === 0) {
      itemsList.innerHTML = `
        <div class="empty-cart-message">
          <div class="empty-cart-icon">🌿</div>
          <h4 style="font-family: var(--font-heading); color: var(--deep-forest); margin-bottom: 0.5rem;">Your herbal basket is empty</h4>
          <p style="font-size: 0.88rem; margin-bottom: 1.5rem;">Discover our authentic Agbo, vitality roots, and wildcrafted teas.</p>
          <button class="btn-primary" onclick="window.app.closeCart(); window.location.hash='#catalog';">
            <span>Explore Remedies</span>
          </button>
        </div>
      `;
      if (cartFooter) cartFooter.style.display = "none";
      if (freeShippingContainer) freeShippingContainer.style.display = "none";
      return;
    }

    if (cartFooter) cartFooter.style.display = "block";
    if (freeShippingContainer) freeShippingContainer.style.display = "block";

    // Render items
    itemsList.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <h4 class="cart-item-title">${item.name}</h4>
          <span class="cart-item-price">${formatMoney(item.price)}</span>
          <div class="cart-qty-controls">
            <div class="qty-pill">
              <button class="qty-btn" onclick="window.app.changeCartQty('${item.id}', -1)">−</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" onclick="window.app.changeCartQty('${item.id}', 1)">+</button>
            </div>
            <button class="remove-item-btn" onclick="window.app.removeFromCart('${item.id}')">Remove</button>
          </div>
        </div>
      </div>
    `).join("");

    // Calculate totals
    const subtotal = getCartSubtotal();
    let discount = 0;
    if (state.appliedCoupon) {
      if (state.appliedCoupon.type === "percentage") {
        discount = Math.round((subtotal * state.appliedCoupon.value) / 100);
      } else if (state.appliedCoupon.type === "fixed") {
        discount = Math.min(state.appliedCoupon.value, subtotal);
      }
    }
    state.discountAmount = discount;

    const grandTotal = Math.max(0, subtotal - discount);

    // Update Elements
    const cartSubtotalEl = document.getElementById("cartSubtotal");
    const cartGrandTotalEl = document.getElementById("cartGrandTotal");
    const discountRow = document.getElementById("discountRow");
    const cartDiscountEl = document.getElementById("cartDiscount");

    if (cartSubtotalEl) cartSubtotalEl.textContent = formatMoney(subtotal);
    if (cartGrandTotalEl) cartGrandTotalEl.textContent = formatMoney(grandTotal);

    if (discount > 0) {
      if (discountRow) discountRow.style.display = "flex";
      if (cartDiscountEl) cartDiscountEl.textContent = `-${formatMoney(discount)}`;
    } else {
      if (discountRow) discountRow.style.display = "none";
    }

    // Free shipping threshold progress
    const threshold = STORE_CONFIG.shipping.freeShippingThreshold || 50000;
    const progressFill = document.getElementById("shippingProgressFill");
    const freeShippingText = document.getElementById("freeShippingText");
    if (progressFill && freeShippingText) {
      if (subtotal >= threshold) {
        progressFill.style.width = "100%";
        freeShippingText.innerHTML = `🎉 <strong>Congratulations!</strong> You qualified for FREE Abeokuta delivery!`;
      } else {
        const remaining = threshold - subtotal;
        const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
        progressFill.style.width = `${pct}%`;
        freeShippingText.innerHTML = `Add <strong>${formatMoney(remaining)}</strong> more for FREE Abeokuta Delivery!`;
      }
    }
  }

  // --- COUPON APPLICATION ---
  function applyCoupon() {
    const input = document.getElementById("couponInput");
    const msg = document.getElementById("couponMessage");
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    if (!code) {
      msg.textContent = "Please enter a coupon code.";
      msg.style.color = "#c0392b";
      msg.style.display = "block";
      return;
    }

    const promo = STORE_CONFIG.discounts[code];
    if (promo) {
      state.appliedCoupon = promo;
      msg.textContent = `✓ ${promo.label} applied successfully!`;
      msg.style.color = "#27ae60";
      msg.style.display = "block";
      showToast(`${promo.label} applied!`, "🏷️");
      updateCartUI();
    } else {
      msg.textContent = "Invalid code. Try QUADACE10 for 10% off!";
      msg.style.color = "#c0392b";
      msg.style.display = "block";
    }
  }

  // --- CART DRAWER OPEN / CLOSE ---
  function openCart() {
    const overlay = document.getElementById("cartOverlay");
    if (overlay) overlay.classList.add("active");
  }

  function closeCart() {
    const overlay = document.getElementById("cartOverlay");
    if (overlay) overlay.classList.remove("active");
  }

  // --- QUICK VIEW MODAL ---
  function openQuickView(productId) {
    const allProducts = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    state.currentQuickViewProduct = product;

    document.getElementById("qvImage").src = product.image;
    document.getElementById("qvImage").alt = product.name;
    document.getElementById("qvCategory").textContent = product.categoryLabel || (typeof getCategoryLabel === 'function' ? getCategoryLabel(product.category) : product.category);
    document.getElementById("qvTitle").textContent = product.name;
    document.getElementById("qvSubtitle").textContent = product.subtitle;
    document.getElementById("qvPrice").textContent = formatMoney(product.price);
    document.getElementById("qvFullDesc").textContent = product.fullDesc;

    // Benefits list
    const benefitsEl = document.getElementById("qvBenefits");
    benefitsEl.innerHTML = product.benefits.map(b => `<li>${b}</li>`).join("");

    // Ingredients & Usage
    document.getElementById("qvIngredients").textContent = product.ingredients.join(" • ");
    document.getElementById("qvUsage").textContent = product.usage;

    // Caution
    const cautionEl = document.getElementById("qvCaution");
    if (product.caution) {
      cautionEl.style.display = "block";
      cautionEl.innerHTML = `<strong>⚠️ Traditional Caution:</strong> ${product.caution}`;
    } else {
      cautionEl.style.display = "none";
    }

    // WhatsApp Direct Inquiry link
    const waBtn = document.getElementById("qvWhatsAppBtn");
    const waText = encodeURIComponent(`Hello Aduke Alagbo, I would like to inquire about ${product.name} (${formatMoney(product.price)}).`);
    waBtn.href = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${waText}`;

    // Show modal
    const overlay = document.getElementById("quickViewOverlay");
    if (overlay) {
      overlay.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  function closeQuickView() {
    const overlay = document.getElementById("quickViewOverlay");
    if (overlay) overlay.classList.remove("active");
    checkAnyModalActive();
  }

  // --- REMEDY QUIZ MATCHER ---
  function initRemedyQuiz() {
    const quizButtons = document.querySelectorAll("#quizOptions .quiz-btn");
    const resultBox = document.getElementById("remedyResultBox");
    const resultTitle = document.getElementById("quizResultTitle");
    const resultDesc = document.getElementById("quizResultDesc");
    const addBtn = document.getElementById("quizAddBtn");

    const remedyMap = {
      digestion: {
        id: "agbo-jedi-extra",
        title: "Agbo Jedi-Jedi Extra Strength",
        desc: "Ancestral detox decoction to flush intestinal sugar buildup, clear hemorrhoids (pile), and relieve stubborn waist stiffness.",
        price: 6500
      },
      stamina: {
        id: "man-power-vitality",
        title: "Man-Power Virility & Stamina Roots Infusion",
        desc: "Wild African root infusion for sustained hardness, enhanced nitric oxide pelvic blood flow, and lasting masculine vitality.",
        price: 9500
      },
      fertility: {
        id: "queens-hormonal-balance",
        title: "Queen's Hormonal Balance & Womb Cleanse",
        desc: "Restorative herbal blend for menstrual regularity, relief from painful cramps, hormonal acne reduction, and natural womb conception preparation.",
        price: 8500
      },
      immunity: {
        id: "immune-booster-elixir",
        title: "Immune Booster & Blood Purifier Elixir",
        desc: "Potent anti-inflammatory herbal shield with wild neem, ginger, and turmeric to detoxify liver and lymphatic fluid.",
        price: 7000
      }
    };

    let selectedRemedy = remedyMap["digestion"];

    quizButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        quizButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const goal = btn.dataset.goal;
        selectedRemedy = remedyMap[goal] || remedyMap["digestion"];

        if (resultTitle) resultTitle.textContent = selectedRemedy.title;
        if (resultDesc) resultDesc.textContent = selectedRemedy.desc;
        if (addBtn) addBtn.innerHTML = `<span>Add to Cart (${formatMoney(selectedRemedy.price)})</span>`;
      });
    });

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        addToCart(selectedRemedy.id);
        openCart();
      });
    }
  }

  // --- ACCORDION LOGIC ---
  function initAccordions() {
    document.querySelectorAll(".accordion-header").forEach(header => {
      header.addEventListener("click", () => {
        const item = header.parentElement;
        const isActive = item.classList.contains("active");

        // Close others
        document.querySelectorAll(".accordion-item").forEach(other => {
          other.classList.remove("active");
          const icon = other.querySelector(".accordion-icon");
          if (icon) icon.textContent = "+";
        });

        if (!isActive) {
          item.classList.add("active");
          const icon = header.querySelector(".accordion-icon");
          if (icon) icon.textContent = "−";
        }
      });
    });
  }

  // --- MODAL SCROLL LOCK HELPER ---
  function checkAnyModalActive() {
    const anyModal = document.querySelector(".modal-overlay.active");
    if (!anyModal) {
      document.body.classList.remove("modal-open");
    }
  }

  // --- CHECKOUT FLOW ---
  function openCheckoutModal() {
    if (state.cart.length === 0) {
      showToast("Your cart is empty! Please add an item first.", "⚠️");
      return;
    }
    closeCart();
    updateCheckoutRecap();
    setCheckoutStep(1);

    const overlay = document.getElementById("checkoutModalOverlay");
    if (overlay) {
      overlay.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  function closeCheckoutModal() {
    const overlay = document.getElementById("checkoutModalOverlay");
    if (overlay) overlay.classList.remove("active");
    checkAnyModalActive();
  }

  function setCheckoutStep(step) {
    document.getElementById("stepSection1").style.display = step === 1 ? "block" : "none";
    document.getElementById("stepSection2").style.display = step === 2 ? "block" : "none";
    document.getElementById("stepSection3").style.display = step === 3 ? "block" : "none";

    const ind1 = document.getElementById("stepIndicator1");
    const ind2 = document.getElementById("stepIndicator2");
    const ind3 = document.getElementById("stepIndicator3");

    [ind1, ind2, ind3].forEach((ind, idx) => {
      if (!ind) return;
      ind.classList.remove("active", "completed");
      if (idx + 1 === step) ind.classList.add("active");
      else if (idx + 1 < step) ind.classList.add("completed");
    });

    if (step === 3) {
      const completeOrderBtn = document.getElementById("completeOrderBtn");
      if (completeOrderBtn) {
        if (state.selectedPaymentMethod === "whatsapp") {
          completeOrderBtn.innerHTML = `
            <span class="btn-text-full">Confirm & Order on WhatsApp 💬</span>
            <span class="btn-text-short">Order on WhatsApp 💬</span>
          `;
        } else {
          completeOrderBtn.innerHTML = `
            <span class="btn-text-full">Confirm Order & Send Proof 🌿</span>
            <span class="btn-text-short">Confirm & Send Proof 🌿</span>
          `;
        }
      }
    }
  }

  function updateCheckoutRecap() {
    const subtotal = getCartSubtotal() - state.discountAmount;
    const shippingMethod = state.selectedShipping;
    let shippingFee = 0;
    let isRiderSettled = false;

    if (shippingMethod === "nationwide" || shippingMethod === "international") {
      shippingFee = 0;
      isRiderSettled = true;
    } else if (shippingMethod === "local") {
      const threshold = STORE_CONFIG.shipping.freeShippingThreshold || 50000;
      shippingFee = getCartSubtotal() >= threshold ? 0 : (STORE_CONFIG.shipping.local.price || 2500);
    }

    const finalTotal = subtotal + shippingFee;

    const checkoutSubtotal = document.getElementById("checkoutSubtotal");
    const checkoutShippingFee = document.getElementById("checkoutShippingFee");
    const checkoutShippingLabel = document.getElementById("checkoutShippingLabel");
    const checkoutFinalTotal = document.getElementById("checkoutFinalTotal");

    if (checkoutSubtotal) checkoutSubtotal.textContent = formatMoney(subtotal);
    if (checkoutShippingFee) {
      if (isRiderSettled) {
        checkoutShippingFee.textContent = shippingMethod === "nationwide" ? "Sorted with dispatch rider" : "Sorted with courier";
        checkoutShippingFee.style.color = "var(--earth-terracotta)";
        checkoutShippingFee.style.fontSize = "0.85rem";
      } else if (shippingFee === 0) {
        checkoutShippingFee.textContent = "FREE";
        checkoutShippingFee.style.color = "var(--primary-green)";
        checkoutShippingFee.style.fontSize = "1rem";
      } else {
        checkoutShippingFee.textContent = formatMoney(shippingFee);
        checkoutShippingFee.style.color = "var(--primary-green)";
        checkoutShippingFee.style.fontSize = "1rem";
      }
    }
    if (checkoutShippingLabel) {
      checkoutShippingLabel.textContent = `Delivery (${shippingMethod.toUpperCase()}):`;
    }
    if (checkoutFinalTotal) checkoutFinalTotal.textContent = formatMoney(finalTotal);

    const checkoutTransferAmount = document.getElementById("checkoutTransferAmount");
    if (checkoutTransferAmount) checkoutTransferAmount.textContent = formatMoney(finalTotal);
  }

  function initCheckoutForm() {
    // Step Navigation buttons
    document.getElementById("goToStep2Btn").addEventListener("click", () => {
      const name = document.getElementById("custName").value.trim();
      const phone = document.getElementById("custPhone").value.trim();
      const address = document.getElementById("custAddress").value.trim();
      const city = document.getElementById("custCity").value.trim();
      const stateVal = document.getElementById("custState").value.trim();

      if (!name || !phone || !address || !city || !stateVal) {
        showToast("Please fill in your Name, Phone, and Delivery Address!", "⚠️");
        return;
      }
      setCheckoutStep(2);
    });

    document.getElementById("backToStep1Btn").addEventListener("click", () => setCheckoutStep(1));

    document.getElementById("goToStep3Btn").addEventListener("click", () => {
      updateCheckoutRecap();
      setCheckoutStep(3);
    });

    document.getElementById("backToStep2Btn").addEventListener("click", () => setCheckoutStep(2));

    // Shipping radio cards selection
    const shippingCards = document.querySelectorAll("#shippingOptionsList .shipping-card");
    shippingCards.forEach(card => {
      card.addEventListener("click", () => {
        shippingCards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
        state.selectedShipping = card.dataset.shipping;
        updateCheckoutRecap();
      });
    });

    // Payment tab toggling (Bank Transfer vs WhatsApp)
    const payTabs = document.querySelectorAll(".payment-tabs .payment-tab-btn");
    payTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        payTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        state.selectedPaymentMethod = tab.dataset.paymethod;

        const completeOrderBtn = document.getElementById("completeOrderBtn");
        if (state.selectedPaymentMethod === "bank") {
          document.getElementById("bankDetailsView").style.display = "block";
          document.getElementById("whatsappMethodView").style.display = "none";
          if (completeOrderBtn) {
            completeOrderBtn.innerHTML = `
              <span class="btn-text-full">Confirm Order & Send Proof 🌿</span>
              <span class="btn-text-short">Confirm & Send Proof 🌿</span>
            `;
          }
        } else {
          document.getElementById("bankDetailsView").style.display = "none";
          document.getElementById("whatsappMethodView").style.display = "block";
          if (completeOrderBtn) {
            completeOrderBtn.innerHTML = `
              <span class="btn-text-full">Confirm & Order on WhatsApp 💬</span>
              <span class="btn-text-short">Order on WhatsApp 💬</span>
            `;
          }
        }
      });
    });

    // Copy Account Number button
    const copyBtn = document.getElementById("copyAccountBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const num = STORE_CONFIG.bankDetails.accountNumber;
        navigator.clipboard.writeText(num).then(() => {
          showToast(`Account number ${num} copied!`, "📋");
          copyBtn.innerHTML = `<span>✓ Copied!</span>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<span>📋 Copy</span>`;
          }, 2500);
        }).catch(() => {
          showToast(`Account: ${num}`, "📋");
        });
      });
    }

    // Bank Transfer Receipt Upload Handlers
    const receiptFileInput = document.getElementById("transferReceiptFile");
    const chooseReceiptBtn = document.getElementById("chooseReceiptBtn");
    const receiptDropzone = document.getElementById("receiptDropzone");
    const dropzoneEmptyView = document.getElementById("dropzoneEmptyView");
    const dropzonePreviewView = document.getElementById("dropzonePreviewView");
    const receiptPreviewImg = document.getElementById("receiptPreviewImg");
    const receiptFileName = document.getElementById("receiptFileName");
    const receiptFileSize = document.getElementById("receiptFileSize");
    const removeReceiptBtn = document.getElementById("removeReceiptBtn");

    function handleReceiptFile(file) {
      if (!file) return;
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        showToast("Please select an image file (PNG, JPG) or PDF receipt.", "⚠️");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast("Receipt file is too large (max 10MB).", "⚠️");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        state.attachedReceiptData = e.target.result;
        state.attachedReceiptName = file.name;
        state.attachedReceiptSize = `${(file.size / 1024).toFixed(1)} KB`;

        if (receiptFileName) receiptFileName.textContent = file.name;
        if (receiptFileSize) receiptFileSize.textContent = `${state.attachedReceiptSize} • Ready to verify`;
        if (receiptPreviewImg) {
          if (file.type.startsWith("image/")) {
            receiptPreviewImg.src = e.target.result;
            receiptPreviewImg.style.display = "block";
          } else {
            receiptPreviewImg.src = "";
            receiptPreviewImg.style.display = "none";
          }
        }
        if (dropzoneEmptyView) dropzoneEmptyView.style.display = "none";
        if (dropzonePreviewView) dropzonePreviewView.style.display = "flex";
        showToast("Receipt screenshot attached! ✓", "🧾");
      };
      reader.readAsDataURL(file);
    }

    if (chooseReceiptBtn && receiptFileInput) {
      chooseReceiptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        receiptFileInput.click();
      });
    }

    if (receiptDropzone && receiptFileInput) {
      receiptDropzone.addEventListener("click", () => {
        if (!state.attachedReceiptData) {
          receiptFileInput.click();
        }
      });

      // Drag and drop support
      ["dragenter", "dragover"].forEach(evtName => {
        receiptDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          receiptDropzone.classList.add("dragover");
        });
      });

      ["dragleave", "drop"].forEach(evtName => {
        receiptDropzone.addEventListener(evtName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          receiptDropzone.classList.remove("dragover");
        });
      });

      receiptDropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) {
          handleReceiptFile(dt.files[0]);
        }
      });

      receiptFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleReceiptFile(e.target.files[0]);
        }
      });
    }

    if (removeReceiptBtn && receiptFileInput) {
      removeReceiptBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.attachedReceiptData = null;
        state.attachedReceiptName = null;
        state.attachedReceiptSize = null;
        receiptFileInput.value = "";
        if (dropzoneEmptyView) dropzoneEmptyView.style.display = "block";
        if (dropzonePreviewView) dropzonePreviewView.style.display = "none";
        showToast("Receipt removed. You can attach a new one.", "ℹ️");
      });
    }

    // Complete Order button
    document.getElementById("completeOrderBtn").addEventListener("click", completeOrder);
  }

  // --- COMPLETE ORDER LOGIC ---
  function completeOrder() {
    const custName = document.getElementById("custName").value.trim();
    const custPhone = document.getElementById("custPhone").value.trim();
    const custEmail = document.getElementById("custEmail").value.trim();
    const custAddress = document.getElementById("custAddress").value.trim();
    const custCity = document.getElementById("custCity").value.trim();
    const custState = document.getElementById("custState").value.trim();
    const custNotes = document.getElementById("custNotes").value.trim();
    const senderBank = document.getElementById("senderBank") ? document.getElementById("senderBank").value.trim() : "";
    const senderName = document.getElementById("senderName") ? document.getElementById("senderName").value.trim() : "";
    const transferSessionId = document.getElementById("transferSessionId") ? document.getElementById("transferSessionId").value.trim() : "";

    if (!custName || !custPhone || !custAddress) {
      showToast("Please complete your delivery name, phone, and address first.", "⚠️");
      setCheckoutStep(1);
      return;
    }

    if (!custEmail || !custEmail.includes("@")) {
      showToast("Please enter a valid email address so we can send your order confirmation and dispatch receipt.", "⚠️");
      setCheckoutStep(1);
      const emailInput = document.getElementById("custEmail");
      if (emailInput) emailInput.focus();
      return;
    }

    // Protect seller: require either receipt screenshot OR sender details for Bank Transfer
    if (state.selectedPaymentMethod === "bank") {
      const hasReceipt = Boolean(state.attachedReceiptData);
      const hasSenderDetails = Boolean(senderName || senderBank || transferSessionId);
      if (!hasReceipt && !hasSenderDetails) {
        showToast("Please attach your transfer receipt screenshot or enter your sender name!", "⚠️");
        const dropzone = document.getElementById("receiptDropzone");
        if (dropzone) dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Generate unique Order Reference (#AA- prefix for Aduke Alagbo)
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const orderRef = `#AA-${randomDigits}`;

    const subtotal = getCartSubtotal() - state.discountAmount;
    let shippingFee = 0;
    let deliveryNote = "";

    if (state.selectedShipping === "nationwide") {
      shippingFee = 0;
      deliveryNote = "Sorted with dispatch rider upon delivery (NATIONWIDE)";
    } else if (state.selectedShipping === "international") {
      shippingFee = 0;
      deliveryNote = "Sorted with courier upon dispatch (INTERNATIONAL)";
    } else {
      if (getCartSubtotal() >= (STORE_CONFIG.shipping.freeShippingThreshold || 50000)) {
        shippingFee = 0;
        deliveryNote = "FREE (Local Promo)";
      } else {
        shippingFee = STORE_CONFIG.shipping.local.price || 2500;
        deliveryNote = `${formatMoney(shippingFee)} (LOCAL DISPATCH)`;
      }
    }
    const finalTotal = subtotal + shippingFee;

    const orderData = {
      orderRef: orderRef,
      customer: {
        name: custName,
        phone: custPhone,
        email: custEmail,
        address: `${custAddress}, ${custCity}, ${custState}`,
        notes: custNotes
      },
      senderDetails: {
        bank: senderBank,
        name: senderName,
        sessionId: transferSessionId
      },
      receiptProof: {
        hasReceipt: Boolean(state.attachedReceiptData),
        fileName: state.attachedReceiptName,
        dataUrl: state.attachedReceiptData,
        sessionId: transferSessionId
      },
      items: [...state.cart],
      shippingMethod: state.selectedShipping,
      shippingFee: shippingFee,
      discount: state.discountAmount,
      subtotal: subtotal,
      finalTotal: finalTotal,
      paymentMethod: state.selectedPaymentMethod,
      timestamp: new Date().toISOString()
    };

    state.lastOrder = orderData;

    // Build Formatted WhatsApp Order Message
    const itemsFormatted = orderData.items.map((it, idx) => 
      `${idx + 1}. *${it.name}* x ${it.quantity} (${formatMoney(it.price * it.quantity)})`
    ).join("\n");

    const paymentLabel = state.selectedPaymentMethod === "bank" ? "Direct Bank Transfer" : "WhatsApp Order Confirmation";

    let verificationBlock = "";
    if (state.selectedPaymentMethod === "bank") {
      const proofStatus = state.attachedReceiptData 
        ? "✅ SCREENSHOT ATTACHED (Customer will send receipt in chat)" 
        : "⚠️ NO SCREENSHOT ATTACHED (Check sender details below)";

      verificationBlock = 
`🧾 *PAYMENT PROOF & VERIFICATION:*
• *Receipt Proof:* ${proofStatus}
• *Customer Sender Bank:* ${senderBank || "Not specified by buyer"}
• *Customer Sender Name:* ${senderName || "Not specified by buyer"}
${transferSessionId ? `• *Session ID / Ref:* ${transferSessionId}\n` : ""}• *Store Account:* ${STORE_CONFIG.bankDetails.bankName} - ${STORE_CONFIG.bankDetails.accountNumber}
*(SELLER NOTICE: Cross-check your instant Kuda credit alert of ${formatMoney(orderData.finalTotal)} before dispatching package!)*`;
    } else {
      verificationBlock = `💬 *STATUS: WHATSAPP ORDER INQUIRY*
(Customer placed order directly via WhatsApp)`;
    }

    // Store Logo Image URL
    const storeLogoUrl = (window.location.origin && window.location.origin !== "null")
      ? `${window.location.origin}/images/bg-image.jpeg`
      : "images/bg-image.jpeg";

    const waMessageText = 
`*ADUKE ALAGBO - OFFICIAL STORE ORDER*
🖼️ *Store Logo:* ${storeLogoUrl}
━━━━━━━━━━━━━━━━━━━━
*Order Ref:* ${orderData.orderRef}
*Date:* ${new Date().toLocaleDateString('en-GB')}

${verificationBlock}

*CUSTOMER DETAILS:*
• *Name:* ${orderData.customer.name}
• *Phone:* ${orderData.customer.phone}
• *Delivery Address:* ${orderData.customer.address}
${orderData.customer.notes ? `• *Notes:* ${orderData.customer.notes}\n` : ''}
*ITEMS ORDERED:*
${itemsFormatted}

━━━━━━━━━━━━━━━━━━━━
*Subtotal:* ${formatMoney(orderData.subtotal)}
*Delivery:* ${deliveryNote}
${orderData.discount > 0 ? `*Discount:* -${formatMoney(orderData.discount)}\n` : ''}*TOTAL AMOUNT TO VERIFY:* ${formatMoney(orderData.finalTotal)}
━━━━━━━━━━━━━━━━━━━━
*Payment Method:* ${paymentLabel}

Please verify the payment alert and confirm dispatch! Thank you for choosing Aduke Alagbo.`;

    const encodedWaMessage = encodeURIComponent(waMessageText);
    const waLink = `https://wa.me/${STORE_CONFIG.whatsappNumber}?text=${encodedWaMessage}`;

    // PERSIST ORDER IN STORE & UPDATE INVENTORY
    if (typeof saveStoreOrder === "function") {
      saveStoreOrder(orderData);
    }

    // POST TO BACKEND ORDER API
    const orderApiUrl = `${getApiBaseUrl()}/api/orders`;

    fetch(orderApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => console.log("[ORDER TRACKING] Order synced to backend API:", data))
    .catch(err => console.warn("[ORDER TRACKING] Backend sync:", err));

    // DISPATCH NEW ORDER NOTIFICATION EMAIL TO STORE OWNER & CUSTOMER
    const emailEndpoint = `${getApiBaseUrl()}/api/orders/notify-email`;

    fetch(emailEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData)
    })
    .then(res => res.json())
    .then(data => console.log("[ORDER NOTIFICATION] Branded order email sent:", data))
    .catch(err => {
      console.warn("[ORDER NOTIFICATION] Primary dispatch failed, using direct HTTPS fallback:", err);
      // Direct HTTPS fallback from client if backend is sleeping or unreachable
      fetch("https://quad-ace-herbs.netlify.app/.netlify/functions/notify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      }).catch(e => console.warn("[ORDER NOTIFICATION] Netlify fallback:", e));
    });

    // Close Checkout Modal & Open Receipt
    closeCheckoutModal();
    showReceiptModal(orderData, waLink);

    // Only launch WhatsApp if the customer chose WhatsApp Checkout!
    // For Direct Bank Transfer, no need to go to WhatsApp — the order and payment proof are recorded directly.
    if (orderData.paymentMethod === "whatsapp") {
      window.open(waLink, "_blank");
    }

    // Clear cart & attached receipt
    state.cart = [];
    state.attachedReceiptData = null;
    state.attachedReceiptName = null;
    state.attachedReceiptSize = null;
    saveCart();
    updateCartUI();
  }

  // --- RECEIPT MODAL ---
  // --- RECEIPT MODAL ---
  function showReceiptModal(order, waLink) {
    document.getElementById("receiptOrderRef").textContent = order.orderRef;
    document.getElementById("receiptCustName").textContent = order.customer.name;
    document.getElementById("receiptCustPhone").textContent = order.customer.phone;
    document.getElementById("receiptCustAddress").textContent = order.customer.address;
    
    // Status text & icon
    const statusEl = document.getElementById("receiptPaymentStatus");
    const iconEl = document.getElementById("receiptStatusIcon");
    const titleEl = document.getElementById("receiptStatusTitle");
    const descEl = document.getElementById("receiptStatusDesc");
    const bankBox = document.getElementById("receiptBankConfirmationBox");
    const waBox = document.getElementById("receiptWhatsAppPromptBox");

    function renderReceiptStatus(status) {
      if (status === "verified" || status === "dispatched" || status === "delivered") {
        if (statusEl) {
          statusEl.textContent = "🟢 Payment Confirmed & Verified (Success) ✓";
          statusEl.style.color = "#15803d";
          statusEl.style.fontWeight = "800";
        }
        if (iconEl) {
          iconEl.textContent = "✅";
          iconEl.style.background = "#dcfce7";
          iconEl.style.color = "#15803d";
          iconEl.style.borderColor = "#86efac";
          iconEl.style.boxShadow = "0 0 15px rgba(22, 163, 74, 0.4)";
        }
        if (titleEl) {
          titleEl.textContent = "Payment Successfully Confirmed! 🎉";
          titleEl.style.color = "#166534";
        }
        if (descEl) {
          descEl.innerHTML = `
            <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 14px; margin: 10px 0; text-align: left;">
              <p style="margin: 0 0 6px 0; color: #15803d; font-weight: 800; font-size: 0.96rem;">
                ✓ Aduke Alagbo has verified your payment alert!
              </p>
              <p style="margin: 0 0 8px 0; color: #166534; font-size: 0.88rem; line-height: 1.5;">
                An official confirmation receipt has been sent to your email (<strong>${order.customer.email || 'your email'}</strong>).
              </p>
              <p style="margin: 0; color: #475569; font-size: 0.82rem; line-height: 1.4;">
                🌿 Your authentic herbal remedies are now being freshly prepared and packaged for dispatch. Our delivery rider will contact you on <strong>${order.customer.phone}</strong> before arrival!
              </p>
            </div>
          `;
        }
        if (bankBox) {
          bankBox.innerHTML = `
            <div style="background: #e8f7ee; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px; text-align: center; color: #15803d; font-weight: 700; font-size: 0.88rem;">
              ✓ Payment Verified in Kuda Bank • Preparing Package for Dispatch
            </div>
          `;
        }
        return true;
      }

      // Default Pending Status (Awaiting admin verification)
      if (order.paymentMethod === "bank") {
        if (order.receiptProof && order.receiptProof.hasReceipt) {
          if (statusEl) {
            statusEl.textContent = "🟡 Proof Attached — Verifying Bank Alert";
            statusEl.style.color = "#b45309";
            statusEl.style.fontWeight = "700";
          }
          if (iconEl) {
            iconEl.textContent = "🧾";
            iconEl.style.background = "rgba(245, 158, 11, 0.15)";
            iconEl.style.color = "#b45309";
            iconEl.style.borderColor = "#fde68a";
            iconEl.style.boxShadow = "none";
          }
          if (titleEl) {
            titleEl.textContent = "Proof of Payment Received! ⏳";
            titleEl.style.color = "var(--deep-forest)";
          }
          if (descEl) {
            descEl.innerHTML = "Your order is placed and your transfer receipt screenshot is recorded! <strong>Aduke Alagbo is verifying the payment alert in her Kuda bank account. Once confirmed in her dashboard, this screen will automatically change to Success and your confirmation email will be sent!</strong>";
          }
        } else {
          if (statusEl) {
            statusEl.textContent = "🟡 Awaiting Bank Alert Verification";
            statusEl.style.color = "#d97706";
            statusEl.style.fontWeight = "700";
          }
          if (iconEl) {
            iconEl.textContent = "⏳";
            iconEl.style.background = "rgba(245, 158, 11, 0.15)";
            iconEl.style.color = "#d97706";
            iconEl.style.borderColor = "#fde68a";
            iconEl.style.boxShadow = "none";
          }
          if (titleEl) {
            titleEl.textContent = "Order Submitted — Awaiting Verification";
            titleEl.style.color = "var(--deep-forest)";
          }
          if (descEl) {
            descEl.innerHTML = "Your order has been registered! <strong>Aduke Alagbo will verify the payment alert in her bank account. As soon as she confirms, your status automatically updates to Success here and you'll receive a confirmation email!</strong>";
          }
        }
      } else {
        if (statusEl) {
          statusEl.textContent = "💬 Order via WhatsApp (Pending Confirmation)";
          statusEl.style.color = "#27ae60";
        }
        if (iconEl) {
          iconEl.textContent = "💬";
          iconEl.style.background = "rgba(39, 174, 96, 0.15)";
          iconEl.style.color = "#27ae60";
          iconEl.style.borderColor = "#27ae60";
        }
        if (titleEl) titleEl.textContent = "WhatsApp Order Ready! 💬";
        if (descEl) descEl.innerHTML = "Your order details have been prepared for direct confirmation on WhatsApp.";
      }
      return false;
    }

    // Proof of Payment preview box in receipt modal
    const proofBox = document.getElementById("receiptAttachedProofBox");
    const proofImg = document.getElementById("receiptModalProofImg");
    const proofName = document.getElementById("receiptModalProofName");
    const proofSender = document.getElementById("receiptModalSenderDetails");
    const proofLink = document.getElementById("receiptModalViewLink");

    if (order.receiptProof && order.receiptProof.hasReceipt && proofBox) {
      proofBox.style.display = "block";
      if (proofImg && order.receiptProof.dataUrl) {
        proofImg.src = order.receiptProof.dataUrl;
        proofImg.onclick = () => window.open(order.receiptProof.dataUrl, "_blank");
      }
      if (proofName) proofName.textContent = order.receiptProof.fileName || "Transfer Receipt Screenshot";
      if (proofSender) {
        const sender = order.senderDetails && order.senderDetails.name 
          ? `Sender: ${order.senderDetails.name} (${order.senderDetails.bank || 'Bank'})` 
          : "Attached via checkout";
        proofSender.textContent = sender;
      }
      if (proofLink && order.receiptProof.dataUrl) {
        proofLink.onclick = (e) => {
          e.preventDefault();
          window.open(order.receiptProof.dataUrl, "_blank");
        };
      }
    } else if (proofBox) {
      proofBox.style.display = "none";
    }

    let receiptDeliveryText = "";
    if (order.shippingMethod === "nationwide") {
      receiptDeliveryText = "NATIONWIDE (Fee sorted with dispatch rider)";
    } else if (order.shippingMethod === "international") {
      receiptDeliveryText = "INTERNATIONAL (Fee sorted with courier)";
    } else if (order.shippingFee === 0) {
      receiptDeliveryText = "LOCAL (FREE Promo)";
    } else {
      receiptDeliveryText = `LOCAL (${formatMoney(order.shippingFee)})`;
    }
    document.getElementById("receiptShippingZone").textContent = receiptDeliveryText;
    document.getElementById("receiptPayMethod").textContent = order.paymentMethod === "bank" ? `Bank Transfer (${STORE_CONFIG.bankDetails.bankName})` : "WhatsApp Direct Order";
    document.getElementById("receiptTotalAmount").textContent = formatMoney(order.finalTotal);

    // Show Confirmation Notice for Bank Transfer vs Action Button for WhatsApp Order
    if (order.paymentMethod === "bank") {
      if (bankBox) bankBox.style.display = "block";
      if (waBox) waBox.style.display = "none";
    } else {
      if (bankBox) bankBox.style.display = "none";
      if (waBox) {
        waBox.style.display = "block";
        const waBtn = document.getElementById("receiptWhatsAppNotifyBtn");
        if (waBtn) {
          waBtn.innerHTML = `<span>💬 Send Order to Aduke Alagbo on WhatsApp</span>`;
          waBtn.onclick = () => window.open(waLink, "_blank");
        }
      }
    }

    // Reset Post-Purchase Review Box in Receipt Modal
    state.currentOrderForReview = order;
    state.selectedReceiptRating = 5;
    const reviewBox = document.getElementById("receiptReviewBox");
    const reviewInputs = document.getElementById("receiptReviewInputs");
    const reviewSuccess = document.getElementById("receiptReviewSuccess");
    const reviewCommentInput = document.getElementById("receiptCommentText");

    if (reviewBox && reviewInputs && reviewSuccess) {
      reviewInputs.style.display = "block";
      reviewSuccess.style.display = "none";
      if (reviewCommentInput) reviewCommentInput.value = "";
      updateStarPickerUI("receiptStarRating", "receiptRatingText", 5);
    }

    // Initial render of status UI
    const isAlreadyVerified = renderReceiptStatus(order.status || "pending");

    // Clear any existing poller
    if (state.receiptStatusWatcher) {
      clearInterval(state.receiptStatusWatcher);
      state.receiptStatusWatcher = null;
    }

    // LIVE STATUS WATCHER:
    // Real-time listener that watches for Aduke Alagbo verifying the payment alert in her admin dashboard!
    if (!isAlreadyVerified && (order.status === "pending" || !order.status)) {
      const checkAndUpdateLive = async () => {
        let verifiedStatus = null;

        // 1. Check local storage
        if (typeof getStoreOrders === "function") {
          const localOrders = getStoreOrders();
          const found = localOrders.find(o => o.orderRef === order.orderRef || o.orderRef === order.orderRef.replace(/^#/, ''));
          if (found && (found.status === "verified" || found.status === "dispatched" || found.status === "delivered")) {
            verifiedStatus = found.status;
          }
        }

        // 2. Check backend server API
        if (!verifiedStatus) {
          try {
            const cleanRef = order.orderRef.replace(/^#/, '');
            const res = await fetch(`${getApiBaseUrl()}/api/orders`);
            if (res.ok) {
              const data = await res.json();
              const serverOrders = data.orders || [];
              const foundServer = serverOrders.find(o => o.orderRef === order.orderRef || o.orderRef === `#${cleanRef}` || o.orderRef === cleanRef);
              if (foundServer && (foundServer.status === "verified" || foundServer.status === "dispatched" || foundServer.status === "delivered")) {
                verifiedStatus = foundServer.status;
              }
            }
          } catch (e) {}
        }

        if (verifiedStatus) {
          order.status = verifiedStatus;
          renderReceiptStatus(verifiedStatus);
          showToast(`🎉 Payment Confirmed! Aduke Alagbo verified your alert.`, "✓");
          if (state.receiptStatusWatcher) {
            clearInterval(state.receiptStatusWatcher);
            state.receiptStatusWatcher = null;
          }
        }
      };

      // Listen for window event dispatched when admin confirms payment in another tab
      const onStatusUpdated = (e) => {
        if (e.detail && (e.detail.orderRef === order.orderRef || e.detail.orderRef === order.orderRef.replace(/^#/, ''))) {
          if (e.detail.newStatus === "verified" || e.detail.newStatus === "dispatched" || e.detail.newStatus === "delivered") {
            order.status = e.detail.newStatus;
            renderReceiptStatus(e.detail.newStatus);
            showToast(`🎉 Payment Confirmed! Aduke Alagbo verified your alert.`, "✓");
            if (state.receiptStatusWatcher) {
              clearInterval(state.receiptStatusWatcher);
              state.receiptStatusWatcher = null;
            }
          }
        }
      };

      window.addEventListener("quadace_order_status_updated", onStatusUpdated, { once: true });
      window.addEventListener("storage", (e) => {
        if (e.key === "quadace_orders") {
          checkAndUpdateLive();
        }
      });

      // Poll every 3 seconds while receipt modal is open
      state.receiptStatusWatcher = setInterval(checkAndUpdateLive, 3000);
    }

    const receiptOverlay = document.getElementById("receiptModalOverlay");
    if (receiptOverlay) {
      receiptOverlay.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  function closeReceiptModal() {
    if (state.receiptStatusWatcher) {
      clearInterval(state.receiptStatusWatcher);
      state.receiptStatusWatcher = null;
    }
    const receiptOverlay = document.getElementById("receiptModalOverlay");
    if (receiptOverlay) receiptOverlay.classList.remove("active");
    checkAnyModalActive();
  }

  // --- FAST 1-CLICK WHATSAPP CART ORDER ---
  function quickCartWhatsAppOrder() {
    if (state.cart.length === 0) {
      showToast("Your cart is empty! Please add herbs first.", "⚠️");
      return;
    }

    // If user has not filled customer info yet, prompt them with the quick checkout modal
    openCheckoutModal();
    showToast("Please enter your name & address for fast WhatsApp dispatch!", "🌿");
  }

  // --- GLOBAL EXPORTS ---
  window.app = {
    addToCart,
    changeCartQty,
    removeFromCart,
    openCart,
    closeCart,
    openQuickView,
    closeQuickView,
    openCheckoutModal,
    closeCheckoutModal,
    closeReceiptModal,
    quickAdd: (id) => {
      addToCart(id);
      openCart();
    },
    filterByCategory: (catId) => {
      state.activeCategory = catId;
      renderCategories();
      renderProducts();
      window.location.hash = "#catalog";
    },
    resetFilters: () => {
      state.activeCategory = "all";
      state.activeSearch = "";
      const searchIn = document.getElementById("searchInput");
      if (searchIn) searchIn.value = "";
      renderCategories();
      renderProducts();
    },
    openBankInfoModal: () => {
      openCheckoutModal();
      setCheckoutStep(3);
    }
  };

  // --- DOCUMENT READY EVENT LISTENERS ---
  document.addEventListener("DOMContentLoaded", () => {
    loadCart();
    initStoreConfig();
    renderCategories();
    renderProducts();
    initRemedyQuiz();
    initAccordions();
    initCheckoutForm();
    updateCartUI();
    loadReviews();
    initStarRatings();
    initReceiptReviewHandler();
    initWriteReviewModal();
    initLoadMoreReviews();

    // Search Input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.activeSearch = e.target.value;
        renderProducts();
      });
    }

    // Sort Select
    const sortSelect = document.getElementById("sortSelect");
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        state.activeSort = e.target.value;
        renderProducts();
      });
    }

    // Cart Drawer Toggle
    document.getElementById("openCartBtn").addEventListener("click", openCart);
    document.getElementById("closeCartBtn").addEventListener("click", closeCart);
    document.getElementById("cartOverlay").addEventListener("click", (e) => {
      if (e.target.id === "cartOverlay") closeCart();
    });

    // Quick View Close
    document.getElementById("closeQuickViewBtn").addEventListener("click", closeQuickView);
    document.getElementById("quickViewOverlay").addEventListener("click", (e) => {
      if (e.target.id === "quickViewOverlay") closeQuickView();
    });

    // Quick View Add to Cart
    document.getElementById("qvAddToCartBtn").addEventListener("click", () => {
      if (state.currentQuickViewProduct) {
        addToCart(state.currentQuickViewProduct.id);
        closeQuickView();
        openCart();
      }
    });

    // Coupon Apply
    document.getElementById("applyCouponBtn").addEventListener("click", applyCoupon);
    document.getElementById("couponInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") applyCoupon();
    });

    // Cart Action Buttons
    document.getElementById("cartWhatsAppOrderBtn").addEventListener("click", quickCartWhatsAppOrder);
    document.getElementById("openCheckoutModalBtn").addEventListener("click", openCheckoutModal);
    document.getElementById("closeCheckoutBtn").addEventListener("click", closeCheckoutModal);

    // Receipt Modal Close (Bottom button & Top Close '✕' button)
    const closeReceiptBtn = document.getElementById("closeReceiptBtn");
    if (closeReceiptBtn) closeReceiptBtn.addEventListener("click", closeReceiptModal);

    const receiptTopCloseBtn = document.getElementById("receiptTopCloseBtn");
    if (receiptTopCloseBtn) receiptTopCloseBtn.addEventListener("click", closeReceiptModal);

    // Overlay backdrop click to dismiss modals safely
    ["checkoutModalOverlay", "receiptModalOverlay", "quickViewOverlay"].forEach(modalId => {
      const modalEl = document.getElementById(modalId);
      if (modalEl) {
        modalEl.addEventListener("click", (e) => {
          if (e.target === modalEl) {
            modalEl.classList.remove("active");
            checkAnyModalActive();
          }
        });
      }
    });

    // Escape key closes open modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeCheckoutModal();
        closeQuickView();
        closeReceiptModal();
      }
    });

    // Mobile Navigation Menu Toggle
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const navLinks = document.querySelector(".nav-links");
    if (mobileMenuBtn && navLinks) {
      mobileMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle("mobile-active");
        mobileMenuBtn.classList.toggle("active", isOpen);
        mobileMenuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
        const iconSpan = mobileMenuBtn.querySelector("span");
        if (iconSpan) {
          iconSpan.textContent = isOpen ? "✕" : "☰";
        }
      });

      navLinks.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
          navLinks.classList.remove("mobile-active");
          mobileMenuBtn.classList.remove("active");
          mobileMenuBtn.setAttribute("aria-expanded", "false");
          const iconSpan = mobileMenuBtn.querySelector("span");
          if (iconSpan) iconSpan.textContent = "☰";
        });
      });

      document.addEventListener("click", (e) => {
        if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          navLinks.classList.remove("mobile-active");
          mobileMenuBtn.classList.remove("active");
          mobileMenuBtn.setAttribute("aria-expanded", "false");
          const iconSpan = mobileMenuBtn.querySelector("span");
          if (iconSpan) iconSpan.textContent = "☰";
        }
      });
    }

    // Sticky Header Scroll Elevation Effect
    const mainHeader = document.querySelector(".main-header");
    if (mainHeader) {
      const handleHeaderScroll = () => {
        if (window.scrollY > 20) {
          mainHeader.classList.add("scrolled");
        } else {
          mainHeader.classList.remove("scrolled");
        }
      };
      window.addEventListener("scroll", handleHeaderScroll, { passive: true });
      handleHeaderScroll();
    }

    // Hidden Admin Shortcut: Press Ctrl + Shift + A to open admin portal secretly
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        window.location.href = "admin.html";
      }
    });

    // Real-time synchronization for products & categories added in Admin
    window.addEventListener("storage", (e) => {
      if (
        e.key === "quadace_custom_products" ||
        e.key === "quadace_deleted_products" ||
        e.key === "quadace_custom_categories" ||
        e.key === "quadace_deleted_categories"
      ) {
        renderCategories();
        renderProducts();
      }
    });
  });

})();
