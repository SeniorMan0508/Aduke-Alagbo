/**
 * ADUKE ALAGBO - PRODUCT CATALOG
 * =================================
 * Real, authentic herbal remedies with complete traditional benefits,
 * ingredients, dosage, and pricing in Naira.
 */

const PRODUCTS_DATA = [
  {
    id: "agbo-jedi-extra",
    name: "Agbo Jedi-Jedi Extra Strength",
    subtitle: "Traditional Digestive, Waist & Lumbar Herbal Decoction",
    category: "agbo",
    categoryLabel: "Agbo & Tonics",
    price: 6500,
    originalPrice: 8000,
    rating: 4.9,
    reviewsCount: 148,
    image: "images/agbo-jedi.jpg",
    badge: "Bestseller",
    badgeType: "hot",
    healthGoals: ["digestion", "detox", "pain-relief"],
    shortDesc: "Potent ancestral formulation brewed to flush excess sugar, relieve lower back pain, hemorrhoids (pile), and stubborn digestive sluggishness.",
    fullDesc: "Agbo Jedi-Jedi Extra Strength is prepared using time-honored traditional Yoruba herbal extraction techniques. Formulated with wild-harvested roots and barks known to cleanse the digestive tract, tone colon health, restore natural blood sugar balance, and relieve chronic lumbar aches associated with traditional jedi-jedi.",
    benefits: [
      "Rapid relief from chronic lower back and waist stiffness",
      "Cleanses intestinal buildup and supports bowel regularity",
      "Assists in soothing internal and external hemorrhoids (pile)",
      "Helps eliminate sugar toxins from the bloodstream",
      "Boosts morning energy and metabolic lightness"
    ],
    ingredients: [
      "Aristolochia albida (Baaka)",
      "Morinda lucida (Oruwo bark)",
      "Khaya senegalensis (Oganwo bark)",
      "Zingiber officinale (Ginger root)",
      "Allium sativum (Natural mountain garlic extract)"
    ],
    usage: "Take one measuring cup (50ml) morning on an empty stomach and night before bed. Can be taken warm for enhanced absorption.",
    caution: "Not recommended for pregnant women or nursing mothers under 3 months postpartum."
  },
  {
    id: "man-power-vitality",
    name: "Man-Power Virility & Stamina Roots Infusion",
    subtitle: "Ancient African Roots for Male Endurance & Peak Performance",
    category: "men",
    categoryLabel: "Men's Vitality",
    price: 9500,
    originalPrice: 12000,
    rating: 5.0,
    reviewsCount: 215,
    image: "images/man-power.jpg",
    badge: "Top Seller",
    badgeType: "gold",
    healthGoals: ["stamina", "energy", "mens-health"],
    shortDesc: "Pure botanical vitality tonic crafted from potent African aphrodisiac roots to naturally boost testosterone, stamina, hardness, and all-day energy.",
    fullDesc: "Crafted exclusively for men seeking robust stamina and vigor without chemical side effects. This 100% natural infusion leverages rare wild roots known in traditional African medicine to enhance nitric oxide levels, boost blood circulation, improve intimate performance, and combat physical fatigue.",
    benefits: [
      "Elevates natural testosterone and masculine vitality",
      "Improves healthy pelvic circulation for sustained firmness",
      "Increases sexual endurance and prevents premature tiredness",
      "Deeply energizes muscles and relieves chronic fatigue",
      "100% natural roots with zero chemical additives or heart palpitations"
    ],
    ingredients: [
      "Mondia whitei (Isirigun / White's Ginger)",
      "Securidaca longepedunculata (Ipeta root)",
      "Cola acuminata (Ancestral Kola extract)",
      "Ginger & Alligator Pepper seed extract",
      "Wild African Ginseng"
    ],
    usage: "Shake well. Drink 50ml 45 minutes before intimacy, or take 30ml daily as a continuous vitality maintenance tonic.",
    caution: "Keep out of reach of children. Store in a cool dry place or refrigerate after opening."
  },
  {
    id: "queens-hormonal-balance",
    name: "Queen's Hormonal Balance & Womb Cleanse",
    subtitle: "Organic Fertility, Cycle Regulator & Womb Wellness Herbal Blend",
    category: "women",
    categoryLabel: "Women's Wellness",
    price: 8500,
    originalPrice: 10500,
    rating: 4.9,
    reviewsCount: 182,
    image: "images/hormonal-balance.jpg",
    badge: "Doctor Approved",
    badgeType: "featured",
    healthGoals: ["fertility", "hormones", "womb-care"],
    shortDesc: "A gentle yet restorative herbal tea and botanical tonic to regulate irregular menstrual cycles, ease cramps, clear hormonal acne, and prepare the womb for conception.",
    fullDesc: "Designed for women seeking optimal endocrine harmony. This restorative botanical blend gently cleanses the reproductive tract, balances estrogen and progesterone levels, dissolves stubborn hormonal blockages, and nurtures ovulatory health for natural conception.",
    benefits: [
      "Regulates irregular or missed menstrual cycles",
      "Significantly eases severe menstrual cramps and bloating",
      "Clears stubborn adult hormonal acne and balances skin oil",
      "Nourishes uterine lining and supports natural conception",
      "Assists in clearing internal womb blockages and stagnant fluids"
    ],
    ingredients: [
      "Hibiscus sabdariffa (Zobo calyx)",
      "Red Raspberry leaf (Rubus idaeus)",
      "Ficus capensis (Opoto leaf)",
      "Tetrapleura tetraptera (Prekese / Aidan pod)",
      "Chasteberry & Wild Marigold petals"
    ],
    usage: "Steep 1 tablespoon in freshly boiled water for 10-15 minutes. Drink warm 2 times daily. Best started right after your period ends.",
    caution: "Discontinue use once pregnancy is officially confirmed."
  },
  {
    id: "agbo-idakole-blend",
    name: "Agbo Idakole Traditional Male Elixir",
    subtitle: "Ancestral Formulation for Male Reproductive Health & Energy",
    category: "agbo",
    categoryLabel: "Agbo & Tonics",
    price: 7500,
    originalPrice: 9000,
    rating: 4.8,
    reviewsCount: 94,
    image: "images/agbo-idakole.jpg",
    badge: "Ancient Recipe",
    badgeType: "standard",
    healthGoals: ["mens-health", "stamina", "detox"],
    shortDesc: "Targeted traditional Yoruba decoction formulated specifically to purify the male prostate, enhance sperm count & motility, and strengthen lower core muscles.",
    fullDesc: "Idakole is a classic herbal science practiced for centuries. It directly targets deep-seated infections, strengthens pelvic floor musculature, enhances sperm vitality, and revitalizes men suffering from low drive or lingering reproductive infections.",
    benefits: [
      "Cleanses deep urinary and prostate channels",
      "Supports healthy sperm quality, volume, and motility",
      "Combats lingering microbial infections in the reproductive tract",
      "Relieves dull groin aches and discomfort",
      "Boosts long-term physical vigor and vitality"
    ],
    ingredients: [
      "Cassia occidentalis (Agbado / Senna leaf)",
      "Nauclea latifolia (Tafia bark / African peach)",
      "Bridelia ferruginea (Ira bark)",
      "Clove & Wild Peppercorns"
    ],
    usage: "Take 1 small glass (60ml) every other day, preferably after dinner.",
    caution: "Avoid taking with alcohol or sour carbonated sodas."
  },
  {
    id: "raw-ancestral-roots",
    name: "Raw Ancestral Roots & Pods Bundle",
    subtitle: "Aidan Pod (Prekese), Bitter Kola, Alligator Pepper & Goron Tula",
    category: "raw",
    categoryLabel: "Raw Herbs & Spices",
    price: 12000,
    originalPrice: 15000,
    rating: 5.0,
    reviewsCount: 167,
    image: "images/raw-herbs.jpg",
    badge: "100% Wildcrafted",
    badgeType: "organic",
    healthGoals: ["detox", "immunity", "fertility"],
    shortDesc: "An all-in-one sacred bundle of Nigeria's most potent sun-dried whole medicinal roots, aromatic Aidan pods, selected bitter kola nuts, and alligator peppers.",
    fullDesc: "Experience herbalism in its purest unadulterated state. This bundle includes freshly harvested and sun-cured Aidan pods (Prekese), grade-A bitter kola, pungent alligator pepper pods, and assorted dried medicinal barks. Perfect for preparing your personal home decoctions, cooking medicinal soups, or daily raw chewing.",
    benefits: [
      "100% chemical-free, pesticide-free whole botanicals",
      "Prekese pods assist blood pressure and postpartum womb healing",
      "Bitter Kola protects the respiratory tract and lungs",
      "Alligator pepper delivers antioxidant and anti-inflammatory properties",
      "Versatile for cooking, boiling as tea, or macerating in water"
    ],
    ingredients: [
      "3x Grade-A Whole Aidan Pods (Prekese)",
      "250g Dried Organic Bitter Kola Nuts",
      "2x Whole Alligator Pepper Pods (Atare)",
      "Selected Assorted Bitter Barks & Licorice Wood"
    ],
    usage: "Crush or break desired pods/roots into 1.5L of clean water and boil for 25 minutes. Filter and drink warm.",
    caution: "Store in an airtight container away from moisture."
  },
  {
    id: "immune-booster-elixir",
    name: "Immune Booster & Blood Purifier Elixir",
    subtitle: "High-Potency Anti-Inflammatory & Vitality Shield",
    category: "wellness",
    categoryLabel: "Wellness & Detox",
    price: 7000,
    originalPrice: 8500,
    rating: 4.9,
    reviewsCount: 112,
    image: "images/agbo-jedi.jpg",
    badge: "All Natural",
    badgeType: "standard",
    healthGoals: ["immunity", "detox", "energy"],
    shortDesc: "Fortify your body's natural defense system against seasonal malaria, fatigue, typhoid symptoms, and environmental toxins with this bitter-sweet bio-elixir.",
    fullDesc: "Formulated with wild neem leaf, ginger, organic raw honey, turmeric, and bitter leaf extracts. It purifies sluggish lymphatic fluid, enhances liver detoxification, and rapidly recharges your natural immunity.",
    benefits: [
      "Stimulates active white blood cell defense",
      "Deeply flushes toxins from liver and kidneys",
      "Helps combat recurring malaria weakness and chills",
      "Reduces chronic full-body inflammation",
      "Supports clear, glowing skin from within"
    ],
    ingredients: [
      "Azadirachta indica (Dogonyaro / Neem leaf)",
      "Curcuma longa (Raw wild turmeric)",
      "Zingiber officinale (Ginger juice)",
      "Vernonia amygdalina (Bitter leaf)",
      "Organic Raw Mountain Honey"
    ],
    usage: "Take 2 tablespoons (30ml) once daily in the morning with a cup of warm lemon water.",
    caution: "Shake vigorously before each use."
  },
  {
    id: "goron-tula-fruit-pack",
    name: "Organic Goron Tula Fruit & Syrup Pack",
    subtitle: "Silky Miracle Fruit for Intimacy, Lubrication & Hormonal Libido",
    category: "women",
    categoryLabel: "Women's Wellness",
    price: 6000,
    originalPrice: 7500,
    rating: 5.0,
    reviewsCount: 230,
    image: "images/raw-herbs.jpg",
    badge: "Customer Favorite",
    badgeType: "hot",
    healthGoals: ["fertility", "hormones", "stamina"],
    shortDesc: "Famous Northern Nigerian sweet miracle fruit known to naturally boost intimate lubrication, enhance female pleasure, balance vaginal pH, and boost libido.",
    fullDesc: "Goron Tula (Azanza garckeana) is nature's gift for female vitality and passion. When chewed or taken as extracted syrup, it naturally promotes natural moisture, balances intimate flora, enhances sensation, and supports natural fertility.",
    benefits: [
      "Natural and rapid relief from vaginal dryness",
      "Boosts sexual desire, arousal, and sensitivity",
      "Helps maintain fresh, healthy intimate feminine balance",
      "Naturally sweet taste, pleasant to chew daily",
      "Rich in natural collagen and rejuvenating antioxidants"
    ],
    ingredients: [
      "100% Pure Organic Sun-Ripened Goron Tula Fruits",
      "Cold-Pressed Goron Tula Botanical Mucilage"
    ],
    usage: "Soak 2-3 fruits in warm water for 15 minutes, then chew the chewy flesh and swallow the sweet juice. Alternatively, take 1 tablespoon of syrup 1 hour before intimacy.",
    caution: "100% natural, safe for long-term daily enjoyment."
  },
  {
    id: "couples-conception-detox-kit",
    name: "Complete Couples Conception & Womb Pack",
    subtitle: "Dual Cleansing & Fertility Restoration for Husband & Wife",
    category: "wellness",
    categoryLabel: "Wellness & Detox",
    price: 24500,
    originalPrice: 32000,
    rating: 5.0,
    reviewsCount: 78,
    image: "images/hero.jpg",
    badge: "Save ₦7,500",
    badgeType: "gold",
    healthGoals: ["fertility", "mens-health", "womb-care", "detox"],
    shortDesc: "Comprehensive herbal fertility regimen containing Queen's Womb Cleanse, Man-Power Vitality Tonic, and Raw Prekese Ancestral Roots Bundle.",
    fullDesc: "When preparing for pregnancy, both partners benefit from deep biological cleansing and revitalization. This synergistic pack provides complete 30-day nourishment: regulating her cycle and preparing the womb while boosting his sperm count, motility, and stamina.",
    benefits: [
      "Complete 30-day herbal regimen for husband and wife",
      "Flushes stubborn toxins, infection residues, and inflammation",
      "Enhances male sperm parameters and female ovulation quality",
      "Includes step-by-step fertility timing calendar and dosage guide",
      "Massive 25% savings compared to purchasing items individually"
    ],
    ingredients: [
      "1x Queen's Hormonal Balance & Womb Cleanse",
      "1x Man-Power Virility & Stamina Roots Infusion",
      "1x Agbo Idakole Traditional Male Elixir",
      "1x Raw Ancestral Prekese & Roots Pack"
    ],
    usage: "Full instructions and calendar schedule provided inside the package.",
    caution: "Both partners should adhere strictly to dosage guidelines."
  }
];

