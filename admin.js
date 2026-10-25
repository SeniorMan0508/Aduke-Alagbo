/**
 * ADUKE ALAGBO - ADMIN DASHBOARD CONTROLLER
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
    return sessionStorage.getItem(TOKEN_KEY) || sessionStorage.getItem("aduke_admin_token") || "";
  }

  function getFallbackPasscode() {
    return localStorage.getItem(PASSCODE_STORAGE_KEY) || "";
  }

  // --- HTML ENTITY ENCODING (Stored & Reflected XSS Protection) ---
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- API BASE URL HELPER (Auto-routes to current host or local server) ---
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

  // --- AUTHENTICATED FETCH HELPER (Automatically attaches Bearer Session Token) ---
  function authFetch(url, options = {}) {
    const token = getStoredToken();
    const headers = {
      ...(options.headers || {})
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers }).then(res => {
      if (res.status === 401) {
        console.warn("[ADMIN AUTH] Unauthorized response received (401). Session may be invalid or expired.");
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem("aduke_admin_token");
        const gatekeeper = document.getElementById("adminGatekeeper");
        if (gatekeeper) {
          gatekeeper.style.display = "flex";
          const errEl = document.getElementById("gatekeeperError");
          if (errEl) {
            errEl.style.display = "block";
            errEl.textContent = "Your session expired after the server update. Please enter your passcode to reconnect.";
          }
        }
      }
      return res;
    });
  }

  // --- PASSCODE GATEKEEPER ---
  function checkAuth() {
    const gatekeeper = document.getElementById("adminGatekeeper");
    const isAuthenticated = sessionStorage.getItem(AUTH_KEY) === "true";
    const token = getStoredToken();

    if (isAuthenticated && token) {
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

      // 2. Fallback check against localStorage passcode
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

    // Emergency Reset Elements
    const toggleEmergencyBtn = document.getElementById("toggleEmergencyResetBtn");
    const emergencyForm = document.getElementById("emergencyResetForm");
    const emergencyMasterKeyInput = document.getElementById("emergencyMasterKeyInput");
    const emergencyNewPasscodeInput = document.getElementById("emergencyNewPasscodeInput");
    const emergencyMsgEl = document.getElementById("emergencyResetMsg");
    const submitEmergencyBtn = document.getElementById("submitEmergencyResetBtn");

    const OWNER_EMAIL = "badmusdaniel0508@gmail.com";

    if (!modal) return;

    const showResetMsg = (text, isError = true) => {
      if (!msgEl) return;
      msgEl.style.display = "block";
      msgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      msgEl.style.color = isError ? "#b91c1c" : "#15803d";
      msgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      msgEl.textContent = text;
    };

    const showEmergencyMsg = (text, isError = true) => {
      if (!emergencyMsgEl) return;
      emergencyMsgEl.style.display = "block";
      emergencyMsgEl.style.background = isError ? "#fee2e2" : "#dcfce7";
      emergencyMsgEl.style.color = isError ? "#b91c1c" : "#15803d";
      emergencyMsgEl.style.border = isError ? "1px solid #fca5a5" : "1px solid #86efac";
      emergencyMsgEl.textContent = text;
    };

    const openModal = async () => {
      modal.style.display = "flex";
      if (msgEl) msgEl.style.display = "none";
      if (emergencyMsgEl) emergencyMsgEl.style.display = "none";
      if (emergencyForm) emergencyForm.style.display = "none";
      if (resetForm) {
        resetForm.reset();
        resetForm.style.display = "none";
      }
      if (sendSection) sendSection.style.display = "block";

      // Load masked email
      if (targetEmailEl) {
        targetEmailEl.textContent = OWNER_EMAIL;
      }
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/auth/status`);
        const data = await res.json();
        if (data && data.maskedEmail && targetEmailEl) {
          targetEmailEl.textContent = `${OWNER_EMAIL} (${data.maskedEmail})`;
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

    // Toggle emergency master recovery form
    if (toggleEmergencyBtn && emergencyForm) {
      toggleEmergencyBtn.addEventListener("click", () => {
        const isHidden = emergencyForm.style.display === "none";
        emergencyForm.style.display = isHidden ? "block" : "none";
        if (isHidden && emergencyMasterKeyInput) {
          emergencyMasterKeyInput.focus();
        }
      });
    }

    // Emergency master key submit handler (Server Authenticated)
    if (emergencyForm) {
      emergencyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const masterKey = emergencyMasterKeyInput ? emergencyMasterKeyInput.value.trim() : "";
        const newPass = emergencyNewPasscodeInput ? emergencyNewPasscodeInput.value.trim() : "";

        if (!masterKey) {
          showEmergencyMsg("Master Recovery Key is required.");
          return;
        }

        if (newPass.length < 8) {
          showEmergencyMsg("New passcode must be at least 8 characters long.");
          return;
        }

        const submitBtn = document.getElementById("submitEmergencyResetBtn");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Verifying Key... ⏳</span>`;
        }

        try {
          const res = await fetch(`${getApiBaseUrl()}/api/auth/emergency-reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ masterKey, newPassword: newPass })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.token) {
              sessionStorage.setItem("aduke_admin_token", data.token);
            }
            sessionStorage.setItem(AUTH_KEY, "true");
            localStorage.setItem(PASSCODE_STORAGE_KEY, newPass);
            showEmergencyMsg("Passcode reset successfully via Master Key! 🔐", false);
            showAdminToast("Passcode reset successfully via Master Key! 🔐", "✓");

            setTimeout(() => {
              closeModal();
              const gatekeeper = document.getElementById("adminGatekeeper");
              if (gatekeeper) gatekeeper.style.display = "none";
              loadDashboard();
            }, 1000);
          } else {
            showEmergencyMsg(data.message || "Invalid Master Recovery Key. Access denied.");
          }
        } catch (err) {
          showEmergencyMsg("Could not connect to server to verify Master Recovery Key.");
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Instant Reset Passcode ⚡</span>`;
          }
        }
      });
    }

    // Request 6-digit code (Backend Server -> Netlify -> Instant Offline/Local fallback)
    const handleSendCode = async (btnEl) => {
      if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span>Connecting to mail service... ⏳</span>`;
      }

      let emailDelivered = false;
      let deliveredMsg = "";

      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store pending code locally with 15-minute expiration
      sessionStorage.setItem("quadace_pending_reset_code", JSON.stringify({
        code: fallbackCode,
        expiresAt: Date.now() + 15 * 60 * 1000
      }));

      // 1. Try active backend server API
      try {
        if (btnEl) btnEl.innerHTML = `<span>Sending 6-digit code to email... ⏳</span>`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(`${getApiBaseUrl()}/api/auth/send-reset-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            emailDelivered = true;
            deliveredMsg = data.message || `✅ A 6-digit verification code has been sent directly to ${OWNER_EMAIL}! Please check your inbox and Spam folder.`;
          }
        }
      } catch (err) {
        console.warn("[RESET MODAL] Backend send error:", err);
      }

      // 2. Try Netlify Serverless Function if backend was not reachable
      if (!emailDelivered) {
        try {
          const netlifyRes = await fetch("https://quad-ace-herbs.netlify.app/.netlify/functions/send-reset-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ toEmail: OWNER_EMAIL, code: fallbackCode })
          });
          const netlifyData = await netlifyRes.json();
          if (netlifyRes.ok && netlifyData.success) {
            emailDelivered = true;
            deliveredMsg = `✅ 6-digit verification code sent to ${OWNER_EMAIL}! Please check your inbox and Spam folder.`;
          }
        } catch (netErr) {
          console.warn("[RESET MODAL] Netlify dispatch failed:", netErr);
        }
      }

      if (emailDelivered) {
        showResetMsg(deliveredMsg, false);
        if (sendSection) sendSection.style.display = "none";
        if (resetForm) resetForm.style.display = "block";
        if (codeInput) codeInput.focus();
      } else {
        // Safe offline / local mode fallback: Provide the code immediately so the owner is never locked out!
        showResetMsg(`⚡ Offline/Local Mode: The live email server is currently not connected to this browser. Your 6-digit verification code is: [ ${fallbackCode} ]. Enter this code below to set your new passcode! (Or use the Master Recovery Key below).`, false);
        if (sendSection) sendSection.style.display = "none";
        if (resetForm) resetForm.style.display = "block";
        if (codeInput) {
          codeInput.value = fallbackCode;
          if (newPinInput) newPinInput.focus();
        }
      }

      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = `<span>📩 Send 6-Digit Code to My Email</span>`;
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

        let verified = false;

        // 1. Try server verification
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-reset-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, newPassword: newPin })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            verified = true;
            if (data.token) sessionStorage.setItem(TOKEN_KEY, data.token);
          }
        } catch (err) {
          console.warn("[RESET MODAL] Server verification error, checking local fallback code:", err);
        }

        // 2. Check local fallback verification code if server didn't verify
        if (!verified) {
          try {
            const raw = sessionStorage.getItem("quadace_pending_reset_code");
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.code === code && parsed.expiresAt > Date.now()) {
                verified = true;
                sessionStorage.removeItem("quadace_pending_reset_code");
              }
            }
          } catch (e) {}
        }

        if (verified) {
          localStorage.setItem(PASSCODE_STORAGE_KEY, newPin);
          sessionStorage.setItem(AUTH_KEY, "true");

          showResetMsg("Passcode reset successfully! 🔐", false);
          showAdminToast("Admin passcode reset successfully! 🔐", "✓");

          setTimeout(() => {
            closeModal();
            const gatekeeper = document.getElementById("adminGatekeeper");
            if (gatekeeper) gatekeeper.style.display = "none";
            loadDashboard();
          }, 1200);
        } else {
          showResetMsg("Invalid or expired verification code. Please check your email or request a fresh code.");
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Verify & Save Passcode ✓</span>`;
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

        if (targetId === "tabOrders") {
          renderOrdersTable();
          updateStats();
          syncOrdersFromServer();
        }
        if (targetId === "tabInventory") {
          renderInventoryTracker();
        }
        if (targetId === "tabManage") {
          renderManageTable();
          syncProductsFromServer();
        }
        if (targetId === "tabCategories") {
          renderCategoriesTable();
          syncServerCategories();
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

      // Sync to backend server
      authFetch(`${getApiBaseUrl()}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct)
      }).catch(err => console.warn("[ADMIN] Could not sync new product to server immediately:", err.message));

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

    // Live Sales & Customer Purchases Stats
    const orders = (typeof getStoreOrders === "function") ? getStoreOrders() : [];
    let grossRevenue = 0;
    let unitsSold = 0;
    let pendingCount = 0;

    orders.forEach(o => {
      if (o.status !== "cancelled") {
        grossRevenue += Number(o.finalTotal || 0);
        if (Array.isArray(o.items)) {
          unitsSold += o.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0);
        }
      }
      if (o.status === "pending") {
        pendingCount++;
      }
    });

    const revEl = document.getElementById("statTotalRevenue");
    const ordersEl = document.getElementById("statTotalOrders");
    const unitsEl = document.getElementById("statUnitsSold");
    const pendingEl = document.getElementById("statPendingOrders");
    const ordersBadgeEl = document.getElementById("tabOrdersBadge");

    if (revEl) revEl.textContent = formatNaira(grossRevenue);
    if (ordersEl) ordersEl.textContent = orders.length;
    if (unitsEl) unitsEl.textContent = `${unitsSold} Units`;
    if (pendingEl) pendingEl.textContent = pendingCount;
    if (ordersBadgeEl) ordersBadgeEl.textContent = pendingCount > 0 ? pendingCount : orders.length;
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
      return `
        <tr data-id="${escapeHtml(p.id)}" class="product-manage-row">
          <td class="col-product-photo">
            <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="product-table-thumb" onerror="this.src='images/agbo-jedi.jpg'">
          </td>
          <td class="col-product-info">
            <div class="product-title" style="font-weight: 700; color: var(--deep-forest); font-size: 0.94rem; line-height: 1.3;">${escapeHtml(p.name)}</div>
            <div class="product-sub" style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(p.subtitle || '')}</div>
          </td>
          <td class="col-product-category">
            <span class="product-category-tag">${escapeHtml(p.categoryLabel || p.category)}</span>
          </td>
          <td class="col-product-price">
            <span class="product-table-price" style="font-weight: 800; color: var(--primary-green); font-size: 0.95rem;">₦${Number(p.price).toLocaleString("en-NG")}</span>
          </td>
          <td class="col-product-actions" style="text-align: right;">
            <div class="product-actions-grid">
              <button type="button" class="btn-action-edit" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">
                <span>✏️ Edit</span>
              </button>
              <button type="button" class="btn-action-del" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">
                <span>🗑️ Remove</span>
              </button>
              <a href="shop.html" target="_blank" class="btn-action-view">
                <span>👁️ View</span>
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // Wire edit buttons
    tbody.querySelectorAll(".btn-action-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        openEditProductModal(id);
      });
    });

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
  async function handleDeleteProduct(productId, productName) {
    const confirmed = window.confirm(`Are you sure you want to remove '${productName}' from your store? It will disappear from the Shop page immediately.`);
    if (!confirmed) return;

    if (typeof deleteStoreProduct === "function") {
      deleteStoreProduct(productId);
      showAdminToast(`'${productName}' removed from shop.`, "🗑️");
      updateStats();
      renderManageTable();
      renderInventoryTracker();
    }

    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/products/${encodeURIComponent(productId)}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.deletedProductIds)) {
          localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(data.deletedProductIds));
        }
      }
    } catch (e) {}
  }

  // --- EDIT PRODUCT MODAL CONTROLLER ---
  let activeEditImageSrc = "";

  function populateEditCategorySelect(selectedId) {
    const select = document.getElementById("editProdCategory");
    if (!select) return;

    const categories = typeof getStoreCategories === "function" ? getStoreCategories(false) : [];
    select.innerHTML = categories.map(cat => `
      <option value="${cat.id}">
        ${cat.icon ? cat.icon + ' ' : ''}${cat.label}${cat.desc ? ' — ' + cat.desc : ''}
      </option>
    `).join("");

    if (selectedId && categories.some(c => c.id === selectedId)) {
      select.value = selectedId;
    } else if (categories[0]) {
      select.value = categories[0].id;
    }
  }

  function openEditProductModal(productId) {
    const modal = document.getElementById("editProductModal");
    if (!modal) return;

    const products = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      showAdminToast("Product not found in catalog.", "⚠️");
      return;
    }

    // Populate category dropdown with current category selected
    populateEditCategorySelect(prod.category);

    // Populate input fields
    const idInput = document.getElementById("editProdId");
    const nameInput = document.getElementById("editProdName");
    const subInput = document.getElementById("editProdSubtitle");
    const priceInput = document.getElementById("editProdPrice");
    const origPriceInput = document.getElementById("editProdOriginalPrice");
    const badgeInput = document.getElementById("editProdBadge");
    const badgeTypeSelect = document.getElementById("editProdBadgeType");
    const imgUrlInput = document.getElementById("editProdImageUrl");
    const imgPreview = document.getElementById("editActiveImagePreview");
    const shortDescInput = document.getElementById("editProdShortDesc");
    const fullDescInput = document.getElementById("editProdFullDesc");
    const benefitsInput = document.getElementById("editProdBenefits");
    const ingredientsInput = document.getElementById("editProdIngredients");
    const usageInput = document.getElementById("editProdUsage");
    const cautionInput = document.getElementById("editProdCaution");
    const headerSub = document.getElementById("editModalSub");

    if (idInput) idInput.value = prod.id;
    if (nameInput) nameInput.value = prod.name || "";
    if (subInput) subInput.value = prod.subtitle || "";
    if (priceInput) priceInput.value = prod.price || "";
    if (origPriceInput) origPriceInput.value = prod.originalPrice || "";
    if (badgeInput) badgeInput.value = prod.badge || "";
    if (badgeTypeSelect) badgeTypeSelect.value = prod.badgeType || "gold";
    if (shortDescInput) shortDescInput.value = prod.shortDesc || "";
    if (fullDescInput) fullDescInput.value = prod.fullDesc || "";
    if (benefitsInput) {
      benefitsInput.value = Array.isArray(prod.benefits) ? prod.benefits.join("\n") : (prod.benefits || "");
    }
    if (ingredientsInput) {
      ingredientsInput.value = Array.isArray(prod.ingredients) ? prod.ingredients.join("\n") : (prod.ingredients || "");
    }
    if (usageInput) usageInput.value = prod.usage || "";
    if (cautionInput) cautionInput.value = prod.caution || "";

    // Image handling
    activeEditImageSrc = prod.image || "images/agbo-jedi.jpg";
    if (imgUrlInput) imgUrlInput.value = prod.image || "";
    if (imgPreview) imgPreview.src = activeEditImageSrc;

    const fileInput = document.getElementById("editProdImageFile");
    if (fileInput) fileInput.value = "";

    if (headerSub) {
      headerSub.textContent = `Editing: ${prod.name} • Price, description & botanical formulation`;
    }

    modal.style.display = "flex";
  }

  function initEditProductModule() {
    const modal = document.getElementById("editProductModal");
    const form = document.getElementById("editProductForm");
    const closeBtn = document.getElementById("closeEditProductModalBtn");
    const cancelBtn = document.getElementById("cancelEditProductBtn");
    const imgUrlInput = document.getElementById("editProdImageUrl");
    const imgFileInput = document.getElementById("editProdImageFile");
    const imgPreview = document.getElementById("editActiveImagePreview");
    const saveBtn = document.getElementById("saveEditProductBtn");

    if (!modal) return;

    const closeModal = () => {
      modal.style.display = "none";
    };

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    // Close on overlay backdrop click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Image URL live preview
    if (imgUrlInput) {
      imgUrlInput.addEventListener("input", (e) => {
        const val = e.target.value.trim();
        if (val) {
          activeEditImageSrc = val;
          if (imgPreview) imgPreview.src = val;
        }
      });
    }

    // Image File Upload compression & preview
    if (imgFileInput) {
      imgFileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            const tempImg = new Image();
            tempImg.onload = () => {
              const canvas = document.createElement("canvas");
              const maxDim = 800;
              let w = tempImg.width;
              let h = tempImg.height;
              if (w > maxDim || h > maxDim) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(tempImg, 0, 0, w, h);
              activeEditImageSrc = canvas.toDataURL("image/jpeg", 0.8);
              if (imgPreview) imgPreview.src = activeEditImageSrc;
              if (imgUrlInput) imgUrlInput.value = "";
              showAdminToast("New remedy photo loaded ✓", "📸");
            };
            tempImg.src = loadEvent.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Form submit
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const id = document.getElementById("editProdId").value;
        const name = document.getElementById("editProdName").value.trim();
        const category = document.getElementById("editProdCategory").value;
        const subtitle = document.getElementById("editProdSubtitle").value.trim();
        const price = Number(document.getElementById("editProdPrice").value);
        const originalPriceVal = document.getElementById("editProdOriginalPrice").value;
        const originalPrice = originalPriceVal ? Number(originalPriceVal) : null;
        const badge = document.getElementById("editProdBadge").value.trim();
        const badgeType = document.getElementById("editProdBadgeType").value;
        const shortDesc = document.getElementById("editProdShortDesc").value.trim();
        const fullDesc = document.getElementById("editProdFullDesc").value.trim() || shortDesc;
        const usage = document.getElementById("editProdUsage").value.trim() || "Take as traditionally directed on bottle.";
        const caution = document.getElementById("editProdCaution").value.trim() || "";

        if (!id || !name || !price || !shortDesc) {
          showAdminToast("Please provide Remedy Name, Price, and Short Summary.", "⚠️");
          return;
        }

        const benefitsText = document.getElementById("editProdBenefits").value.trim();
        const benefits = benefitsText
          ? benefitsText.split("\n").map(b => b.trim()).filter(Boolean)
          : ["100% pure wildcrafted botanical formula", "Promotes natural bodily restoration"];

        const ingredientsText = document.getElementById("editProdIngredients").value.trim();
        const ingredients = ingredientsText
          ? ingredientsText.split("\n").map(i => i.trim()).filter(Boolean)
          : ["Wild-harvested ancestral African roots and leaves"];

        const categoryLabel = (typeof getCategoryLabel === "function")
          ? getCategoryLabel(category)
          : (CATEGORY_LABELS[category] || "Agbo & Tonics");

        // Find existing product to preserve fields (rating, reviewsCount, healthGoals, etc.)
        const currentProducts = typeof getStoreProducts === "function" ? getStoreProducts() : PRODUCTS_DATA;
        const existing = currentProducts.find(p => p.id === id) || {};

        const updatedProduct = {
          ...existing,
          id: id,
          name: name,
          subtitle: subtitle || `${categoryLabel} Herbal Remedy`,
          category: category,
          categoryLabel: categoryLabel,
          price: price,
          originalPrice: originalPrice,
          badge: badge,
          badgeType: badgeType,
          image: activeEditImageSrc || existing.image || "images/agbo-jedi.jpg",
          healthGoals: [category],
          shortDesc: shortDesc,
          fullDesc: fullDesc,
          benefits: benefits,
          ingredients: ingredients,
          usage: usage,
          caution: caution,
          isCustom: existing.isCustom || id.startsWith("custom-"),
          updatedAt: new Date().toISOString()
        };

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = `<span>Saving Changes... ⏳</span>`;
        }

        // 1. Save locally to Store (custom store & local storage)
        if (typeof saveStoreProduct === "function") {
          saveStoreProduct(updatedProduct);
        }

        // 2. Sync to Backend Server & SQL DB (Admin Authenticated)
        try {
          await authFetch(`${getApiBaseUrl()}/api/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedProduct)
          });
        } catch (serverErr) {
          console.warn("[ADMIN] Could not sync edited product to server immediately:", serverErr.message);
        }

        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>✓ Save Changes</span>`;
        }

        closeModal();
        showAdminToast(`'${name}' updated successfully! Changes are live across the store.`, "✓");

        // Re-render views
        renderManageTable();
        renderInventoryTracker();
        updateStats();
      });
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
        <tr data-review-id="${escapeHtml(rev.id)}">
          <td>
            <div style="font-weight: 700; color: var(--deep-forest);">${escapeHtml(rev.name)}</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(rev.location || 'Nigeria')}</div>
          </td>
          <td>
            <span class="product-category-tag" style="background: rgba(39, 174, 96, 0.1); color: #1e7040;">🌿 ${escapeHtml(rev.remedy || 'Traditional Remedy')}</span>
          </td>
          <td style="color: #f59e0b; font-size: 1.1rem; white-space: nowrap;">
            ${stars} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">(${escapeHtml(rev.rating || 5)}.0)</span>
          </td>
          <td>
            <div style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.5; max-width: 420px; font-style: italic;">
              "${escapeHtml(rev.comment)}"
            </div>
          </td>
          <td style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">
            ${escapeHtml(dateStr)}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-del btn-del-review" data-id="${escapeHtml(rev.id)}" data-name="${escapeHtml(rev.name)}">
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
      const res = await authFetch(`${getApiBaseUrl()}/api/reviews/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.reviews)) {
          localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(data.reviews));
        }
      }
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

  // ==========================================================================
  // LIVE ORDERS & PRODUCT INVENTORY TRACKING CONTROLLER
  // ==========================================================================

  let orderFilterState = {
    status: "all",
    method: "all",
    search: ""
  };

  let inventoryFilterState = {
    filter: "all",
    search: ""
  };

  let soundAlertEnabled = true;
  let lastKnownOrderRefs = new Set();
  let livePollingTimer = null;
  let currentActiveOrder = null;
  let hasInitializedOrdersModule = false;

  // Audio Chime (Melodic Web Audio API synthesizer)
  function playOrderChime() {
    if (!soundAlertEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";

      // Two-tone bell chime (E5 -> A5)
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.00, now + 0.16);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch (e) {}
  }

  // Format currency
  function formatNaira(num) {
    return "₦" + Number(num || 0).toLocaleString("en-NG");
  }

  // Relative time helper
  function timeAgo(isoDate) {
    if (!isoDate) return "recently";
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  }

  // Update Mini KPIs in orders tab
  function updateOrdersKpis() {
    const orders = (typeof getStoreOrders === "function") ? getStoreOrders() : [];
    let gross = 0;
    let pending = 0;
    let verified = 0;

    orders.forEach(o => {
      if (o.status !== "cancelled") {
        gross += Number(o.finalTotal || 0);
      }
      if (o.status === "pending") pending++;
      if (o.status === "verified" || o.status === "dispatched") verified++;
    });

    const kpiTotal = document.getElementById("ordersKpiTotal");
    const kpiPending = document.getElementById("ordersKpiPending");
    const kpiVerified = document.getElementById("ordersKpiVerified");
    const kpiRevenue = document.getElementById("ordersKpiRevenue");

    if (kpiTotal) kpiTotal.textContent = orders.length;
    if (kpiPending) kpiPending.textContent = pending;
    if (kpiVerified) kpiVerified.textContent = verified;
    if (kpiRevenue) kpiRevenue.textContent = formatNaira(gross);

    // Update status filter pill counts
    const countAll = document.getElementById("pillCountAll");
    const countPending = document.getElementById("pillCountPending");
    const countVerified = document.getElementById("pillCountVerified");
    const countDispatched = document.getElementById("pillCountDispatched");
    const countDelivered = document.getElementById("pillCountDelivered");

    if (countAll) countAll.textContent = orders.length;
    if (countPending) countPending.textContent = orders.filter(o => o.status === "pending").length;
    if (countVerified) countVerified.textContent = orders.filter(o => o.status === "verified").length;
    if (countDispatched) countDispatched.textContent = orders.filter(o => o.status === "dispatched").length;
    if (countDelivered) countDelivered.textContent = orders.filter(o => o.status === "delivered").length;
  }

  // Update Inventory Highlights in inventory tab
  function updateInventoryHighlights() {
    const items = (typeof getProductSalesStats === "function") ? getProductSalesStats() : [];
    const bestSeller = items.length > 0 ? items[0] : null;

    let highestRevenueItem = null;
    let highestRevVal = -1;
    let lowStockCount = 0;

    items.forEach(it => {
      if (it.totalRevenue > highestRevVal) {
        highestRevVal = it.totalRevenue;
        highestRevenueItem = it;
      }
      if (it.stockStatus === "low_stock" || it.stockStatus === "out_of_stock") {
        lowStockCount++;
      }
    });

    const elBestseller = document.getElementById("invHighlightBestseller");
    const elBestsellerUnits = document.getElementById("invHighlightBestsellerUnits");
    const elRevenue = document.getElementById("invHighlightRevenue");
    const elRevenueTotal = document.getElementById("invHighlightRevenueTotal");
    const elLowStock = document.getElementById("invHighlightLowStock");
    const elTotal = document.getElementById("invHighlightTotal");

    if (elBestseller) elBestseller.textContent = (bestSeller && bestSeller.unitsSold > 0) ? bestSeller.name : (items[0] ? items[0].name : "None");
    if (elBestsellerUnits) elBestsellerUnits.textContent = (bestSeller && bestSeller.unitsSold > 0) ? `${bestSeller.unitsSold} units purchased` : "0 units sold yet";
    if (elRevenue) elRevenue.textContent = (highestRevenueItem && highestRevenueItem.totalRevenue > 0) ? highestRevenueItem.name : "None";
    if (elRevenueTotal) elRevenueTotal.textContent = (highestRevenueItem && highestRevenueItem.totalRevenue > 0) ? `${formatNaira(highestRevenueItem.totalRevenue)} gross sales` : "₦0 total revenue";
    if (elLowStock) elLowStock.textContent = lowStockCount;
    if (elTotal) elTotal.textContent = items.length;
  }

  // Render Orders Table
  function renderOrdersTable() {
    const container = document.getElementById("ordersListContainer");
    if (!container) return;

    let orders = (typeof getStoreOrders === "function") ? getStoreOrders() : [];

    // Filter by status
    if (orderFilterState.status !== "all") {
      orders = orders.filter(o => o.status === orderFilterState.status);
    }

    // Filter by method
    if (orderFilterState.method !== "all") {
      orders = orders.filter(o => o.paymentMethod === orderFilterState.method);
    }

    // Filter by search query
    const q = orderFilterState.search.toLowerCase().trim();
    if (q) {
      orders = orders.filter(o => {
        const refMatch = o.orderRef && o.orderRef.toLowerCase().includes(q);
        const nameMatch = o.customer && o.customer.name && o.customer.name.toLowerCase().includes(q);
        const phoneMatch = o.customer && o.customer.phone && o.customer.phone.toLowerCase().includes(q);
        const addressMatch = o.customer && o.customer.address && o.customer.address.toLowerCase().includes(q);
        const itemMatch = Array.isArray(o.items) && o.items.some(it => it.name && it.name.toLowerCase().includes(q));
        return refMatch || nameMatch || phoneMatch || addressMatch || itemMatch;
      });
    }

    updateOrdersKpis();

    if (orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1.5rem; background: #f8faf9; border-radius: var(--radius-lg); border: 1.5px dashed rgba(24, 66, 46, 0.15);">
          <div style="font-size: 2.8rem; margin-bottom: 0.75rem;">📦</div>
          <h4 style="font-family: var(--font-heading); color: var(--deep-forest); font-size: 1.25rem; margin-bottom: 0.35rem;">No Purchases Found</h4>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 420px; margin: 0 auto 1.25rem auto;">
            ${q || orderFilterState.status !== "all" ? "No customer orders match your current filters. Try resetting your search." : "Customer purchases from your website shop will appear here live in real-time."}
          </p>
          <button type="button" class="btn-primary" id="resetOrderFiltersBtn" style="padding: 0.5rem 1.25rem; font-size: 0.85rem;">
            <span>🔄 View All Orders</span>
          </button>
        </div>
      `;
      const resetBtn = document.getElementById("resetOrderFiltersBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          orderFilterState.status = "all";
          orderFilterState.method = "all";
          orderFilterState.search = "";
          const searchInput = document.getElementById("ordersSearchInput");
          if (searchInput) searchInput.value = "";
          const methodFilter = document.getElementById("orderMethodFilter");
          if (methodFilter) methodFilter.value = "all";
          document.querySelectorAll("#orderStatusFilters .order-filter-pill-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.status === "all");
          });
          renderOrdersTable();
        });
      }
      return;
    }

    container.innerHTML = orders.map(ord => {
      // Status pill
      const statusMap = {
        pending: { label: "🟡 Pending Verification", class: "status-pending" },
        verified: { label: "🟢 Payment Verified", class: "status-verified" },
        dispatched: { label: "🚚 Dispatched", class: "status-dispatched" },
        delivered: { label: "✅ Delivered", class: "status-delivered" },
        cancelled: { label: "❌ Cancelled", class: "status-cancelled" }
      };
      const curStatus = statusMap[ord.status] || statusMap.pending;

      // Items list mini
      const itemsListHtml = (ord.items || []).map(it => `
        <div class="order-item-mini">
          <img src="${escapeHtml(it.image || 'images/agbo-jedi.jpg')}" alt="${escapeHtml(it.name)}" class="order-item-thumb" onerror="this.src='images/agbo-jedi.jpg'">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 700; color: var(--deep-forest); font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(it.name)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted);">
              Qty: <strong>x${Number(it.quantity) || 1}</strong> • ${formatNaira(it.price)} each
            </div>
          </div>
          <div style="font-weight: 800; color: var(--primary-green); font-size: 0.88rem;">
            ${formatNaira((it.price || 0) * (it.quantity || 1))}
          </div>
        </div>
      `).join("");

      // Payment details
      const isBank = ord.paymentMethod === "bank";
      const hasReceipt = Boolean(ord.receiptProof && (ord.receiptProof.hasReceipt || ord.receiptProof.dataUrl));
      const receiptHtml = hasReceipt ? `
        <div style="margin-top: 0.5rem;">
          <button type="button" class="order-receipt-chip btn-inspect-receipt" data-ref="${escapeHtml(ord.orderRef)}">
            <span>🧾</span> <span>Inspect Attached Receipt Screenshot</span> <span>👁️</span>
          </button>
        </div>
      ` : (isBank ? `<div style="font-size: 0.78rem; color: #b45309; margin-top: 0.35rem;">⚠️ No screenshot attached (Check bank app for credit narration)</div>` : '');

      // Customer contacts
      const cleanPhone = (ord.customer && ord.customer.phone) ? ord.customer.phone.replace(/[^0-9+]/g, '') : '';
      const waDigits = cleanPhone.replace(/^\+/, '');

      // Friendly WhatsApp dispatch message
      const waMsg = encodeURIComponent(`Hello ${ord.customer ? ord.customer.name : 'Customer'}! Aduke Alagbo here. We have confirmed your order ${ord.orderRef} (${formatNaira(ord.finalTotal)}) and package dispatch is being arranged to ${ord.customer ? ord.customer.address : 'your address'}. Thank you for choosing natural remedies! 🌿`);
      const waLink = `https://wa.me/${waDigits || STORE_CONFIG.whatsappNumber}?text=${waMsg}`;

      // Date formatted
      const dateStr = ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently';

      return `
        <div class="order-card" data-ref="${escapeHtml(ord.orderRef)}">
          <!-- Order Header -->
          <div class="order-header-row">
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <span class="order-ref-badge">${escapeHtml(ord.orderRef)}</span>
              <span class="order-status-pill ${curStatus.class}">${curStatus.label}</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">
                📅 ${escapeHtml(dateStr)} • <strong>${timeAgo(ord.createdAt)}</strong>
              </span>
            </div>

            <!-- Total Amount -->
            <div style="text-align: right;">
              <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Order Total</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--deep-forest);">${formatNaira(ord.finalTotal)}</div>
            </div>
          </div>

          <!-- Order Content Grid -->
          <div class="order-grid-details">
            <!-- Box 1: Customer Profile -->
            <div class="order-box-panel">
              <div class="order-box-title">👤 Customer Delivery Info</div>
              <div style="font-weight: 800; color: var(--deep-forest); font-size: 0.98rem; margin-bottom: 0.25rem;">
                ${ord.customer ? escapeHtml(ord.customer.name) : 'Valued Customer'}
              </div>
              <div style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                <span>📞</span>
                <strong><a href="tel:${escapeHtml(cleanPhone)}" style="color: var(--primary-green); text-decoration: none;">${ord.customer ? escapeHtml(ord.customer.phone) : 'Not provided'}</a></strong>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.4rem;">
                📍 ${ord.customer ? escapeHtml(ord.customer.address) : 'No delivery address'}
              </div>
              ${ord.customer && ord.customer.notes ? `
                <div style="font-size: 0.75rem; color: #b45309; background: #fffbeb; padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); border-left: 3px solid #f59e0b;">
                  💬 "${escapeHtml(ord.customer.notes)}"
                </div>
              ` : ''}
            </div>

            <!-- Box 2: Items Purchased -->
            <div class="order-box-panel">
              <div class="order-box-title">🌿 Purchased Remedies (${(ord.items || []).reduce((s, i) => s + (Number(i.quantity) || 1), 0)} Bottles)</div>
              <div style="max-height: 160px; overflow-y: auto; padding-right: 0.35rem;">
                ${itemsListHtml}
              </div>
            </div>

            <!-- Box 3: Payment & Verification -->
            <div class="order-box-panel">
              <div class="order-box-title">🏦 Payment Details & Proof</div>
              <div style="font-size: 0.82rem; margin-bottom: 0.35rem;">
                Method: <strong>${isBank ? 'Direct Bank Transfer (Kuda)' : 'WhatsApp Direct'}</strong>
              </div>
              ${isBank && ord.senderDetails ? `
                <div style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5;">
                  ${ord.senderDetails.bank ? `<div>Bank: <strong>${escapeHtml(ord.senderDetails.bank)}</strong></div>` : ''}
                  ${ord.senderDetails.name ? `<div>Sender: <strong>${escapeHtml(ord.senderDetails.name)}</strong></div>` : ''}
                  ${ord.senderDetails.sessionId ? `<div style="font-family: monospace;">Ref: <strong>${escapeHtml(ord.senderDetails.sessionId)}</strong></div>` : ''}
                </div>
              ` : ''}
              ${receiptHtml}
            </div>
          </div>

          <!-- Action Footer -->
          <div class="order-actions-bar" style="border-top: 1px solid rgba(24, 66, 46, 0.08); padding-top: 0.85rem;">
            <!-- Status quick-changer -->
            <div class="order-status-group">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); white-space: nowrap;">Status:</span>
              <select class="form-input order-status-select" data-ref="${ord.orderRef}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; width: auto; font-weight: 700;">
                <option value="pending" ${ord.status === 'pending' ? 'selected' : ''}>🟡 Pending Verification</option>
                <option value="verified" ${ord.status === 'verified' ? 'selected' : ''}>🟢 Payment Verified</option>
                <option value="dispatched" ${ord.status === 'dispatched' ? 'selected' : ''}>🚚 Dispatched</option>
                <option value="delivered" ${ord.status === 'delivered' ? 'selected' : ''}>✅ Delivered</option>
                <option value="cancelled" ${ord.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled</option>
              </select>

              ${ord.status === 'pending' ? `
                <button type="button" class="btn-quick-verify btn-verify-now" data-ref="${ord.orderRef}">
                  <span>✓ Verify Alert</span>
                </button>
              ` : ''}
            </div>

            <!-- Quick Action buttons -->
            <div class="order-btns-group">
              <a href="${waLink}" target="_blank" class="btn-wa-action" title="Open WhatsApp chat with customer">
                <span>💬 WhatsApp</span>
              </a>
              <button type="button" class="btn-action-view btn-view-order-modal" data-ref="${ord.orderRef}">
                <span>👁️ Order Slip</span>
              </button>
              <button type="button" class="btn-action-del btn-delete-order" data-ref="${ord.orderRef}" title="Delete this order">
                <span>🗑️</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    wireOrderActionListeners();
  }

  // Wire Order Card Event Listeners
  function wireOrderActionListeners() {
    const container = document.getElementById("ordersListContainer");
    if (!container) return;

    // Status dropdown change
    container.querySelectorAll(".order-status-select").forEach(sel => {
      sel.addEventListener("change", (e) => {
        const ref = sel.dataset.ref;
        const newStatus = e.target.value;
        updateOrderStatus(ref, newStatus);
      });
    });

    // 1-Click Verify button
    container.querySelectorAll(".btn-verify-now").forEach(btn => {
      btn.addEventListener("click", () => {
        const ref = btn.dataset.ref;
        updateOrderStatus(ref, "verified", "Payment verified by store admin");
      });
    });

    // Inspect Receipt Thumbnail button
    container.querySelectorAll(".btn-inspect-receipt").forEach(btn => {
      btn.addEventListener("click", () => {
        const ref = btn.dataset.ref;
        const orders = (typeof getStoreOrders === "function") ? getStoreOrders() : [];
        const ord = orders.find(o => o.orderRef === ref);
        if (ord && ord.receiptProof) {
          const src = ord.receiptProof.dataUrl || "images/agbo-jedi.jpg";
          const fn = ord.receiptProof.fileName || `${ref}_receipt.jpg`;
          openReceiptZoom(src, fn);
        }
      });
    });

    // View Order Slip modal
    container.querySelectorAll(".btn-view-order-modal").forEach(btn => {
      btn.addEventListener("click", () => {
        const ref = btn.dataset.ref;
        openOrderDetailModal(ref);
      });
    });

    // Delete order button
    container.querySelectorAll(".btn-delete-order").forEach(btn => {
      btn.addEventListener("click", () => {
        const ref = btn.dataset.ref;
        if (confirm(`Are you sure you want to delete order ${ref}? This will remove it from tracking.`)) {
          deleteOrder(ref);
        }
      });
    });
  }

  // Render Product Inventory Tracker Table
  function renderInventoryTracker() {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    let items = (typeof getProductSalesStats === "function") ? getProductSalesStats() : [];

    // Filter by stock status
    const filterVal = inventoryFilterState.filter;
    if (filterVal === "bestsellers") {
      items = items.filter(i => i.unitsSold > 0);
    } else if (filterVal === "low_stock") {
      items = items.filter(i => i.stockStatus === "low_stock");
    } else if (filterVal === "out_of_stock") {
      items = items.filter(i => i.stockStatus === "out_of_stock");
    }

    // Search query
    const q = inventoryFilterState.search.toLowerCase().trim();
    if (q) {
      items = items.filter(i => i.name.toLowerCase().includes(q) || (i.categoryLabel && i.categoryLabel.toLowerCase().includes(q)));
    }

    updateInventoryHighlights();

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No remedies found matching '${q || filterVal}'.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      // Rank badge
      const rankBadge = item.rank === 1
        ? `<span style="font-size: 1.15rem;" title="#1 Bestseller">🥇</span>`
        : (item.rank === 2
          ? `<span style="font-size: 1.15rem;" title="#2 Bestseller">🥈</span>`
          : (item.rank === 3
            ? `<span style="font-size: 1.15rem;" title="#3 Bestseller">🥉</span>`
            : `<span style="font-weight: 800; color: var(--text-muted);">#${item.rank}</span>`));

      // Stock status badge
      const stockBadgeMap = {
        in_stock: `<span class="stock-badge-tag in-stock">🟢 In Stock</span>`,
        low_stock: `<span class="stock-badge-tag low-stock">⚠️ Low Stock (${item.stock} left)</span>`,
        out_of_stock: `<span class="stock-badge-tag out-stock">🔴 Out of Stock</span>`
      };
      const badgeHtml = stockBadgeMap[item.stockStatus] || stockBadgeMap.in_stock;

      return `
        <tr data-product-id="${item.id}">
          <td style="text-align: center;">${rankBadge}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img src="${item.image || 'images/agbo-jedi.jpg'}" alt="${item.name}" class="product-table-thumb" onerror="this.src='images/agbo-jedi.jpg'">
              <div>
                <div style="font-weight: 800; color: var(--deep-forest); font-size: 0.92rem;">${item.name}</div>
                <div style="font-size: 0.74rem; color: var(--text-muted);">${item.lastPurchasedAt ? `Last bought ${timeAgo(item.lastPurchasedAt)}` : 'No purchases yet'}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="product-category-tag">${item.categoryLabel || item.category}</span>
          </td>
          <td style="font-weight: 700; color: var(--deep-forest);">
            ${formatNaira(item.price)}
          </td>
          <td>
            <div style="font-weight: 800; font-size: 1rem; color: var(--deep-forest);">${item.unitsSold} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">bottles</span></div>
          </td>
          <td style="font-weight: 800; color: #15803d; font-size: 0.95rem;">
            ${formatNaira(item.totalRevenue)}
          </td>
          <td style="font-size: 0.85rem; color: var(--text-secondary);">
            ${item.orderCount} orders
          </td>
          <td>
            <!-- Stock Stepper -->
            <div class="stock-qty-stepper">
              <button type="button" class="btn-stock-step" data-id="${item.id}" data-delta="-1">−</button>
              <input type="number" class="input-stock-val" data-id="${item.id}" value="${item.stock}" min="0">
              <button type="button" class="btn-stock-step" data-id="${item.id}" data-delta="1">+</button>
            </div>
          </td>
          <td>
            ${badgeHtml}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-action-view btn-open-restock" data-id="${item.id}" data-name="${item.name}" data-stock="${item.stock}" data-threshold="${item.lowStockThreshold || 8}">
              <span>📦 Restock</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    wireInventoryListeners();
  }

  // Wire Inventory Table Listeners
  function wireInventoryListeners() {
    const tbody = document.getElementById("inventoryTableBody");
    if (!tbody) return;

    // Stepper buttons (+/-)
    tbody.querySelectorAll(".btn-stock-step").forEach(btn => {
      btn.addEventListener("click", () => {
        const prodId = btn.dataset.id;
        const delta = parseInt(btn.dataset.delta, 10);
        if (typeof adjustProductStock === "function") {
          const newQty = adjustProductStock(prodId, delta);
          showAdminToast(`Stock updated for remedy to ${newQty} bottles.`, "📦");
          renderInventoryTracker();
        }
      });
    });

    // Direct input edit
    tbody.querySelectorAll(".input-stock-val").forEach(input => {
      input.addEventListener("change", () => {
        const prodId = input.dataset.id;
        const val = parseInt(input.value, 10) || 0;
        if (typeof setStoreProductStock === "function") {
          setStoreProductStock(prodId, val);
          showAdminToast(`Stock set to ${val} bottles.`, "📦");
          renderInventoryTracker();
        }
      });
    });

    // Open Restock Modal
    tbody.querySelectorAll(".btn-open-restock").forEach(btn => {
      btn.addEventListener("click", () => {
        const prodId = btn.dataset.id;
        const name = btn.dataset.name;
        const stock = btn.dataset.stock;
        const threshold = btn.dataset.threshold;
        openRestockModal(prodId, name, stock, threshold);
      });
    });
  }

  // Open Restock Modal
  function openRestockModal(prodId, prodName, currentStock, currentThreshold) {
    const modal = document.getElementById("restockModal");
    const nameEl = document.getElementById("restockProdName");
    const idInput = document.getElementById("restockProdId");
    const qtyInput = document.getElementById("restockQtyInput");
    const thresholdInput = document.getElementById("restockThresholdInput");

    if (!modal) return;

    if (nameEl) nameEl.textContent = prodName;
    if (idInput) idInput.value = prodId;
    if (qtyInput) qtyInput.value = currentStock || 30;
    if (thresholdInput) thresholdInput.value = currentThreshold || 8;

    modal.style.display = "flex";
  }

  // Open Order Detail Modal
  function openOrderDetailModal(orderRef) {
    const orders = (typeof getStoreOrders === "function") ? getStoreOrders() : [];
    const ord = orders.find(o => o.orderRef === orderRef);
    if (!ord) return;

    currentActiveOrder = ord;
    const modal = document.getElementById("adminOrderDetailModal");
    if (!modal) return;

    // Fill titles
    const refTitle = document.getElementById("modalOrderRefTitle");
    const dateText = document.getElementById("modalOrderDateText");
    const badge = document.getElementById("modalOrderStatusBadge");
    const statusSelect = document.getElementById("modalStatusSelect");

    if (refTitle) refTitle.textContent = `Order ${ord.orderRef}`;
    if (dateText) {
      const d = ord.createdAt ? new Date(ord.createdAt).toLocaleString('en-GB') : 'Recently';
      dateText.textContent = `Placed on ${d} • ${timeAgo(ord.createdAt)}`;
    }

    const statusMap = {
      pending: { label: "🟡 Pending Verification", class: "status-pending" },
      verified: { label: "🟢 Payment Verified", class: "status-verified" },
      dispatched: { label: "🚚 Dispatched", class: "status-dispatched" },
      delivered: { label: "✅ Delivered", class: "status-delivered" },
      cancelled: { label: "❌ Cancelled", class: "status-cancelled" }
    };
    const sInfo = statusMap[ord.status] || statusMap.pending;

    if (badge) {
      badge.className = `order-status-pill ${sInfo.class}`;
      badge.textContent = sInfo.label;
    }
    if (statusSelect) {
      statusSelect.value = ord.status || "pending";
    }

    // Customer details
    const custName = document.getElementById("modalCustName");
    const custPhone = document.getElementById("modalCustPhoneLink");
    const custEmail = document.getElementById("modalCustEmail");
    const custAddress = document.getElementById("modalCustAddress");
    const custNotesBox = document.getElementById("modalCustNotesBox");
    const custNotes = document.getElementById("modalCustNotes");

    const cleanPhone = (ord.customer && ord.customer.phone) ? ord.customer.phone.replace(/[^0-9+]/g, '') : '';

    if (custName) custName.textContent = ord.customer ? ord.customer.name : 'Customer';
    if (custPhone) {
      custPhone.textContent = ord.customer ? ord.customer.phone : 'Not provided';
      custPhone.href = `tel:${cleanPhone}`;
    }
    if (custEmail) custEmail.textContent = (ord.customer && ord.customer.email) ? ord.customer.email : 'Not provided';
    if (custAddress) custAddress.textContent = (ord.customer && ord.customer.address) ? ord.customer.address : 'Not provided';
    if (custNotesBox && custNotes) {
      if (ord.customer && ord.customer.notes) {
        custNotes.textContent = ord.customer.notes;
        custNotesBox.style.display = "block";
      } else {
        custNotesBox.style.display = "none";
      }
    }

    // Payment details
    const payMethod = document.getElementById("modalPayMethod");
    const bankSection = document.getElementById("modalBankDetailsSection");
    const senderBank = document.getElementById("modalSenderBank");
    const senderName = document.getElementById("modalSenderName");
    const sessionId = document.getElementById("modalSessionId");
    const receiptSection = document.getElementById("modalReceiptSection");

    const isBank = ord.paymentMethod === "bank";
    if (payMethod) payMethod.textContent = isBank ? "Direct Bank Transfer (Kuda Bank)" : "WhatsApp Direct Order";

    if (bankSection) bankSection.style.display = isBank ? "block" : "none";
    if (senderBank) senderBank.textContent = (ord.senderDetails && ord.senderDetails.bank) ? ord.senderDetails.bank : "Not specified";
    if (senderName) senderName.textContent = (ord.senderDetails && ord.senderDetails.name) ? ord.senderDetails.name : "Not specified";
    if (sessionId) sessionId.textContent = (ord.senderDetails && ord.senderDetails.sessionId) ? ord.senderDetails.sessionId : "None";

    if (receiptSection) {
      const hasReceipt = Boolean(ord.receiptProof && (ord.receiptProof.hasReceipt || ord.receiptProof.dataUrl));
      if (hasReceipt) {
        receiptSection.innerHTML = `
          <button type="button" class="order-receipt-chip" id="modalOpenReceiptBtn">
            <span>🧾</span> <span>Click to View Full Transfer Receipt</span> <span>👁️</span>
          </button>
        `;
        const rBtn = document.getElementById("modalOpenReceiptBtn");
        if (rBtn) {
          rBtn.addEventListener("click", () => {
            const src = ord.receiptProof.dataUrl || "images/agbo-jedi.jpg";
            const fn = ord.receiptProof.fileName || `${ord.orderRef}_receipt.jpg`;
            openReceiptZoom(src, fn);
          });
        }
      } else if (isBank) {
        receiptSection.innerHTML = `
          <div style="font-size: 0.8rem; color: #b45309;">
            ⚠️ Customer confirmed payment without attaching a screenshot. Check your bank app credit alert for <strong>${formatNaira(ord.finalTotal)}</strong>.
          </div>
        `;
      } else {
        receiptSection.innerHTML = "";
      }
    }

    // Items table
    const itemsBody = document.getElementById("modalOrderItemsBody");
    if (itemsBody) {
      itemsBody.innerHTML = (ord.items || []).map(it => `
        <tr>
          <td style="padding: 0.75rem 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <img src="${escapeHtml(it.image || 'images/agbo-jedi.jpg')}" alt="${escapeHtml(it.name || 'Remedy')}" class="product-table-thumb" style="width: 38px; height: 38px;" onerror="this.src='images/agbo-jedi.jpg'">
              <strong style="color: var(--deep-forest); font-size: 0.88rem;">${escapeHtml(it.name || 'Herbal Remedy')}</strong>
            </div>
          </td>
          <td style="padding: 0.75rem 0.85rem; text-align: center; font-weight: 800;">
            x${Number(it.quantity) || 1}
          </td>
          <td style="padding: 0.75rem 0.85rem; text-align: right; color: var(--text-secondary);">
            ${formatNaira(it.price)}
          </td>
          <td style="padding: 0.75rem 0.85rem; text-align: right; font-weight: 800; color: var(--primary-green);">
            ${formatNaira((it.price || 0) * (it.quantity || 1))}
          </td>
        </tr>
      `).join("");
    }

    // Totals
    const subtotalEl = document.getElementById("modalSubtotal");
    const shippingMethodEl = document.getElementById("modalShippingMethod");
    const shippingFeeEl = document.getElementById("modalShippingFee");
    const discountRow = document.getElementById("modalDiscountRow");
    const discountEl = document.getElementById("modalDiscount");
    const finalTotalEl = document.getElementById("modalFinalTotal");

    if (subtotalEl) subtotalEl.textContent = formatNaira(ord.subtotal);
    if (shippingMethodEl) shippingMethodEl.textContent = ord.shippingMethod ? ord.shippingMethod.toUpperCase() : "STANDARD";
    if (shippingFeeEl) shippingFeeEl.textContent = ord.shippingFee ? formatNaira(ord.shippingFee) : "FREE / Rider sorted";

    if (discountRow && discountEl) {
      if (ord.discount > 0) {
        discountRow.style.display = "flex";
        discountEl.textContent = `-${formatNaira(ord.discount)}`;
      } else {
        discountRow.style.display = "none";
      }
    }

    if (finalTotalEl) finalTotalEl.textContent = formatNaira(ord.finalTotal);

    // WhatsApp button
    const waBtn = document.getElementById("modalSendWaBtn");
    if (waBtn) {
      const waDigits = cleanPhone.replace(/^\+/, '');
      const waMsg = encodeURIComponent(`Hello ${ord.customer ? ord.customer.name : 'Customer'}! Aduke Alagbo here regarding your order ${ord.orderRef}. We have verified your payment of ${formatNaira(ord.finalTotal)} and your herbal remedies are being dispatched to ${ord.customer ? ord.customer.address : 'your delivery address'}. We will share the rider's contact with you shortly! 🌿`);
      waBtn.href = `https://wa.me/${waDigits || STORE_CONFIG.whatsappNumber}?text=${waMsg}`;
    }

    modal.style.display = "flex";
  }

  // Open Receipt Zoom Modal
  function openReceiptZoom(dataUrl, fileName) {
    const modal = document.getElementById("receiptZoomModal");
    const img = document.getElementById("zoomReceiptImg");
    const nameEl = document.getElementById("zoomReceiptFileName");
    const dlLink = document.getElementById("downloadReceiptLink");

    if (!modal || !img) return;

    img.src = dataUrl;
    if (nameEl) nameEl.textContent = fileName || "customer_transfer_receipt.jpg";
    if (dlLink) {
      dlLink.href = dataUrl;
      dlLink.download = fileName || "customer_transfer_receipt.jpg";
    }

    modal.style.display = "flex";
  }

  // Update order status and sync to server & local
  async function updateOrderStatus(orderRef, newStatus, note = "") {
    if (typeof updateStoreOrderStatus === "function") {
      updateStoreOrderStatus(orderRef, newStatus, note);
    }

    const orders = typeof getStoreOrders === "function" ? getStoreOrders() : [];
    const targetRef = (orderRef || "").toString().trim().replace(/^#/, "").toLowerCase();
    const targetOrder = orders.find(o => (o.orderRef || "").toString().trim().replace(/^#/, "").toLowerCase() === targetRef);

    // If admin confirms payment, automatically dispatch official confirmation email to the buyer
    if (newStatus === "verified" && targetOrder) {
      if (targetOrder.customer && targetOrder.customer.email && targetOrder.customer.email.includes("@")) {
        const customerEmail = targetOrder.customer.email.trim();
        const netlifyDirectUrl = "https://quad-ace-herbs.netlify.app/.netlify/functions/customer-payment-confirmed-email";

        // Dispatch via Server (authenticated) with immediate Netlify fallback
        const dispatchServer = authFetch(`${getApiBaseUrl()}/api/orders/confirm-payment-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderData: { ...targetOrder, type: "payment_confirmed" } })
        }).then(res => res.json()).catch(err => {
          console.warn("[PAYMENT CONFIRMATION] Server dispatch attempt:", err.message);
          return null;
        });

        const dispatchNetlify = fetch(netlifyDirectUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "payment_confirmed", 
            orderData: { ...targetOrder, type: "payment_confirmed" } 
          })
        }).then(res => res.json()).catch(err => {
          console.warn("[PAYMENT CONFIRMATION] Direct Netlify attempt:", err.message);
          return null;
        });

        Promise.race([dispatchServer, dispatchNetlify]).then(res => {
          targetOrder.paymentConfirmedEmailSent = true;
          if (typeof saveStoreOrder === "function") {
            saveStoreOrder(targetOrder);
          }
          showAdminToast(`Payment confirmed! Confirmation email sent to ${customerEmail} ✉️`, "✓");
        }).catch(() => {
          showAdminToast(`Payment verified! (Email dispatched for ${customerEmail})`, "✓");
        });
      } else {
        showAdminToast(`Payment verified! ⚠️ Note: Customer did not provide an email address for receipt delivery.`, "ℹ️");
      }
    }

    // Sync to backend API (Admin Authenticated)
    try {
      const cleanRef = orderRef.replace(/^#/, '');
      await authFetch(`${getApiBaseUrl()}/api/orders/${encodeURIComponent(cleanRef)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, note })
      });
    } catch (e) {
      console.warn("Backend status sync warning:", e);
    }

    // Broadcast event across tabs on the same computer/browser
    try {
      window.dispatchEvent(new CustomEvent("quadace_order_status_updated", {
        detail: { orderRef, newStatus }
      }));
    } catch (e) {}

    showAdminToast(`Order ${orderRef} updated to ${newStatus.toUpperCase()} ✓`, "🌿");
    renderOrdersTable();
    updateStats();

    // If modal is open for this order, update modal badge
    if (currentActiveOrder && currentActiveOrder.orderRef === orderRef) {
      currentActiveOrder.status = newStatus;
      const badge = document.getElementById("modalOrderStatusBadge");
      const statusMap = {
        pending: { label: "🟡 Pending Verification", class: "status-pending" },
        verified: { label: "🟢 Payment Verified", class: "status-verified" },
        dispatched: { label: "🚚 Dispatched", class: "status-dispatched" },
        delivered: { label: "✅ Delivered", class: "status-delivered" },
        cancelled: { label: "❌ Cancelled", class: "status-cancelled" }
      };
      const sInfo = statusMap[newStatus] || statusMap.pending;
      if (badge) {
        badge.className = `order-status-pill ${sInfo.class}`;
        badge.textContent = sInfo.label;
      }
    }
  }

  // Delete order
  async function deleteOrder(orderRef) {
    if (!orderRef) return;
    const cleanRef = orderRef.replace(/^#/, '');

    // 1. Remove from in-memory tracking sets
    lastKnownOrderRefs.delete(orderRef);
    lastKnownOrderRefs.delete(`#${cleanRef}`);
    lastKnownOrderRefs.delete(cleanRef);

    // 2. Remove from local store records
    if (typeof deleteStoreOrder === "function") {
      deleteStoreOrder(orderRef);
    }

    // 3. Close modal if this order is currently open
    const modal = document.getElementById("adminOrderDetailModal");
    if (modal && currentActiveOrder) {
      const activeClean = (currentActiveOrder.orderRef || "").replace(/^#/, '');
      if (activeClean === cleanRef) {
        modal.style.display = "none";
      }
    }

    // 4. Update UI immediately
    renderOrdersTable();
    renderInventoryTracker();
    updateStats();
    showAdminToast(`Order ${orderRef} deleted.`, "🗑️");

    // 5. Delete on backend API (Admin Authenticated)
    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/orders/${encodeURIComponent(cleanRef)}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.deletedOrderRefs)) {
          localStorage.setItem("aduke_deleted_orders", JSON.stringify(data.deletedOrderRefs));
        }
      }
    } catch (e) {
      console.warn("Backend order delete error:", e);
    }
  }

  // Sync Orders from Server (Authoritative Cross-Device Sync)
  async function syncOrdersFromServer() {
    try {
      const res = await authFetch(`${getApiBaseUrl()}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          // Mark this browser as having connected to backend so seed orders are never re-created
          try { localStorage.setItem("aduke_has_synced_orders", "true"); } catch (e) {}

          const serverOrders = data.orders;
          const serverDeletedRefs = Array.isArray(data.deletedOrderRefs) ? data.deletedOrderRefs : [];

          // Persist server deleted refs into client localStorage
          try {
            let localDeleted = JSON.parse(localStorage.getItem("aduke_deleted_orders") || "[]");
            if (!Array.isArray(localDeleted)) localDeleted = [];
            const mergedDeleted = Array.from(new Set([...localDeleted, ...serverDeletedRefs]));
            localStorage.setItem("aduke_deleted_orders", JSON.stringify(mergedDeleted));
          } catch (e) {}

          const norm = r => (r || "").toString().trim().replace(/^#/, "").toLowerCase();

          // Filter out orders that have been marked deleted
          const activeOrders = serverOrders.filter(so => {
            const cr = norm(so.orderRef);
            return !serverDeletedRefs.includes(cr) && !serverDeletedRefs.includes(so.orderRef);
          }).sort((a, b) => {
            return new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0);
          });

          // Check for brand new orders that arrived
          let hasNewOrder = false;
          let latestNew = null;

          activeOrders.forEach(ord => {
            const r = norm(ord.orderRef);
            if (lastKnownOrderRefs.size > 0 && !lastKnownOrderRefs.has(r) && !lastKnownOrderRefs.has(ord.orderRef)) {
              hasNewOrder = true;
              latestNew = ord;
            }
          });

          // Rebuild in-memory cache to strictly match active server orders
          lastKnownOrderRefs.clear();
          activeOrders.forEach(ord => {
            lastKnownOrderRefs.add(norm(ord.orderRef));
            lastKnownOrderRefs.add(ord.orderRef);
          });

          // Authoritative save: replace local orders with server orders
          try {
            localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(activeOrders));
          } catch (storageErr) {
            console.warn("Storage quota limit reached in admin sync; trimming heavy dataUrls for quota safety:", storageErr);
            const safeMerged = activeOrders.map(o => {
              if (o.receiptProof && o.receiptProof.dataUrl && o.receiptProof.dataUrl.length > 50000) {
                return {
                  ...o,
                  receiptProof: { ...o.receiptProof, dataUrl: "" }
                };
              }
              return o;
            });
            try {
              localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(safeMerged));
            } catch (e2) {}
          }

          if (hasNewOrder && latestNew) {
            playOrderChime();
            showAdminToast(`🔔 New Order! ${latestNew.orderRef} from ${latestNew.customer ? latestNew.customer.name : 'Customer'} (${formatNaira(latestNew.finalTotal)})`, "🌿");
          }

          renderOrdersTable();
          renderInventoryTracker();
          updateStats();
        }
      }
    } catch (e) {
      // Local storage fallback is always active
    }
  }

  // Check Database & SQL Status
  async function checkDatabaseStatus() {
    const badge = document.getElementById("databaseStatusBadge");
    const text = document.getElementById("databaseStatusText");
    if (!badge || !text) return;

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/db-status`);
      if (res.ok) {
        const data = await res.json();
        if (data.sqlActive) {
          text.textContent = "Database: PostgreSQL Active ✓";
          badge.style.background = "rgba(16, 185, 129, 0.25)";
          badge.style.color = "#86efac";
          badge.style.borderColor = "rgba(134, 239, 172, 0.5)";
          badge.title = "PostgreSQL Cloud SQL Database is connected and backing all orders.";
        } else {
          text.textContent = "Database: Local / SQL Ready ⚡";
          badge.style.background = "rgba(234, 179, 8, 0.15)";
          badge.style.color = "#fef08a";
          badge.style.borderColor = "rgba(253, 224, 71, 0.35)";
          badge.title = "Running on resilient local storage. Click to view Cloud SQL setup.";
        }
      }
    } catch (e) {
      if (text) text.textContent = "Database: Local Storage";
    }

    badge.onclick = () => {
      showAdminToast(
        "🗄️ Database Info: Aduke Alagbo supports PostgreSQL. Add DATABASE_URL in Render to switch from local storage to permanent Cloud SQL.",
        "ℹ️"
      );
    };
  }

  // Authoritative Cross-Device Sync for Products
  async function syncProductsFromServer() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/products`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          let updated = false;

          if (Array.isArray(data.products)) {
            const currentCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS);
            const serverCustomStr = JSON.stringify(data.products);
            if (currentCustom !== serverCustomStr) {
              localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS, serverCustomStr);
              updated = true;
            }
          }

          if (Array.isArray(data.deletedProductIds)) {
            const currentDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS);
            const serverDeletedStr = JSON.stringify(data.deletedProductIds);
            if (currentDeleted !== serverDeletedStr) {
              localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS, serverDeletedStr);
              updated = true;
            }
          }

          if (updated) {
            renderManageTable();
            renderInventoryTracker();
            updateStats();
          }
        }
      }
    } catch (e) {}
  }

  // Live cross-device synchronization (every 8 seconds, on tab focus, and on visibility change)
  function startOrderLiveSync() {
    if (livePollingTimer) clearInterval(livePollingTimer);

    // Initial cache of known refs
    const existing = (typeof getStoreOrders === "function") ? getStoreOrders() : [];
    existing.forEach(o => {
      lastKnownOrderRefs.add((o.orderRef || "").toString().trim().replace(/^#/, '').toLowerCase());
      lastKnownOrderRefs.add(o.orderRef);
    });

    // Immediate sync
    syncOrdersFromServer();
    syncProductsFromServer();
    syncServerCategories();

    // Poll every 8 seconds for continuous real-time cross-device alignment
    livePollingTimer = setInterval(() => {
      syncOrdersFromServer();
      syncProductsFromServer();
      syncServerCategories();
    }, 8000);

    // Trigger instant sync when switching back to tab or unlocking device
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        syncOrdersFromServer();
        syncProductsFromServer();
        syncServerCategories();
      }
    });

    window.addEventListener("focus", () => {
      syncOrdersFromServer();
      syncProductsFromServer();
      syncServerCategories();
    });

    // Listen to local window events
    window.addEventListener("storage", (e) => {
      if (
        e.key === QUADACE_STORAGE_KEYS.ORDERS ||
        e.key === "aduke_deleted_orders" ||
        e.key === QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS ||
        e.key === QUADACE_STORAGE_KEYS.DELETED_PRODUCTS ||
        e.key === QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES ||
        e.key === QUADACE_STORAGE_KEYS.DELETED_CATEGORIES ||
        e.key === QUADACE_STORAGE_KEYS.INVENTORY
      ) {
        renderOrdersTable();
        renderManageTable();
        renderCategoriesTable();
        renderInventoryTracker();
        updateStats();
      }
    });

    window.addEventListener("quadace_new_order_saved", () => {
      renderOrdersTable();
      renderInventoryTracker();
      updateStats();
    });
  }

  // Initialize Orders Module UI Listeners
  function initOrdersModule() {
    if (hasInitializedOrdersModule) return;
    hasInitializedOrdersModule = true;

    // Filter status pills
    const pillBtns = document.querySelectorAll("#orderStatusFilters .order-filter-pill-btn");
    pillBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        pillBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        orderFilterState.status = btn.dataset.status;
        renderOrdersTable();
      });
    });

    // Payment method filter
    const methodFilter = document.getElementById("orderMethodFilter");
    if (methodFilter) {
      methodFilter.addEventListener("change", (e) => {
        orderFilterState.method = e.target.value;
        renderOrdersTable();
      });
    }

    // Search input
    const searchInput = document.getElementById("ordersSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        orderFilterState.search = e.target.value;
        renderOrdersTable();
      });
    }

    // Sound toggle button
    const soundBtn = document.getElementById("toggleOrderSoundBtn");
    const soundIcon = document.getElementById("soundBtnIcon");
    const soundText = document.getElementById("soundBtnText");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundAlertEnabled = !soundAlertEnabled;
        if (soundIcon) soundIcon.textContent = soundAlertEnabled ? "🔔" : "🔇";
        if (soundText) soundText.textContent = soundAlertEnabled ? "Sound: ON" : "Sound: OFF";
        showAdminToast(soundAlertEnabled ? "Order sound chime enabled 🔔" : "Order sound muted 🔇", "ℹ️");
        if (soundAlertEnabled) playOrderChime();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById("refreshOrdersBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = `<span>⏳ Refreshing...</span>`;
        await syncOrdersFromServer();
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `<span>🔄 Refresh Orders</span>`;
        showAdminToast("Order feed refreshed from database ✓", "🔄");
      });
    }

    // Order detail modal close buttons
    const closeDetailBtn = document.getElementById("closeOrderDetailModalBtn");
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    const detailModal = document.getElementById("adminOrderDetailModal");

    [closeDetailBtn, modalCloseBtn].forEach(b => {
      if (b && detailModal) {
        b.addEventListener("click", () => {
          detailModal.style.display = "none";
          currentActiveOrder = null;
        });
      }
    });

    // Save status from detail modal
    const saveStatusBtn = document.getElementById("modalSaveStatusBtn");
    const statusSelect = document.getElementById("modalStatusSelect");
    if (saveStatusBtn && statusSelect) {
      saveStatusBtn.addEventListener("click", () => {
        if (currentActiveOrder) {
          updateOrderStatus(currentActiveOrder.orderRef, statusSelect.value);
        }
      });
    }

    // Print slip button
    const printSlipBtn = document.getElementById("modalPrintSlipBtn");
    if (printSlipBtn) {
      printSlipBtn.addEventListener("click", () => {
        window.print();
      });
    }

    // Delete order from detail modal
    const modalDeleteBtn = document.getElementById("modalDeleteOrderBtn");
    if (modalDeleteBtn) {
      modalDeleteBtn.addEventListener("click", () => {
        if (currentActiveOrder && currentActiveOrder.orderRef) {
          if (confirm(`Are you sure you want to delete order ${currentActiveOrder.orderRef}? This will permanently remove it from tracking.`)) {
            deleteOrder(currentActiveOrder.orderRef);
          }
        }
      });
    }

    // Receipt zoom modal close
    const closeZoomBtn = document.getElementById("closeReceiptZoomBtn");
    const zoomModal = document.getElementById("receiptZoomModal");
    if (closeZoomBtn && zoomModal) {
      closeZoomBtn.addEventListener("click", () => {
        zoomModal.style.display = "none";
      });
    }

    // Restock modal listeners
    const restockModal = document.getElementById("restockModal");
    const closeRestockBtn = document.getElementById("closeRestockModalBtn");
    const cancelRestockBtn = document.getElementById("cancelRestockBtn");
    const restockForm = document.getElementById("restockForm");

    [closeRestockBtn, cancelRestockBtn].forEach(b => {
      if (b && restockModal) {
        b.addEventListener("click", () => {
          restockModal.style.display = "none";
        });
      }
    });

    if (restockForm && restockModal) {
      restockForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const id = document.getElementById("restockProdId").value;
        const qty = document.getElementById("restockQtyInput").value;
        const threshold = document.getElementById("restockThresholdInput").value;

        if (typeof setStoreProductStock === "function") {
          setStoreProductStock(id, qty, threshold);
        }

        // Also post to backend inventory API (Admin Authenticated)
        authFetch(`${getApiBaseUrl()}/api/inventory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id, stock: qty, lowStockThreshold: threshold })
        }).catch(() => {});

        restockModal.style.display = "none";
        showAdminToast(`Stock updated to ${qty} bottles! ✓`, "📦");
        renderInventoryTracker();
      });
    }
  }

  // Initialize Inventory Module Search & Filters
  function initInventoryModule() {
    const filterSelect = document.getElementById("invFilterSelect");
    if (filterSelect) {
      filterSelect.addEventListener("change", (e) => {
        inventoryFilterState.filter = e.target.value;
        renderInventoryTracker();
      });
    }

    const searchInput = document.getElementById("invSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        inventoryFilterState.search = e.target.value;
        renderInventoryTracker();
      });
    }
  }

  // --- LOAD DASHBOARD ---
  function loadDashboard() {
    populateCategorySelect();
    populateEditCategorySelect();
    updateStats();
    initOrdersModule();
    initInventoryModule();
    renderOrdersTable();
    renderInventoryTracker();
    renderManageTable();
    renderCategoriesTable();
    syncServerCategories();
    syncOrdersFromServer();
    syncProductsFromServer();
    startOrderLiveSync();
    checkDatabaseStatus();
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
      const res = await authFetch(`${getApiBaseUrl()}/api/categories/${encodeURIComponent(catId)}`, { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.deletedCategoryIds)) {
          localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(data.deletedCategoryIds));
        }
      }
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
            await authFetch(`${getApiBaseUrl()}/api/categories`, {
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
            await authFetch(`${getApiBaseUrl()}/api/categories`, {
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

  // Authoritative Cross-Device Sync for Categories
  async function syncServerCategories() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/categories`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          let updated = false;

          if (Array.isArray(data.categories)) {
            const currentCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES);
            const serverCustomStr = JSON.stringify(data.categories);
            if (currentCustom !== serverCustomStr) {
              localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES, serverCustomStr);
              updated = true;
            }
          }

          if (Array.isArray(data.deletedCategoryIds)) {
            const currentDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES);
            const serverDeletedStr = JSON.stringify(data.deletedCategoryIds);
            if (currentDeleted !== serverDeletedStr) {
              localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES, serverDeletedStr);
              updated = true;
            }
          }

          if (updated) {
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
    initEditProductModule();
    initCategoryManagement();
    initQuickCategoryModal();
    initOrdersModule();
    initInventoryModule();
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
