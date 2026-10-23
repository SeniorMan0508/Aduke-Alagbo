# 🌿 Aduke Alagbo — How to Edit Bank & Store Details

You can change the seller's bank details, phone number, delivery fees, or store details at any time in **less than 60 seconds**!

---

## 1. Where to edit:
Open the file named **`store-config.js`** located in the root of your website folder:
`c:\Users\ADMIN\OneDrive\Desktop\herbs website\store-config.js`

---

## 2. Changing the Bank Transfer Details:
Look for lines 24–33 in `store-config.js`:

```javascript
  bankDetails: {
    bankName: "Access Bank",               // Put her bank name (e.g. GTBank, Zenith, Access, OPay, Palmpay)
    accountNumber: "0123456789",           // Put her 10-digit NUBAN account number
    accountName: "ADUKE ALAGBO",         // Put the account name registered with the bank
    transferInstructions: "Please use your Order Number or Name as the transfer narration..."
  },
```

Simply replace:
- `"Access Bank"` with her actual bank (e.g. `"Guaranty Trust Bank"`, `"Kuda Bank"` or `"OPay"`).
- `"0123456789"` with her actual 10-digit account number.
- `"ADUKE ALAGBO"` with her actual bank account holder name.

**Save the file (`Ctrl + S`)** and refresh the browser. The bank details in the checkout modal and bank transfer guide update immediately!

> 💡 **Proof of Payment & Fraud Protection:**
> The checkout now includes an automated **"Attach Proof of Transfer"** upload box. Customers must upload their bank payment screenshot before submitting. You receive the order with proof on WhatsApp & Email, giving you 100% peace of mind to verify your instant Kuda credit alert before dispatch!

---

## 3. Changing the WhatsApp Phone Number & Email:
In the same `store-config.js` file around lines 16–18:

```javascript
  sellerPhone: "+234 905 512 6388",
  whatsappNumber: "2349055126388",
  sellerEmail: "badmusdaniel0508@gmail.com",
```

- **To change the WhatsApp Number**: Update `whatsappNumber` without any `+` or spaces (e.g. `2348012345678`).
- **To change the Order Notification Email**: Replace `"badmusdaniel0508@gmail.com"` with any new Gmail address. All orders and customer delivery addresses will automatically be sent to that inbox!

---

## 4. Adjusting Delivery Fees:
In `store-config.js` under `shipping`:
- **Local Dispatch Courier**: Default is `2500` (₦2,500).
- **Nationwide Interstate Courier**: Set to `0` / *"Sorted with dispatch rider"* (Fee is sorted directly between buyer and rider upon delivery).
- **International Priority (DHL / FedEx)**: Set to `0` / *"Sorted with courier"* (Courier fee is sorted directly between buyer and carrier upon dispatch).
- **Free Delivery Threshold**: Default is `50000` (Orders over ₦50,000 get free local delivery).

---

## 5. Adding or Editing Products:
Open **`products.js`**. You will find all herbs clearly listed with their:
- `name`
- `price`
- `shortDesc`
- `benefits`
- `ingredients`
- `usage`

You can edit prices or add new products following the exact same template!