// Default Core Categories
const DEFAULT_CATEGORIES = [
  { id: "agbo", label: "Agbo & Tonics", icon: "🏺", desc: "Digestive flushes, pile & ancestral tonics", isDefault: true },
  { id: "men", label: "Men's Vitality", icon: "⚡", desc: "Virility, stamina & male wellness roots", isDefault: true },
  { id: "women", label: "Women's Wellness", icon: "🌸", desc: "Womb cleanses, cycle & hormonal harmony", isDefault: true },
  { id: "raw", label: "Raw Roots & Pods", icon: "🪵", desc: "Aidan pods (Prekese), bitter kola & raw spices", isDefault: true },
  { id: "wellness", label: "Immunity & Detox", icon: "🛡️", desc: "Liver cleanse, antiviral & blood purifiers", isDefault: true }
];

// Health Goal Tags
const HEALTH_GOALS = [
  { id: "all", label: "All Health Goals" },
  { id: "digestion", label: "Jedi-Jedi & Digestion" },
  { id: "stamina", label: "Man-Power & Stamina" },
  { id: "fertility", label: "Fertility & Womb Cleanse" },
  { id: "hormones", label: "Hormonal Balance" },
  { id: "immunity", label: "Immunity Booster" },
  { id: "detox", label: "Blood Purifier & Detox" }
];

