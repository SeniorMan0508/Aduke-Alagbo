# 🌿 Aduke Alagbo — Shop & Admin Dashboard Guide

We have created a dedicated **Shop Page** for your customers to browse all remedies, plus a secure **Admin Dashboard** and a **Node.js Backend Server** for the owner to manage products, update passwords, and recover access safely!

---

## 🚀 How to Start the Website & Backend

Run the following command in your project terminal:

```bash
npm start
```

This launches the server at **`http://localhost:3000`**:
- **Home Page**: [http://localhost:3000/index.html](http://localhost:3000/index.html)
- **Shop Catalog**: [http://localhost:3000/shop.html](http://localhost:3000/shop.html)
- **Admin Dashboard**: [http://localhost:3000/admin.html](http://localhost:3000/admin.html)

---

## 🔒 1. Private Admin Portal & Password Security

The Admin Dashboard is **100% invisible to regular customers**:
- **No public links**: There are zero "Admin" links in the navigation or footer.
- **Secret Shortcut**: Press **`Ctrl + Shift + A`** on the keyboard while anywhere on the site to jump directly to the Admin login.
- **Initial Default Passcode / Master Recovery Key**: `aduke2026`
- **Owner Registered Recovery Email**: `badmusdaniel0508@gmail.com`

> [!IMPORTANT]
> **No Plaintext Passwords & No Visible Security Keys:**
> Passwords are encrypted on the server using cryptographic salted hashing (`scrypt`). No security keys or passcodes are exposed on screen or in code. Whenever a password reset is requested, a secure **one-time 6-digit verification code** is sent directly to the owner's email address.

---

## 🔑 2. How the Owner Can Reset / Change Her Password

The owner has full control and can reset or change her password at any time without touching any code:

### Method A: Forgot Password? (One-Time 6-Digit Email Reset)
1. Open [admin.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/admin.html).
2. Click **"Forgot Passcode? Send Reset Code to Email ✉️"** underneath the login button.
3. Click **"📩 Send 6-Digit Code to My Email"**. A fresh verification code is sent directly to `badmusdaniel0508@gmail.com` (valid for 15 minutes).
4. Enter the **6-Digit Verification Code** from the email.
5. Enter her new passcode and confirm it.
6. Click **"Verify & Save Passcode ✓"** — **Done!** The password is immediately updated on the server and she is logged in.

### Method B: Changing Password Inside the Dashboard
1. Log in to the Admin Dashboard.
2. Click the **"⚙️ Store Info & Backup"** tab.
3. Find the **"🔐 Change Admin Security Passcode"** section.
4. Enter the current password, type the new password, and click **"Save New Passcode"**.
5. The password updates immediately on the server and works across all devices.

### Method C: Updating the Recovery Email Address
In the **"⚙️ Store Info & Backup"** tab under **"Admin Recovery Email"**, she can change the email address where reset codes are delivered whenever she needs.

---

## 🛍️ 3. Adding and Managing Products

### ✨ Adding a New Remedy:
1. Log in to [admin.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/admin.html).
2. Go to the **"➕ Add New Product"** tab.
3. Fill in the Remedy Name, Category, Price in Naira, photo (upload from device or choose a stock herbal photo), and dosage instructions.
4. Click **"Publish"**.
5. The product immediately appears on both the **Shop Page (`shop.html`)** and **Home Page (`index.html`)**.

### 🗑️ Removing a Remedy:
1. Click the **"📦 Manage All Products"** tab.
2. Find the product and click **"🗑️ Remove"**.

---

## 🏷️ 4. Creating and Managing Categories

The owner can now create **unlimited new herbal categories** at any time:

### ✨ How to Create a New Category:
1. Log in to [admin.html](file:///c:/Users/USER/OneDrive/Desktop/herbs%20website/admin.html).
2. Click the **"🏷️ Categories"** tab.
3. In the **"Create a Brand-New Category"** card:
   - Enter the **Category Name** (e.g. *Fertility Teas & Tonics*, *Skin & Hair Elixirs*, *Ulcer & Stomach Healing*, *Children's Herbal Syrups*).
   - Pick an emoji or enter an icon (e.g. 🌿, 🫖, 💆‍♀️, 🍯, 🍵, ⚡, 🌸).
   - Enter an optional short description / tagline.
   - Click **"➕ Create & Save Category"**.
4. **Done!** The new category is immediately active:
   - It appears in the **Category dropdown** when creating or editing products.
   - It appears in the **Shop Page sidebar filter (`shop.html`)** with live product counts.
   - It appears on the **Home Page category filter pills (`index.html`)** so customers can explore it immediately!

### ⚡ Shortcut: Create a Category While Adding a Product
- When inside the **"➕ Add New Product"** tab, click **"➕ Create New Category"** right above the Category dropdown.
- Type the name and click **"Create Category ✓"**.
- It is immediately created, added to your catalog, and selected for your new product automatically without having to switch tabs!

### 🗑️ Removing or Restoring Categories:
- In the **"🏷️ Categories"** tab, scroll to **"All Categories"** to see all active categories, their icons, descriptions, and how many remedies are assigned to each.
- Click **"🗑️ Delete"** next to any custom category to remove it. (If products are assigned to it, a safety warning will appear).
- To revert back to original factory categories at any time, click **"🔄 Restore Default Categories"**.

---

## 💬 5. Customer Comments & Post-Purchase Reviews

Customers can now leave reviews and comments that **always appear on the website homepage**:

### ⭐ How Customers Submit Reviews:
1. **Immediately After Checkout:**
   - In the **Order Receipt Modal**, right after confirming their order, customers see a dedicated **"⭐ Leave a Review & Share Your Experience"** box.
   - They pick their star rating (1–5 stars), write their comment, and click **"🌿 Post Comment to Website"**.
   - Their comment is instantly saved to the database (`data/reviews.json`) and appears live on the home page with a **"✓ Verified Buyer"** badge!
2. **From the Landing Page Directly:**
   - Under the **"Customer Stories"** section on the homepage, customers can click **"✍️ Share Your Review / Leave Comment"** at any time to open a review modal and submit feedback.

### 🛡️ Admin Moderation of Reviews:
- In the [Admin Dashboard](admin.html), click the **"💬 Customer Reviews"** tab to view all customer comments, ratings, remedies reviewed, and dates.
- The owner can click **"🗑️ Delete"** next to any comment to remove it from the website immediately if inappropriate.

---

## 🛒 6. Real-Time Customer Order & Product Purchase Tracking

When customers visit your website (`shop.html` or `index.html`) and place an order:
1. **Live Automatic Alert**: As soon as an order is confirmed, it appears live in your Admin Dashboard under the **"🛒 Live Purchases"** tab.
2. **Audio Chime Notification**: If you have the Admin Dashboard open on your phone or laptop, a melodic 2-tone chime alerts you that a new order has arrived!
3. **Verify Bank Transfer & Inspect Proof**:
   - For customers paying via Bank Transfer, their **Sender Name**, **Bank Name**, and **Session ID / Reference Code** are displayed.
   - Click **"Inspect Attached Receipt Screenshot"** to view their full bank transfer screenshot in high-resolution, verify the credit alert in your Kuda Bank app, and click **"✓ Verify Alert"** with one tap.
4. **Instant WhatsApp Customer Dispatch Update**:
   - Click **"💬 WhatsApp"** next to any customer order to immediately open WhatsApp with a pre-composed, polite dispatch notice containing the order reference and customer address.
5. **Print Packing Slips**:
   - Click **"👁️ Order Slip"** and tap **"🖨️ Print Packing Slip"** to print or save a clean delivery receipt to pack with herbal bottles.
6. **Order Lifecycle Statuses**:
   - 🟡 **Pending Verification**: Customer submitted payment and transfer proof, awaiting owner verification.
   - 🟢 **Payment Verified**: Bank alert confirmed by owner.
   - 🚚 **Dispatched**: Package handed over to local or interstate courier rider.
   - ✅ **Delivered**: Package received safely by customer.
   - ❌ **Cancelled**: Order cancelled or refunded.

---

## 📊 7. Product Sales & Stock Inventory Tracker

Under the **"📊 Product Sales & Stock Tracker"** tab in the Admin backend:
1. **Track Sales Per Product**:
   - View exactly how many bottles/units of each remedy customers have purchased (e.g. *Agbo Jedi-Jedi Extra Strength: 3 bottles sold*).
   - View **Gross Sales Revenue** generated by each remedy (e.g. *₦19,500*).
   - View the count of distinct customer orders containing each remedy.
2. **Bestseller Ranking**:
   - Remedies are dynamically ranked: 🥇 **#1 Bestseller**, 🥈 **#2**, 🥉 **#3** based on real buyer orders.
3. **Inventory & Stock Management**:
   - Each remedy shows its live remaining stock level.
   - **🟢 In Stock** (> 8 bottles remaining).
   - **⚠️ Low Stock Warning** (≤ 8 bottles remaining) — alerts you to brew/restock in time!
   - **🔴 Out of Stock** (0 bottles remaining).
4. **1-Click Restocking**:
   - Click the `+` or `−` buttons next to any product or click **"📦 Restock"** to set a new bottle count and restock threshold.

---

## 📁 Summary of Files:
- [server.js](server.js) — Secure Node.js & Express backend for orders, inventory, catalog, password auth, and hosting.
- [index.html](index.html) — Brand homepage with remedies, remedy finder quiz, dosage guide, and customer reviews.
- [shop.html](shop.html) — Dedicated shop catalog with sidebar filters, sorting, and full bank transfer checkout.
- [admin.html](admin.html) — Admin portal with live purchases feed, product sales tracking, and catalog controls.
- [admin.js](admin.js) — Admin frontend controller connected to live order streams and inventory API.
- [products.js](products.js) — Product catalog, storage helpers, orders database, and sales analytics.
- [store-config.js](store-config.js) — Public store info (Bank details, WhatsApp numbers, shipping rates).

