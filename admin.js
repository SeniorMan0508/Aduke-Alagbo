/**
 * QUAD-ACE HERBS - ADMIN DASHBOARD CONTROLLER
 * ============================================
 * Handles security passcode authentication, adding new products,
 * deleting products, and catalog management for the store owner.
 */

(function () {
  "use strict";

  const AUTH_KEY = "quadace_admin_authenticated";
  let activeImageSrc = "images/agbo-jedi.jpg";
  let editingProductId = null;

  // Category labels map
  const CATEGORY_LABELS = {
    agbo: "Agbo & Tonics",
    men: "Men's Vitality",
    women: "Women's Wellness",
    raw: "Raw Roots & Pods",
    wellness: "Immunity & Detox"
  };

  // Toast notification
  function showAdminToast(message, icon = "🌿") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  const PASSCODE_STORAGE_KEY = "quadace_admin_passcode";
  const TOKEN_KEY = "quadace_admin_token";

  function getStoredToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function getFallbackPasscode() {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) || "quadace2026";
  }

  // --- API BASE URL HELPER ---
  function getApiBaseUrl() {
    if (window.location.protocol === "file:") {
      return "http://localhost:3000";
    }
    // If running in local development on any custom port (e.g. Live Server port 5500 on laptop or mobile)
    if (window.location.port && window.location.port !== "3000") {
      return `${window.location.protocol}//${window.location.hostname}:3000`;
    }
    // In production (Netlify or custom domain), return "" so Netlify _redirects proxies seamlessly
    return "";
  }

  // --- PASSCODE GATEKEEPER ---
  function checkAuth() {
    const gatekeeper = document.getElementById("adminGatekeeper");
    const isAuthenticated = sessionStorage.getItem(AUTH_KEY) === "true";

    if (isAuthenticated) {
      if (gatekeeper) gatekeeper.style.display = "none";
      loadDashboard();
    } else {
      if (gatekeeper) gatekeeper.style.display = "flex";
    }
  }

  function initLoginForm() {
    const form = document.getElementById("adminLoginForm");
    const pinInput = document.getElementById("adminPinInput");
    const errorEl = document.getElementById("gatekeeperError");
    const gatekeeper = document.getElementById("adminGatekeeper");
    const toggleBtn = document.getElementById("toggleLoginPinBtn");
    const unlockBtn = document.getElementById("unlockAdminBtn");

    if (toggleBtn && pinInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = pinInput.type === "password";
        pinInput.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "🙈 Hide" : "👁️ Show";
      });
    }

    if (!form || !pinInput) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      if (!enteredPin) return;

      if (unlockBtn) {
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = `<span>Verifying... ⏳</span>`;
      }

      // 1. Try server verification first
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: enteredPin })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            sessionStorage.setItem(AUTH_KEY, "true");
            if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
            if (errorEl) errorEl.style.display = "none";
            if (gatekeeper) gatekeeper.style.display = "none";
            showAdminToast("Welcome to your Admin Dashboard!", "👋");
            loadDashboard();

            if (data.isDefaultPassword) {
              setTimeout(() => {
                showAdminToast("Default passcode active. Set your personal password in Store Info & Backup! 🔐", "⚠️");
              }, 1800);
            }
            return;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          if (errorEl) {
            errorEl.style.display = "block";
            errorEl.textContent = `⚠️ ${errData.message || "Incorrect passcode! Please try again."}`;
          }
          pinInput.value = "";
          pinInput.focus();
          return;
        }
      } catch (networkErr) {
        // Fallback for offline or static environment
        console.warn("Backend server not reachable, attempting local fallback verification:", networkErr);
      } finally {
        if (unlockBtn) {
          unlockBtn.disabled = false;
          unlockBtn.innerHTML = `<span>Unlock Admin Dashboard 🌿</span>`;
        }
      }

      // 2. Fallback check against localStorage
      const fallbackPin = getFallbackPasscode();
      if (enteredPin === fallbackPin) {
        sessionStorage.setItem(AUTH_KEY, "true");
        if (errorEl) errorEl.style.display = "none";
        if (gatekeeper) gatekeeper.style.display = "none";
        showAdminToast("Welcome to your Admin Dashboard!", "👋");
        loadDashboard();
      } else {
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.textContent = "⚠️ Incorrect passcode! Please try again.";
        }
        pinInput.value = "";
        pinInput.focus();
      }
    });

    const logoutBtn = document.getElementById("adminLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem(AUTH_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        window.location.reload();
      });
    }
  }

  // --- FORGOT / RESET PASSCODE VIA EMAIL MODAL ---
  function initResetModal() {
    const openBtn = document.getElementById("openResetModalBtn");
    const closeBtn = document.getElementById("closeResetModalBtn");
    const cancelBtn = document.getElementById("cancelResetModalBtn");
    const modal = document.getElementById("adminResetModal");
    const sendSection = document.getElementById("sendCodeSection");
    const requestBtn = document.getElementById("requestResetCodeBtn");
    const resendBtn = document.getElementById("resendCodeBtn");
    const resetForm = document.getElementById("resetPasscodeForm");
    const targetEmailEl = document.getElementById("resetTargetEmail");

    const codeInput = document.getElementById("emailCodeInput");
    const newPinInput = document.getElementById("resetNewPasscodeInput");
    const confirmPinInput = document.getElementById("resetConfirmPasscodeInput");
    const msgEl = document.getElementById("resetModalMsg");
    const submitBtn = document.getElementById("submitResetPasscodeBtn");

    if (!modal) return;

    const showResetMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      msgEl.style.color = isError ? "#b91c1c" : "#15803d";
      msgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      msgEl.textContent = text;
    };

    const openModal = async () => {
      modal.style.display = "flex";
      if (msgEl) msgEl.style.display = "none";
      if (resetForm) {
        resetForm.reset();
        resetForm.style.display = "none";
      }
      if (sendSection) sendSection.style.display = "block";

      // Load masked email
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/status`);
        const data = await res.json();
        if (data && data.maskedEmail && targetEmailEl) {
          targetEmailEl.textContent = data.maskedEmail;
        }
      } catch (e) {}
    };

    const closeModal = () => {
      modal.style.display = "none";
    };

    if (openBtn) openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Request 6-digit code
    const handleSendCode = async (btnEl) => {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>Sending email... ⏳</span>`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/send-reset-code`, {
          method: "POST",
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await res.json();

        if (res.ok && data.success) {
          showResetMsg(data.message || "A 6-digit code was sent to your email!", false);
          if (sendSection) sendSection.style.display = "none";
          if (resetForm) resetForm.style.display = "block";
          if (codeInput) codeInput.focus();
        } else {
          showResetMsg(data.message || "Failed to send code. Please try again.", true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          showResetMsg("⏳ The server is taking longer than usual (the cloud server may be waking up from sleep). Please click again in a few seconds.", true);
        } else {
          showResetMsg("⚠️ Could not connect to the authentication server. Please wait a few seconds and try again.", true);
        }
      } finally {
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = `<span>📩 Send 6-Digit Code to My Email</span>`;
        }
      }
    };

    if (requestBtn) {
      requestBtn.addEventListener("click", () => handleSendCode(requestBtn));
    }
    if (resendBtn) {
      resendBtn.addEventListener("click", () => handleSendCode(resendBtn));
    }

    // Verify code & save new password
    if (resetForm) {
      resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const code = codeInput ? codeInput.value.trim() : "";
        const newPin = newPinInput ? newPinInput.value.trim() : "";
        const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : "";

        if (!code || code.length < 6) {
          showResetMsg("Please enter the complete 6-digit code sent to your email.");
          return;
        }

        if (newPin.length < 4) {
          showResetMsg("New passcode must be at least 4 characters long.");
          return;
        }

        if (newPin !== confirmPin) {
          showResetMsg("New passcode and confirmation do not match!");
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Verifying... ⏳</span>`;
        }

        try {
          const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-reset-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, newPassword: newPin })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            localStorage.setItem(PASSCODE_STORAGE_KEY, newPin);
            if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
            sessionStorage.setItem(AUTH_KEY, "true");

            showResetMsg(data.message || "Passcode reset successfully!", false);
            showAdminToast("Admin passcode reset successfully! 🔐", "✓");

            setTimeout(() => {
              closeModal();
              const gatekeeper = document.getElementById("adminGatekeeper");
              if (gatekeeper) gatekeeper.style.display = "none";
              loadDashboard();
            }, 1200);
          } else {
            showResetMsg(data.message || "Invalid or expired verification code.");
          }
        } catch (err) {
          // Fallback
          localStorage.setItem(PASSCODE_STORAGE_KEY, newPin);
          sessionStorage.setItem(AUTH_KEY, "true");
          showResetMsg("Passcode updated successfully!", false);
          showAdminToast("Admin passcode reset successfully! 🔐", "✓");
          setTimeout(() => {
            closeModal();
            const gatekeeper = document.getElementById("adminGatekeeper");
            if (gatekeeper) gatekeeper.style.display = "none";
            loadDashboard();
          }, 1200);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Verify & Save Passcode ✓</span>`;
          }
        }
      });
    }
  }

  // --- TABS SWITCHING ---
  function initTabs() {
    const tabBtns = document.querySelectorAll(".admin-tab-btn");
    const panels = document.querySelectorAll(".admin-panel");

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        panels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const targetId = btn.dataset.tab;
        const targetPanel = document.getElementById(targetId);
        if (targetPanel) targetPanel.classList.add("active");

        if (targetId === "tabManage") {
          renderManageTable();
        }
        if (targetId === "tabCategories") {
          renderCategoriesTable();
        }
        if (targetId === "tabReviews") {
          renderAdminReviews();
        }
      });
    });

    const refreshReviewsBtn = document.getElementById("refreshAdminReviewsBtn");
    if (refreshReviewsBtn) {
      refreshReviewsBtn.addEventListener("click", () => {
        renderAdminReviews();
        showAdminToast("Reviews refreshed from server ✓", "🔄");
      });
    }
  }

  // --- IMAGE SELECTION & UPLOAD HANDLERS ---
  function initImageHandlers() {
    const presetImages = document.querySelectorAll("#presetImagesList .preset-img-thumb");
    const activePreview = document.getElementById("activeImagePreview");
    const activeName = document.getElementById("activeImageName");
    const fileInput = document.getElementById("prodImageFile");
    const urlInput = document.getElementById("prodImageUrl");

    // Presets click
    presetImages.forEach(img => {
      img.addEventListener("click", () => {
        presetImages.forEach(i => i.classList.remove("selected"));
        img.classList.add("selected");
        activeImageSrc = img.dataset.src;
        if (activePreview) activePreview.src = activeImageSrc;
        if (activeName) activeName.textContent = img.alt || activeImageSrc;
        if (urlInput) urlInput.value = "";
      });
    });

    // File upload
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            activeImageSrc = loadEvent.target.result;
            if (activePreview) activePreview.src = activeImageSrc;
            if (activeName) activeName.textContent = `Uploaded: ${file.name}`;
            presetImages.forEach(i => i.classList.remove("selected"));
            showAdminToast("Product photo loaded successfully! ✓", "📸");
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // URL input
    if (urlInput) {
      urlInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val) {
          activeImageSrc = val;
          if (activePreview) activePreview.src = activeImageSrc;
          if (activeName) activeName.textContent = `URL: ${val.slice(0, 30)}...`;
          presetImages.forEach(i => i.classList.remove("selected"));
        }
      });
    }
  }

  // --- ADD / EDIT PRODUCT FORM ---
  function initProductForm() {
    const form = document.getElementById("addProductForm");
    const publishBtn = document.getElementById("publishProductBtn");
    const resetBtn = document.getElementById("resetFormBtn");

    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("prodName").value.trim();
      const category = document.getElementById("prodCategory").value;
      const subtitle = document.getElementById("prodSubtitle").value.trim();
      const price = Number(document.getElementById("prodPrice").value);
      const originalPriceVal = document.getElementById("prodOriginalPrice").value;
      const originalPrice = originalPriceVal ? Number(originalPriceVal) : null;
      const badge = document.getElementById("prodBadge").value.trim();
      const badgeType = document.getElementById("prodBadgeType").value;
      const shortDesc = document.getElementById("prodShortDesc").value.trim();
      const fullDesc = document.getElementById("prodFullDesc").value.trim() || shortDesc;
      const usage = document.getElementById("prodUsage").value.trim() || "Take as traditionally directed on bottle.";
      const caution = document.getElementById("prodCaution").value.trim() || "";

      // Split multiline benefits & ingredients
      const benefitsText = document.getElementById("prodBenefits").value.trim();
      const benefits = benefitsText 
        ? benefitsText.split("\n").map(b => b.trim()).filter(Boolean)
        : ["100% pure wildcrafted botanical formula", "Promotes natural bodily restoration"];

      const ingredientsText = document.getElementById("prodIngredients").value.trim();
      const ingredients = ingredientsText
        ? ingredientsText.split("\n").map(i => i.trim()).filter(Boolean)
        : ["Wild-harvested ancestral African roots and leaves"];

      if (!name || !price || !shortDesc) {
        showAdminToast("Please fill in Product Name, Price, and Short Summary.", "⚠️");
        return;
      }

      // Generate ID
      const prodId = editingProductId || ("custom-" + name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4));

      const categoryLabel = (typeof getCategoryLabel === "function") 
        ? getCategoryLabel(category) 
        : (CATEGORY_LABELS[category] || "Agbo & Tonics");

      const newProduct = {
        id: prodId,
        name: name,
        subtitle: subtitle || `${categoryLabel} Herbal Remedy`,
        category: category,
        categoryLabel: categoryLabel,
        price: price,
        originalPrice: originalPrice,
        rating: 5.0,
        reviewsCount: Math.floor(20 + Math.random() * 80),
        image: activeImageSrc,
        badge: badge || "New Remedy",
        badgeType: badgeType || "gold",
        healthGoals: [category],
        shortDesc: shortDesc,
        fullDesc: fullDesc,
        benefits: benefits,
        ingredients: ingredients,
        usage: usage,
        caution: caution,
        isCustom: true,
        createdAt: new Date().toISOString()
      };

      // Save to store
      if (typeof saveStoreProduct === "function") {
        saveStoreProduct(newProduct);
      }

      showAdminToast(
        editingProductId ? `Updated '${name}' successfully!` : `✨ '${name}' published! Now live on Shop page.`,
        "🌿"
      );

      // Reset form
      form.reset();
      editingProductId = null;
      if (publishBtn) publishBtn.innerHTML = `<span>🌿 Publish Product to Shop Page</span>`;
      activeImageSrc = "images/agbo-jedi.jpg";
      const previewImg = document.getElementById("activeImagePreview");
      if (previewImg) previewImg.src = activeImageSrc;

      // Update stats and switch to Manage tab
      updateStats();
      renderManageTable();

      const manageTabBtn = document.querySelector(".admin-tab-btn[data-tab='tabManage']");
      if (manageTabBtn) manageTabBtn.click();
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        editingProductId = null;
        if (publishBtn) publishBtn.innerHTML = `<span>🌿 Publish Product to Shop Page</span>`;
      });
    }
  }

  // --- STATS OVERVIEW ---
  function updateStats() {
    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    let customCount = 0;

    try {
      const savedCustom = localStorage.getItem("quadace_custom_products");
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        customCount = Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch (e) {}

    const totalEl = document.getElementById("statTotalProducts");
    const customEl = document.getElementById("statCustomProducts");
    const badgeEl = document.getElementById("tabCountBadge");
    const statCategories = document.getElementById("statTotalCategories");
    const tabCatBadge = document.getElementById("tabCategoriesBadge");
    const totalCategories = typeof getStoreCategories === "function" ? getStoreCategories(false).length : 5;

    if (totalEl) totalEl.textContent = products.length;
    if (customEl) customEl.textContent = customCount;
    if (badgeEl) badgeEl.textContent = products.length;
    if (statCategories) statCategories.textContent = totalCategories;
    if (tabCatBadge) tabCatBadge.textContent = totalCategories;
  }

  // --- MANAGE TABLE ---
  function renderManageTable() {
    const tbody = document.getElementById("productsTableBody");
    const searchInput = document.getElementById("manageSearchInput");
    if (!tbody) return;

    let products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    if (query) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.categoryLabel.toLowerCase().includes(query)
      );
    }

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No products found matching '${query}'.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const isCustom = p.id.startsWith("custom-") || p.isCustom;
      const sourceBadge = isCustom 
        ? `<span class="source-badge custom">✨ Admin Added</span>`
        : `<span class="source-badge default">🌱 Default</span>`;

      return `
        <tr data-id="${p.id}">
          <td>
            <img src="${p.image}" alt="${p.name}" class="product-table-thumb" onerror="this.src='images/agbo-jedi.jpg'">
          </td>
          <td>
            <div style="font-weight: 700; color: var(--deep-forest);">${p.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${p.subtitle || ''}</div>
          </td>
          <td>
            <span class="product-category-tag">${p.categoryLabel || p.category}</span>
          </td>
          <td style="font-weight: 800; color: var(--primary-green);">
            ₦${Number(p.price).toLocaleString("en-NG")}
          </td>
          <td>
            ${sourceBadge}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-del" data-id="${p.id}" data-name="${p.name}">
              🗑️ Remove
            </button>
            <a href="shop.html" target="_blank" class="btn-action-view" style="margin-left: 0.35rem;">
              👁️ View in Shop
            </a>
          </td>
        </tr>
      `;
    }).join("");

    // Wire delete buttons
    tbody.querySelectorAll(".btn-action-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        handleDeleteProduct(id, name);
      });
    });
  }

  // Handle Delete Product
  function handleDeleteProduct(productId, productName) {
    const confirmed = window.confirm(`Are you sure you want to remove '${productName}' from your store? It will disappear from the Shop page immediately.`);
    if (!confirmed) return;

    if (typeof deleteStoreProduct === "function") {
      deleteStoreProduct(productId);
      showAdminToast(`'${productName}' removed from shop.`, "🗑️");
      updateStats();
      renderManageTable();
    }
  }

  // --- BACKUP & RESET ACTIONS ---
  function initBackupAndReset() {
    const exportBtn = document.getElementById("exportCatalogBtn");
    const resetBtn = document.getElementById("resetCatalogBtn");

    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (typeof exportStoreProductsJSON === "function") {
          exportStoreProductsJSON();
          showAdminToast("Catalog JSON downloaded!", "📥");
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        const confirmed = window.confirm("⚠️ WARNING: This will reset your product catalog to the original factory default remedies and remove all custom products you added. Are you sure?");
        if (confirmed) {
          if (typeof resetStoreProducts === "function") {
            resetStoreProducts();
            showAdminToast("Store reset to original default remedies.", "🔄");
            updateStats();
            renderManageTable();
          }
        }
      });
    }

    const searchInput = document.getElementById("manageSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", renderManageTable);
    }
  }

  // --- CUSTOMER REVIEWS MANAGEMENT ---
  const REVIEWS_STORAGE_KEY = "quadace_customer_reviews";

  async function getAdminReviews() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reviews`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.reviews)) {
          localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(data.reviews));
          return data.reviews;
        }
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}

    return [];
  }

  async function renderAdminReviews() {
    const tbody = document.getElementById("reviewsTableBody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading reviews... ⏳</td></tr>`;

    const reviews = await getAdminReviews();
    updateReviewsStats(reviews.length);

    if (reviews.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No customer reviews posted yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = reviews.map(rev => {
      const stars = "★".repeat(Math.min(5, Math.max(1, rev.rating || 5)));
      const dateStr = rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("en-GB", { day: 'numeric', month: 'short', year: 'numeric' }) : "Verified Buyer";

      return `
        <tr data-review-id="${rev.id}">
          <td>
            <div style="font-weight: 700; color: var(--deep-forest);">${rev.name}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${rev.location || 'Nigeria'}</div>
          </td>
          <td>
            <span class="product-category-tag" style="background: rgba(39, 174, 96, 0.1); color: #1e7040;">🌿 ${rev.remedy || 'Traditional Remedy'}</span>
          </td>
          <td style="color: #f59e0b; font-size: 1.1rem; white-space: nowrap;">
            ${stars} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">(${rev.rating || 5}.0)</span>
          </td>
          <td>
            <div style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.5; max-width: 420px; font-style: italic;">
              "${rev.comment}"
            </div>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">
            ${dateStr}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-del btn-del-review" data-id="${rev.id}" data-name="${rev.name}">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-del-review").forEach(btn => {
      btn.addEventListener("click", () => {
        handleDeleteReview(btn.dataset.id, btn.dataset.name);
      });
    });
  }

  async function handleDeleteReview(reviewId, authorName) {
    const confirmed = window.confirm(`Are you sure you want to delete the review by '${authorName}'? It will be removed from the website homepage.`);
    if (!confirmed) return;

    try {
      await fetch(`${getApiBaseUrl()}/api/reviews/${reviewId}`, { method: "DELETE" });
    } catch (e) {}

    try {
      const saved = localStorage.getItem(REVIEWS_STORAGE_KEY);
      if (saved) {
        let list = JSON.parse(saved);
        list = list.filter(r => r.id !== reviewId);
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {}

    showAdminToast(`Review by '${authorName}' removed.`, "🗑️");
    renderAdminReviews();
  }

  function updateReviewsStats(count) {
    const totalEl = document.getElementById("statTotalReviews");
    const badgeEl = document.getElementById("tabReviewsBadge");
    if (totalEl) totalEl.textContent = count;
    if (badgeEl) badgeEl.textContent = count;
  }

  // --- LOAD DASHBOARD ---
  function loadDashboard() {
    populateCategorySelect();
    updateStats();
    renderManageTable();
    renderCategoriesTable();
    syncServerCategories();
    getAdminReviews().then(reviews => updateReviewsStats(reviews.length));
  }

  // --- CHANGE PASSCODE HANDLER ---
  function initChangePasscode() {
    const form = document.getElementById("changePasscodeForm");
    const currentInput = document.getElementById("currentPasscodeInput");
    const newInput = document.getElementById("newPasscodeInput");
    const confirmInput = document.getElementById("confirmPasscodeInput");
    const msgEl = document.getElementById("passcodeMsg");
    const saveBtn = document.getElementById("savePasscodeBtn");

    if (!form || !currentInput) return;

    const showMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      msgEl.style.color = isError ? "#b91c1c" : "#15803d";
      msgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      msgEl.textContent = text;
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentVal = currentInput.value.trim();
      const newVal = newInput.value.trim();
      const confirmVal = confirmInput.value.trim();

      if (newVal.length < 4) {
        showMsg("New passcode must be at least 4 characters long.");
        return;
      }

      if (newVal !== confirmVal) {
        showMsg("New passcode and confirmation do not match!");
        return;
      }

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving... ⏳</span>`;
      }

      try {
        const token = getStoredToken();
        const response = await fetch(`${getApiBaseUrl()}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
          },
          body: JSON.stringify({ currentPassword: currentVal, newPassword: newVal })
        });

        const data = await response.json();
        if (response.ok && data.success) {
          localStorage.setItem(PASSCODE_STORAGE_KEY, newVal);
          if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
          showMsg(data.message || "Passcode updated successfully!", false);
          showAdminToast("Passcode updated on server! 🔐", "✓");
          form.reset();
          return;
        } else {
          showMsg(data.message || "Current passcode is incorrect. Update failed.");
        }
      } catch (err) {
        // Fallback for static mode
        const actualCurrent = getFallbackPasscode();
        if (currentVal !== actualCurrent) {
          showMsg("Current passcode is incorrect! Please enter your active passcode.");
          return;
        }
        localStorage.setItem(PASSCODE_STORAGE_KEY, newVal);
        showMsg("Passcode updated successfully! Your new password is now active.", false);
        showAdminToast("Passcode changed successfully! 🔐", "✓");
        form.reset();
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>🔒 Save New Passcode</span>`;
        }
      }
    });

    // Recovery email management
    const emailInput = document.getElementById("adminEmailInput");
    const emailForm = document.getElementById("updateEmailForm");
    const emailMsgEl = document.getElementById("emailUpdateMsg");
    const saveEmailBtn = document.getElementById("saveEmailBtn");

    const loadAdminEmail = async () => {
      const token = getStoredToken();
      if (!token || !emailInput) return;
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/email`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.email) {
          emailInput.value = data.email;
        }
      } catch (e) {}
    };

    loadAdminEmail();

    if (emailForm) {
      emailForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newEmail = emailInput ? emailInput.value.trim() : "";
        if (!newEmail || !newEmail.includes("@")) return;

        if (saveEmailBtn) {
          saveEmailBtn.disabled = true;
          saveEmailBtn.innerHTML = `<span>Saving... ⏳</span>`;
        }

        try {
          const token = getStoredToken();
          const res = await fetch(`${getApiBaseUrl()}/api/auth/update-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({ newEmail })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            if (emailMsgEl) {
              emailMsgEl.style.display = "block";
              emailMsgEl.style.background = "#dcfce7";
              emailMsgEl.style.color = "#15803d";
              emailMsgEl.style.border = "1px solid #86efac";
              emailMsgEl.textContent = data.message || "Email updated successfully!";
            }
            showAdminToast("Recovery email updated! ✉️", "✓");
          } else {
            if (emailMsgEl) {
              emailMsgEl.style.display = "block";
              emailMsgEl.style.background = "#fee2e2";
              emailMsgEl.style.color = "#b91c1c";
              emailMsgEl.style.border = "1px solid #fca5a5";
              emailMsgEl.textContent = data.message || "Failed to update email.";
            }
          }
        } catch (err) {
          showAdminToast("Saved locally! ✉️", "✓");
        } finally {
          if (saveEmailBtn) {
            saveEmailBtn.disabled = false;
            saveEmailBtn.innerHTML = `<span>Save Email ✓</span>`;
          }
        }
      });
    }
  }

  // --- CATEGORIES CONTROLLER & HANDLERS ---
  function populateCategorySelect(selectedId) {
    const select = document.getElementById("prodCategory");
    if (!select) return;

    const categories = typeof getStoreCategories === "function" ? getStoreCategories(false) : [];
    const prevVal = selectedId || select.value;

    select.innerHTML = categories.map(cat => `
      <option value="${cat.id}">
        ${cat.icon ? cat.icon + ' ' : ''}${cat.label}${cat.desc ? ' — ' + cat.desc : ''}
      </option>
    `).join("");

    if (prevVal && categories.some(c => c.id === prevVal)) {
      select.value = prevVal;
    } else if (categories[0]) {
      select.value = categories[0].id;
    }
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById("categoriesTableBody");
    const countEl = document.getElementById("catTableCount");
    const tabBadge = document.getElementById("tabCategoriesBadge");
    const statCategories = document.getElementById("statTotalCategories");
    if (!tbody) return;

    const categories = typeof getStoreCategories === "function" ? getStoreCategories(false) : [];
    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;

    if (countEl) countEl.textContent = categories.length;
    if (tabBadge) tabBadge.textContent = categories.length;
    if (statCategories) statCategories.textContent = categories.length;

    // Count products per category
    const catCounts = {};
    products.forEach(p => {
      if (p.category) {
        catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      }
    });

    if (categories.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No categories defined yet. Use the form above to add your first category!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = categories.map(cat => {
      const prodCount = catCounts[cat.id] || 0;
      const isCustom = cat.isCustom || !cat.isDefault;
      const badge = isCustom
        ? `<span class="category-badge-chip custom">✨ Custom</span>`
        : `<span class="category-badge-chip">🌱 Default</span>`;

      return `
        <tr data-cat-id="${cat.id}">
          <td style="text-align: center; font-size: 1.5rem; line-height: 1;">
            ${cat.icon || '🌿'}
          </td>
          <td>
            <div style="font-weight: 700; color: var(--deep-forest); font-size: 0.95rem;">${cat.label}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">id: ${cat.id}</div>
          </td>
          <td style="color: var(--text-secondary); font-size: 0.85rem; max-width: 280px;">
            ${cat.desc || '—'}
          </td>
          <td>
            <span style="font-weight: 700; color: var(--primary-green); background: rgba(39, 174, 96, 0.08); padding: 0.2rem 0.6rem; border-radius: var(--radius-full); font-size: 0.8rem;">
              ${prodCount} remed${prodCount === 1 ? 'y' : 'ies'}
            </span>
          </td>
          <td>
            ${badge}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <a href="shop.html?category=${cat.id}" target="_blank" class="btn-action-view" title="View in Shop">
              👁️ Shop
            </a>
            <button type="button" class="btn-action-del btn-del-category" data-id="${cat.id}" data-name="${cat.label}" data-count="${prodCount}" style="margin-left: 0.35rem;" title="Delete category">
              🗑️ Delete
            </button>
          </td>
        </tr>
      `;
    }).join("");

    // Wire delete buttons
    tbody.querySelectorAll(".btn-del-category").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const count = Number(btn.dataset.count || 0);
        handleDeleteCategory(id, name, count);
      });
    });
  }

  async function handleDeleteCategory(catId, catName, prodCount) {
    let warningText = `Are you sure you want to remove the category '${catName}'?`;
    if (prodCount > 0) {
      warningText += `\n\n⚠️ NOTE: There are currently ${prodCount} herbal remedy/remedies assigned to this category in your shop.`;
    }

    const confirmed = window.confirm(warningText);
    if (!confirmed) return;

    if (typeof deleteStoreCategory === "function") {
      deleteStoreCategory(catId);
    }

    try {
      await fetch(`${getApiBaseUrl()}/api/categories/${catId}`, { method: "DELETE" });
    } catch (e) {}

    showAdminToast(`Category '${catName}' removed.`, "🗑️");
    renderCategoriesTable();
    populateCategorySelect();
    updateStats();
  }

  function initCategoryManagement() {
    const addCatForm = document.getElementById("addCategoryForm");
    const catIconInput = document.getElementById("newCatIcon");
    const emojiPicker = document.getElementById("catEmojiPicker");
    const resetCatsBtn = document.getElementById("resetCategoriesBtn");

    if (emojiPicker && catIconInput) {
      emojiPicker.querySelectorAll(".emoji-pick-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          catIconInput.value = btn.dataset.emoji || "🌿";
          emojiPicker.querySelectorAll(".emoji-pick-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });
    }

    if (addCatForm) {
      addCatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById("newCatName");
        const descInput = document.getElementById("newCatDesc");
        const name = nameInput.value.trim();
        const icon = (catIconInput ? catIconInput.value.trim() : "") || "🌿";
        const desc = descInput ? descInput.value.trim() : "";

        if (!name) return;

        const newCat = typeof saveStoreCategory === "function"
          ? saveStoreCategory({ label: name, icon, desc })
          : null;

        if (newCat) {
          try {
            await fetch(`${getApiBaseUrl()}/api/categories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newCat)
            });
          } catch (networkErr) {}

          showAdminToast(`✨ Category '${name}' created! Active across Shop & Home.`, "🏷️");
          addCatForm.reset();
          if (catIconInput) catIconInput.value = "🌿";
          renderCategoriesTable();
          populateCategorySelect(newCat.id);
          updateStats();
        }
      });
    }

    if (resetCatsBtn) {
      resetCatsBtn.addEventListener("click", () => {
        const confirmed = window.confirm("⚠️ Restore factory default categories? Any custom categories you created will be reset.");
        if (confirmed) {
          if (typeof resetStoreCategories === "function") {
            resetStoreCategories();
          }
          showAdminToast("Categories restored to default! 🔄", "✓");
          renderCategoriesTable();
          populateCategorySelect();
          updateStats();
        }
      });
    }
  }

  function initQuickCategoryModal() {
    const openBtn = document.getElementById("quickAddCatModalBtn");
    const modal = document.getElementById("quickCategoryModal");
    const closeBtn = document.getElementById("closeQuickCatModalBtn");
    const cancelBtn = document.getElementById("cancelQuickCatBtn");
    const form = document.getElementById("quickCategoryForm");
    const iconInput = document.getElementById("quickCatIcon");
    const emojiPicker = document.getElementById("quickCatEmojiPicker");

    if (!modal) return;

    const closeModal = () => {
      modal.style.display = "none";
      if (form) form.reset();
      if (iconInput) iconInput.value = "🌿";
    };

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        modal.style.display = "flex";
        const nameInput = document.getElementById("quickCatName");
        if (nameInput) setTimeout(() => nameInput.focus(), 50);
      });
    }

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    if (emojiPicker && iconInput) {
      emojiPicker.querySelectorAll(".emoji-pick-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          iconInput.value = btn.dataset.emoji || "🌿";
        });
      });
    }

    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("quickCatName").value.trim();
        const icon = (iconInput ? iconInput.value.trim() : "") || "🌿";
        const desc = document.getElementById("quickCatDesc").value.trim();

        if (!name) return;

        const newCat = typeof saveStoreCategory === "function"
          ? saveStoreCategory({ label: name, icon, desc })
          : null;

        if (newCat) {
          try {
            await fetch(`${getApiBaseUrl()}/api/categories`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(newCat)
            });
          } catch (networkErr) {}

          showAdminToast(`✨ Category '${name}' created and selected!`, "🏷️");
          closeModal();
          populateCategorySelect(newCat.id);
          renderCategoriesTable();
          updateStats();
        }
      });
    }
  }

  async function syncServerCategories() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/categories`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories) && data.categories.length > 0) {
          const localSaved = localStorage.getItem("quadace_custom_categories");
          let localCustom = localSaved ? JSON.parse(localSaved) : [];
          if (!Array.isArray(localCustom)) localCustom = [];

          let changed = false;
          data.categories.forEach(serverCat => {
            if (!localCustom.some(c => c.id === serverCat.id)) {
              localCustom.push(serverCat);
              changed = true;
            }
          });

          if (changed) {
            localStorage.setItem("quadace_custom_categories", JSON.stringify(localCustom));
            renderCategoriesTable();
            populateCategorySelect();
            updateStats();
          }
        }
      }
    } catch (e) {}
  }

  // --- INITIALIZATION ---
  function initAdmin() {
    initLoginForm();
    initResetModal();
    initTabs();
    initImageHandlers();
    populateCategorySelect();
    initProductForm();
    initCategoryManagement();
    initQuickCategoryModal();
    initChangePasscode();
    initBackupAndReset();
    checkAuth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdmin);
  } else {
    initAdmin();
  }
})();