// ==========================================================================
// DYNAMIC CATALOG & CATEGORY STORE (Syncs between Admin, Shop, & Home)
// ==========================================================================
const QUADACE_STORAGE_KEYS = {
  CUSTOM_PRODUCTS: "quadace_custom_products",
  DELETED_PRODUCTS: "quadace_deleted_products",
  CUSTOM_CATEGORIES: "quadace_custom_categories",
  DELETED_CATEGORIES: "quadace_deleted_categories",
  ORDERS: "quadace_orders",
  INVENTORY: "quadace_inventory"
};

/**
 * Retrieve all active categories (combines defaults with owner-created categories).
 * @param {boolean} includeAll - If true, prepends { id: "all", label: "All Herbs", icon: "🌱" }
 */
function getStoreCategories(includeAll = false) {
  let custom = [];
  let deleted = [];

  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES);
    if (savedCustom) {
      custom = JSON.parse(savedCustom);
      if (!Array.isArray(custom)) custom = [];
    }
  } catch (e) {
    console.warn("Could not read custom categories from storage", e);
  }

  try {
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES);
    if (savedDeleted) {
      deleted = JSON.parse(savedDeleted);
      if (!Array.isArray(deleted)) deleted = [];
    }
  } catch (e) {
    console.warn("Could not read deleted categories from storage", e);
  }

  const activeBase = DEFAULT_CATEGORIES.filter(c => !deleted.includes(c.id));
  const activeCustom = custom.filter(c => !deleted.includes(c.id));
  const combined = [...activeBase, ...activeCustom];

  if (includeAll) {
    return [{ id: "all", label: "All Herbs", icon: "🌱", desc: "All remedies in stock" }, ...combined];
  }
  return combined;
}

