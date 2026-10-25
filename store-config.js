/**
 * ADUKE ALAGBO - STORE CONFIGURATION
 * =====================================
 * You can easily edit your bank details, phone number, currency,
 * and delivery rates right here in this file!
 */

const STORE_CONFIG = {
  // Brand Information
  storeName: "Aduke Alagbo",
  backendUrl: "https://aduke-alagbo.onrender.com",
  logoImage: "images/aduke-alagbo-logo.jpeg",
  tagline: "Authentic Ancestral Remedies • 100% Wildcrafted African Botanicals",
  established: "2018",

  // Contact & WhatsApp
  // Note: For WhatsApp link, country code without '+' or spaces (e.g. 2349055126388)
  sellerPhone: "+234 905 512 6388",
  whatsappNumber: "2349055126388",
  sellerEmail: "badmusdaniel0508@gmail.com",
  storeLocation: "Abeokuta, Ogun State, Nigeria",
  openingHours: "Mon - Sat: 8:00 AM - 7:00 PM (WAT)",

  // Currency
  currencySymbol: "₦",
  currencyCode: "NGN",

  // Security Note:
  // Admin passcode is securely hashed and verified on the backend server (server.js).
  // The owner can change or reset her password directly in admin.html.

  // -------------------------------------------------------------
  // BANK TRANSFER DETAILS (Customer sees this at checkout)
  // EDIT THESE WHEN YOU HAVE HER OFFICIAL BANK ACCOUNT:
  // -------------------------------------------------------------
  bankDetails: {
    bankName: "Kuda Bank",               // Change to her bank (e.g. GTBank, Zenith Bank, Access, OPay, etc.)
    accountNumber: "2023980523",           // Put her 10-digit NUBAN account number
    accountName: "Badmus Daniel Ayodapo",         // Put the exact account name registered with the bank
    transferInstructions: "Please use your Order Number (e.g. #AA-1234) as the transfer description/narration. Once transferred, click 'Confirm Payment' to notify us on WhatsApp immediately."
  },

  // Delivery Options & Fees
  shipping: {
    local: {
      name: "Local Intra-State Dispatch (Abeokuta Same/Next Day)",
      price: 2500,
      feeLabel: "₦2,500",
      description: "Fast doorstep courier in Abeokuta & nearby environs"
    },
    nationwide: {
      name: "Nationwide Interstate Courier (2-3 Business Days)",
      price: 0,
      feeLabel: "Sorted with dispatch rider",
      description: "Secure delivery to Abuja, Port Harcourt, Lagos, Ibadan, and all 36 states (Delivery fee sorted between buyer and dispatch rider upon delivery)"
    },
    international: {
      name: "International Express Shipping (DHL / FedEx Express)",
      price: 0,
      feeLabel: "Sorted with courier",
      description: "Worldwide tracked priority delivery (Courier fee sorted between buyer and dispatch rider/carrier upon dispatch)"
    },
    freeShippingThreshold: 50000 // Free standard delivery on orders above ₦50,000
  },

  // Promo & Coupon Codes
  discounts: {
    "ADUKE10": { type: "percentage", value: 10, label: "10% Aduke Alagbo Welcome Discount" },
    "QUADACE10": { type: "percentage", value: 10, label: "10% Welcome Discount" },
    "AGBOLOVE": { type: "fixed", value: 2000, label: "₦2,000 Special Wellness Voucher" },
    "VITALITY": { type: "percentage", value: 15, label: "15% Herbal Vitality Promo" }
  }
};

// Freeze object to avoid accidental mutation
if (typeof Object.freeze === "function") {
  Object.freeze(STORE_CONFIG.bankDetails);
}