/**
 * Get display label for a category ID.
 */
function getCategoryLabel(categoryId) {
  if (!categoryId || categoryId === "all") return "All Remedies";
  const allCats = getStoreCategories(false);
  const found = allCats.find(c => c.id === categoryId);
  if (found) return found.label;

  // Pretty fallback for unknown slug
  return categoryId
    .replace(/^cat-/, "")
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Save or update a category from the Admin Dashboard.
 */
function saveStoreCategory(category) {
  if (!category || (!category.label && !category.name)) return null;

  const rawLabel = (category.label || category.name).trim();
  const id = category.id || ("cat-" + rawLabel.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") + "-" + Date.now().toString().slice(-4));
  const icon = (category.icon ? category.icon.trim() : "") || "🌿";
  const desc = (category.desc || "").trim();

  const newCat = {
    id,
    label: rawLabel,
    icon,
    desc,
    isCustom: true,
    createdAt: category.createdAt || new Date().toISOString()
  };

  let custom = [];
  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES);
    if (savedCustom) {
      custom = JSON.parse(savedCustom);
      if (!Array.isArray(custom)) custom = [];
    }
  } catch (e) {}

  const existingIdx = custom.findIndex(c => c.id === id);
  if (existingIdx >= 0) {
    custom[existingIdx] = newCat;
  } else {
    custom.push(newCat);
  }

  localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(custom));

  // Undelete if previously marked deleted
  try {
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES);
    if (savedDeleted) {
      let deleted = JSON.parse(savedDeleted);
      deleted = deleted.filter(delId => delId !== id);
      localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(deleted));
    }
  } catch (e) {}

  return newCat;
}

/**
 * Delete a category by ID (works for both custom and default categories).
 */
function deleteStoreCategory(categoryId) {
  if (!categoryId || categoryId === "all") return false;

  // Remove from custom list
  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES);
    if (savedCustom) {
      let custom = JSON.parse(savedCustom);
      custom = custom.filter(c => c.id !== categoryId);
      localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(custom));
    }
  } catch (e) {}

  // Add to deleted categories list
  try {
    let deleted = [];
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES);
    if (savedDeleted) deleted = JSON.parse(savedDeleted);
    if (!deleted.includes(categoryId)) {
      deleted.push(categoryId);
      localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES, JSON.stringify(deleted));
    }
  } catch (e) {}

  return true;
}

/**
 * Reset categories to original factory defaults.
 */
function resetStoreCategories() {
  localStorage.removeItem(QUADACE_STORAGE_KEYS.CUSTOM_CATEGORIES);
  localStorage.removeItem(QUADACE_STORAGE_KEYS.DELETED_CATEGORIES);
  return true;
}

// Backward compatibility export for global CATEGORIES reference
var CATEGORIES = getStoreCategories(true);

/**
 * Retrieve all active products for the store.
 * Combines default catalog with admin-added products, and excludes deleted items.
 * Newly added admin products appear right at the top!
 */
function getStoreProducts() {
  let custom = [];
  let deleted = [];

  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS);
    if (savedCustom) {
      custom = JSON.parse(savedCustom);
      if (!Array.isArray(custom)) custom = [];
    }
  } catch (e) {
    console.warn("Could not read custom products from storage", e);
  }

  try {
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS);
    if (savedDeleted) {
      deleted = JSON.parse(savedDeleted);
      if (!Array.isArray(deleted)) deleted = [];
    }
  } catch (e) {
    console.warn("Could not read deleted products from storage", e);
  }

  // Filter default catalog
  const activeBase = PRODUCTS_DATA.filter(p => !deleted.includes(p.id));
  // Filter custom admin products
  const activeCustom = custom.filter(p => !deleted.includes(p.id));

  // Admin products come first so new arrivals are highlighted!
  return [...activeCustom, ...activeBase];
}

/**
 * Save or update a product from the Admin Dashboard.
 */
function saveStoreProduct(product) {
  if (!product || !product.id) return false;

  let custom = [];
  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS);
    if (savedCustom) {
      custom = JSON.parse(savedCustom);
      if (!Array.isArray(custom)) custom = [];
    }
  } catch (e) {}

  const existingIdx = custom.findIndex(p => p.id === product.id);
  if (existingIdx >= 0) {
    custom[existingIdx] = product;
  } else {
    // Add to top of custom list
    custom.unshift(product);
  }

  localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS, JSON.stringify(custom));

  // If this ID was previously in deleted list, undelete it
  try {
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS);
    if (savedDeleted) {
      let deleted = JSON.parse(savedDeleted);
      deleted = deleted.filter(id => id !== product.id);
      localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(deleted));
    }
  } catch (e) {}

  return true;
}

/**
 * Delete a product by ID (works for both custom and default items).
 */
function deleteStoreProduct(productId) {
  if (!productId) return false;

  // Remove from custom products
  try {
    const savedCustom = localStorage.getItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS);
    if (savedCustom) {
      let custom = JSON.parse(savedCustom);
      custom = custom.filter(p => p.id !== productId);
      localStorage.setItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS, JSON.stringify(custom));
    }
  } catch (e) {}

  // Add to deleted products list
  try {
    let deleted = [];
    const savedDeleted = localStorage.getItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS);
    if (savedDeleted) deleted = JSON.parse(savedDeleted);
    if (!deleted.includes(productId)) {
      deleted.push(productId);
      localStorage.setItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS, JSON.stringify(deleted));
    }
  } catch (e) {}

  return true;
}

/**
 * Reset store products to original factory defaults.
 */
function resetStoreProducts() {
  localStorage.removeItem(QUADACE_STORAGE_KEYS.CUSTOM_PRODUCTS);
  localStorage.removeItem(QUADACE_STORAGE_KEYS.DELETED_PRODUCTS);
  return true;
}

/**
 * Export complete catalog as a downloadable JSON file.
 */
function exportStoreProductsJSON() {
  const allProducts = getStoreProducts();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allProducts, null, 2));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", `quadace_catalog_${new Date().toISOString().slice(0, 10)}.json`);
  dlAnchorElem.click();
}

// ==========================================================================
// CUSTOMER PURCHASES & PRODUCT INVENTORY TRACKING STORE
// ==========================================================================

const DEFAULT_STORE_ORDERS = [
  {
    orderRef: "#QA-84920",
    customer: {
      name: "Mrs. Funmilayo Adeleke",
      phone: "+234 803 456 7891",
      email: "funmi.adeleke@gmail.com",
      address: "Block 4, Flat 2, Admiralty Way, Lekki Phase 1, Lagos State",
      notes: "Please call my security gate on arrival. Deliver before 3 PM if possible."
    },
    senderDetails: {
      bank: "GTBank",
      name: "Funmilayo Adeleke",
      sessionId: "00001324090543219"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "gtbank_transfer_receipt.jpg",
      dataUrl: "images/agbo-jedi.jpg",
      sessionId: "00001324090543219"
    },
    items: [
      {
        id: "agbo-jedi-extra",
        name: "Agbo Jedi-Jedi Extra Strength",
        price: 6500,
        quantity: 2,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      },
      {
        id: "raw-ancestral-roots",
        name: "Raw Ancestral Boiling Roots Bundle (Gbogbonise)",
        price: 5500,
        quantity: 1,
        image: "images/ancestral-roots.jpg",
        category: "raw"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 18500,
    finalTotal: 18500,
    paymentMethod: "bank",
    status: "verified",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), note: "Customer submitted bank transfer proof" },
      { status: "verified", timestamp: new Date(Date.now() - 100 * 60 * 1000).toISOString(), note: "Admin verified Kuda Bank transfer alert of ₦18,500" }
    ]
  },
  {
    orderRef: "#QA-93014",
    customer: {
      name: "Alhaji Ibrahim Danjuma",
      phone: "+234 812 345 6789",
      email: "ibrahim.d@yahoo.com",
      address: "Plot 14, Gwarinpa Estate, 3rd Avenue, Abuja, FCT",
      notes: "Kindly double-seal the bottles securely for courier travel."
    },
    senderDetails: {
      bank: "Zenith Bank",
      name: "Ibrahim Danjuma",
      sessionId: "00002819384729103"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "zenith_transfer_receipt.jpg",
      dataUrl: "images/man-power.jpg",
      sessionId: "00002819384729103"
    },
    items: [
      {
        id: "man-power-vitality",
        name: "Man-Power Virility & Stamina Roots Infusion",
        price: 9500,
        quantity: 2,
        image: "images/man-power.jpg",
        category: "men"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 19000,
    finalTotal: 19000,
    paymentMethod: "bank",
    status: "dispatched",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
      { status: "verified", timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
      { status: "dispatched", timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), note: "Handed over to interstate courier dispatch rider" }
    ]
  },
  {
    orderRef: "#QA-58291",
    customer: {
      name: "Dr. Folashade Babatunde",
      phone: "+234 902 112 3344",
      email: "dr.folashade@gmail.com",
      address: "12 Quarry Road, Ibara, Abeokuta, Ogun State",
      notes: "Local dispatch rider can deliver anytime today."
    },
    senderDetails: {
      bank: "Kuda Bank",
      name: "Folashade Babatunde",
      sessionId: "20239805230912"
    },
    receiptProof: {
      hasReceipt: true,
      fileName: "kuda_payment_proof.jpg",
      dataUrl: "images/hormonal-balance.jpg",
      sessionId: "20239805230912"
    },
    items: [
      {
        id: "queens-hormonal-balance",
        name: "Queen's Hormonal Balance & Womb Cleanse",
        price: 8500,
        quantity: 1,
        image: "images/hormonal-balance.jpg",
        category: "women"
      },
      {
        id: "agbo-idakole-blend",
        name: "Agbo Idakole Herbal Cleanser",
        price: 6000,
        quantity: 1,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      }
    ],
    shippingMethod: "local",
    shippingFee: 2500,
    discount: 0,
    subtotal: 14500,
    finalTotal: 17000,
    paymentMethod: "bank",
    status: "pending",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(), note: "Awaiting owner verification of Kuda Bank alert" }
    ]
  },
  {
    orderRef: "#QA-41908",
    customer: {
      name: "Emeka Okonkwo",
      phone: "+234 807 889 9112",
      email: "emeka.ok@outlook.com",
      address: "5 Commercial Avenue, Yaba, Lagos State",
      notes: "Purchased directly via WhatsApp customer inquiry."
    },
    senderDetails: {
      bank: "OPay",
      name: "Emeka Okonkwo",
      sessionId: "OPAY-77129031"
    },
    receiptProof: {
      hasReceipt: false
    },
    items: [
      {
        id: "man-power-vitality",
        name: "Man-Power Virility & Stamina Roots Infusion",
        price: 9500,
        quantity: 1,
        image: "images/man-power.jpg",
        category: "men"
      },
      {
        id: "agbo-jedi-extra",
        name: "Agbo Jedi-Jedi Extra Strength",
        price: 6500,
        quantity: 1,
        image: "images/agbo-jedi.jpg",
        category: "agbo"
      }
    ],
    shippingMethod: "nationwide",
    shippingFee: 0,
    discount: 0,
    subtotal: 16000,
    finalTotal: 16000,
    paymentMethod: "whatsapp",
    status: "delivered",
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    statusHistory: [
      { status: "pending", timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() },
      { status: "verified", timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
      { status: "dispatched", timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() },
      { status: "delivered", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), note: "Delivered safely to customer in Yaba" }
    ]
  }
];

/**
 * Retrieve all orders recorded on the website.
 */
function getStoreOrders() {
  try {
    const raw = localStorage.getItem(QUADACE_STORAGE_KEYS.ORDERS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read orders from localStorage", e);
  }
  // Initialize with authentic seed orders so the owner sees rich data immediately
  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_STORE_ORDERS));
  } catch (e) {}
  return [...DEFAULT_STORE_ORDERS];
}

/**
 * Save a new incoming customer order to local store and update product inventory.
 */
function saveStoreOrder(order) {
  if (!order || !order.orderRef) return false;
  let orders = getStoreOrders();

  // If already exists, update it; otherwise add to the very top (newest first)
  const existingIdx = orders.findIndex(o => o.orderRef === order.orderRef);
  if (existingIdx >= 0) {
    orders[existingIdx] = { ...orders[existingIdx], ...order };
  } else {
    orders.unshift(order);
  }

  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {
    console.error("Failed to save order to localStorage:", e);
  }

  // Update inventory remaining and units sold for each product in this order
  if (Array.isArray(order.items)) {
    order.items.forEach(item => {
      const qty = Number(item.quantity) || 1;
      adjustProductStock(item.id, -qty, qty);
    });
  }

  try {
    window.dispatchEvent(new CustomEvent("quadace_new_order_saved", { detail: order }));
  } catch (e) {}

  return true;
}

/**
 * Update the status of an existing customer order.
 */
function updateStoreOrderStatus(orderRef, newStatus, note = "") {
  const orders = getStoreOrders();
  const order = orders.find(o => o.orderRef === orderRef);
  if (!order) return false;

  order.status = newStatus;
  order.updatedAt = new Date().toISOString();
  if (!Array.isArray(order.statusHistory)) {
    order.statusHistory = [];
  }
  order.statusHistory.push({
    status: newStatus,
    timestamp: new Date().toISOString(),
    note: note || `Order marked as ${newStatus}`
  });

  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(orders));
    window.dispatchEvent(new CustomEvent("quadace_order_status_updated", { detail: { orderRef, newStatus } }));
  } catch (e) {}

  return true;
}

/**
 * Delete an order from store records.
 */
function deleteStoreOrder(orderRef) {
  let orders = getStoreOrders();
  orders = orders.filter(o => o.orderRef !== orderRef);
  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  } catch (e) {}
  return true;
}

/**
 * Retrieve inventory stock records for all remedies.
 */
function getStoreInventory() {
  try {
    const raw = localStorage.getItem(QUADACE_STORAGE_KEYS.INVENTORY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        return parsed;
      }
    }
  } catch (e) {}

  // Initialize stock defaults: default remedies have starting stock of 30 bottles each
  const initialInventory = {};
  const allProducts = getStoreProducts();
  allProducts.forEach(p => {
    initialInventory[p.id] = {
      stock: 35,
      lowStockThreshold: 8,
      lastRestocked: new Date().toISOString()
    };
  });

  // Deduct units already ordered in seed orders
  const orders = getStoreOrders();
  orders.forEach(ord => {
    if (ord.status !== "cancelled" && Array.isArray(ord.items)) {
      ord.items.forEach(it => {
        if (initialInventory[it.id]) {
          initialInventory[it.id].stock = Math.max(0, initialInventory[it.id].stock - (Number(it.quantity) || 1));
        }
      });
    }
  });

  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.INVENTORY, JSON.stringify(initialInventory));
  } catch (e) {}

  return initialInventory;
}

/**
 * Adjust stock count for a specific product.
 */
function adjustProductStock(productId, stockChange, unitsSoldChange = 0) {
  const inventory = getStoreInventory();
  if (!inventory[productId]) {
    inventory[productId] = { stock: 30, lowStockThreshold: 8, lastRestocked: new Date().toISOString() };
  }

  inventory[productId].stock = Math.max(0, (inventory[productId].stock || 0) + stockChange);
  inventory[productId].updatedAt = new Date().toISOString();

  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  } catch (e) {}

  return inventory[productId].stock;
}

/**
 * Set stock quantity and alert threshold directly for a product.
 */
function setStoreProductStock(productId, newStockQty, lowStockThreshold = 8) {
  const inventory = getStoreInventory();
  inventory[productId] = {
    stock: Math.max(0, parseInt(newStockQty, 10) || 0),
    lowStockThreshold: Math.max(1, parseInt(lowStockThreshold, 10) || 8),
    lastRestocked: new Date().toISOString()
  };

  try {
    localStorage.setItem(QUADACE_STORAGE_KEYS.INVENTORY, JSON.stringify(inventory));
  } catch (e) {}

  return inventory[productId];
}

/**
 * Compute real-time product performance analytics across all customer orders.
 * Returns an array of remedies with: unitsSold, totalRevenue, orderCount, stock, and stockStatus.
 */
function getProductSalesStats() {
  const products = getStoreProducts();
  const orders = getStoreOrders();
  const inventory = getStoreInventory();

  // Aggregate stats per product ID
  const statsMap = {};
  products.forEach(p => {
    const inv = inventory[p.id] || { stock: 30, lowStockThreshold: 8 };
    statsMap[p.id] = {
      id: p.id,
      name: p.name,
      category: p.category,
      categoryLabel: p.categoryLabel,
      image: p.image,
      price: p.price,
      unitsSold: 0,
      totalRevenue: 0,
      orderCount: 0,
      stock: inv.stock !== undefined ? inv.stock : 30,
      lowStockThreshold: inv.lowStockThreshold || 8,
      lastPurchasedAt: null
    };
  });

  orders.forEach(order => {
    if (order.status === "cancelled") return; // Skip cancelled orders
    if (Array.isArray(order.items)) {
      order.items.forEach(it => {
        const prodId = it.id;
        if (!statsMap[prodId]) {
          // If custom product or unrecognized ID
          statsMap[prodId] = {
            id: prodId,
            name: it.name,
            category: it.category || "agbo",
            categoryLabel: it.category ? (CATEGORY_LABELS[it.category] || "Herbal Remedy") : "Herbal Remedy",
            image: it.image || "images/agbo-jedi.jpg",
            price: it.price || 0,
            unitsSold: 0,
            totalRevenue: 0,
            orderCount: 0,
            stock: 20,
            lowStockThreshold: 5,
            lastPurchasedAt: null
          };
        }

        const qty = Number(it.quantity) || 1;
        const lineTotal = Number(it.price || statsMap[prodId].price || 0) * qty;

        statsMap[prodId].unitsSold += qty;
        statsMap[prodId].totalRevenue += lineTotal;
        statsMap[prodId].orderCount += 1;
        if (!statsMap[prodId].lastPurchasedAt || new Date(order.createdAt) > new Date(statsMap[prodId].lastPurchasedAt)) {
          statsMap[prodId].lastPurchasedAt = order.createdAt;
        }
      });
    }
  });

  const list = Object.values(statsMap);

  // Compute stockStatus and sort by unitsSold descending
  list.forEach(item => {
    if (item.stock <= 0) {
      item.stockStatus = "out_of_stock";
    } else if (item.stock <= item.lowStockThreshold) {
      item.stockStatus = "low_stock";
    } else {
      item.stockStatus = "in_stock";
    }
  });

  list.sort((a, b) => b.unitsSold - a.unitsSold);

  // Assign bestseller ranks (1, 2, 3...)
  list.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return list;
}


