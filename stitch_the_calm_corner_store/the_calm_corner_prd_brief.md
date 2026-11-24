# The Calm Corner — Product Requirements Document (PRD) & Design Specification

**Document Version:** 1.0  
**Status:** Approved for Implementation  
**Brand:** The Calm Corner  
**Domain:** Premium Botanical & Scented Home Décor E-commerce  
**Primary Market:** India (Base: Bengaluru)  
**Date:** Autumn / Winter 2024–2025  

---

## 1. Executive Summary & Brand Overview

### 1.1 Brand Mission & Vision
**The Calm Corner** is a direct-to-consumer premium lifestyle and e-commerce brand centered around the dual rituals of botanicals and ambient lighting (*"Plants & Candles"*). The brand transforms everyday residential and work environments into mindful, grounding sanctuaries through thoughtfully curated live foliage, everlasting artificial botanicals, and hand-poured pure soy-wax candles.

* **Brand Tagline:** *"A little green. A little glow. A lot of calm."*
* **Core Philosophy:** *"Small details can transform the feeling of a space. We curate quiet accompaniments for work tables, sunny sills, and slow evenings."*
* **Instagram Community:** `@thecalmcorner.life`

### 1.2 Target Audience & Personas
1. **The Urban Remote Worker:** 24–38 years old, tech/creative professional residing in Bengaluru, Mumbai, Pune, Delhi NCR. Values ergonomic, clean, and inspiring desk vignettes that alleviate digital fatigue.
2. **The Conscious Home Stylist:** Aesthetics-driven renter or homeowner seeking warm minimalism, earth-toned ceramic planters, and clean-burning non-toxic home scents.
3. **The Mindful Gifter:** Seeks high-touch, unboxing-worthy care packages (plant + candle pairings with handwritten seed-paper gift cards) for housewarmings, birthdays, and festive seasons.

---

## 2. Information Architecture & Site Map

The application consists of a persistent global frame (**Shell**) containing navigation, announcements, currency switchers, and cart access, wrapping four core desktop experiences:

```
[Global Header: Announcement Bar + Brand Mark + Category Nav + Utilities]
  ├── 1. Home (Landing Page)
  │     ├── Sunlit Editorial Hero (Dual CTAs)
  │     ├── Curated Category Grid (4 Pillars)
  │     ├── Brand Philosophy Manifesto & Visual Showcase
  │     ├── Curated Product Grid (Featured Botanicals & Lights)
  │     ├── The Calm Duo Unboxing Experience (Custom Bundle Builder)
  │     ├── Signature Scent Profiles (Aromatherapy Notes)
  │     ├── "Find Your Calm Corner" Vignette Inspiration Gallery
  │     ├── Community Instagram Gallery (@thecalmcorner.life)
  │     └── Newsletter Capture ("Stay in Our Little Corner")
  │
  ├── 2. Shop Catalog (/collections/all)
  │     ├── Curated Hero Banner & Filter Tabs
  │     ├── Multi-Faceted Faceted Filter Sidebar
  │     │     ├── Fulfillment & City (Bengaluru Same-Day vs Pan-India)
  │     │     ├── Plant Care & Sunlight (Low Light, Indirect Sun, Pet-Safe)
  │     │     ├── Candle Aroma Notes (Lavender Fog, Warm Vanilla, Citrus Zest)
  │     │     ├── Vessel & Planter Finish (Speckled Sandstone, Raw Terracotta)
  │     │     └── Price Range Filter Slider
  │     └── Responsive 3-Column Product Grid & Pagination
  │
  ├── 3. Product Detail Page (PDP — /products/:slug)
  │     ├── Multi-angle Image Gallery + Lifestyle Zoom View
  │     ├── Product Badge System (Handcrafted, Local Transit, Pure Soy)
  │     ├── Interactive Planter Finish Selector
  │     ├── Scent Variant Switcher
  │     ├── Bengaluru & Pan-India PIN Code Delivery Checker
  │     ├── Gift Ritual Add-on Toggle (+ ₹150 for Handwritten Note & Box)
  │     ├── Instant Buy (UPI / Card) + Sticky Add to Bag
  │     ├── Collapsible Accordions (Care Specs, Ingredients, Shipping)
  │     ├── "Frequently Paired Together" Bundle Up-sell Module
  │     └── Verified Customer Reviews & Photo Testimonials
  │
  └── 4. Our Story (/pages/about)
        ├── Brand Genesis & Founding Narrative ("Bengaluru Studio Roots")
        ├── Dual Pillars of Rest: "Why Plants?" & "Why Candles?"
        ├── Sustainable Craftsmanship (Acclimated Plants, Plastic-Free Cocooning)
        ├── Community Showcase & UGC Grid
        └── Curated Collection Gateway
[Global Footer: Editorial Brand Promise + Customer Care + Legal & Policies]
```

---

## 3. Visual Identity & Design System Specification

| Token Category | Value / Specification | Role & Usage |
| :--- | :--- | :--- |
| **Primary Color** | Deep Olive (`#48543A`) | Primary buttons, headers, emphasis text, icons |
| **Surface Base** | Warm Ivory (`#FCFAEB` / `#F8F5ED`) | Global background, editorial breathing room |
| **Surface Accents** | Soft Sandstone (`#F7F4E6` / `#E8DDCC`) | Card backgrounds, search inputs, active chips |
| **Secondary Accent**| Sage Green (`#A3AE91`) | Soft badges, foliage indicators, hover states |
| **Dark Neutral** | Deep Charcoal (`#292920`) | Body typography, high-contrast accents |
| **Display Font** | `Playfair Display`, serif | Hero headlines, collection titles, philosophical quotes |
| **Body Font** | `Inter` / `Manrope`, sans-serif | Clean product specs, pricing, filters, navigation |
| **Radius** | `8px` (`ROUND_EIGHT`) | Soft organic corners on cards, modals, and buttons |
| **Imagery Mood** | Natural daylight, warm botanical shadows, unhurried indoor scenes |

---

## 4. Detailed Functional & Technical Specifications

### 4.1 Fulfillment & City-Specific Logic (Bengaluru vs Pan-India)
* **Live Plants:** Highly susceptible to transit stress. Must include an automated PIN code validator. For PIN codes beginning with `560XXX` (Bengaluru Urban/Rural), offer:
  * *Climate-Cushioned Same-Day / Next-Day Direct Courier.*
  * Live-transit guarantee (14-day replacement).
* **Artificial Plants & Scented Soy Candles:** Available for all-India courier transit with break-free honeycomb packaging.

### 4.2 Product Detail Page (PDP) Customization Engine
* **Variant Dynamic Pricing:** Real-time pricing update based on ceramic planter selection (Speckled Sandstone, Raw Terracotta, Matte Olive).
* **The Ritual Pairing Engine:** Allows single-click bundle addition (*Plant + Brass Mister + Wick Trimmer*) with auto-applied bundle savings (e.g. Save ₹300).
* **Gifting Add-on Toggle:** Optional checkbox (+ ₹150) injecting custom recipient name and 200-character handwritten seed-paper message at checkout.

### 4.3 Checkout & Payment Integrations (India-Optimized)
* **Currency:** Indian Rupee (`INR ₹`).
* **Payment Gateways:** Razorpay / Cashfree supporting:
  * Unified Payments Interface (UPI via Google Pay, PhonePe, Paytm, Cred).
  * Netbanking across major Indian public/private banks.
  * Debit / Credit Cards (Visa, Mastercard, RuPay, Amex).
  * Cash on Delivery (COD) with verification OTP on select non-live plant items.

---

## 5. Non-Functional & Operational Requirements

1. **Performance & Core Web Vitals:**
   * Largest Contentful Paint (LCP) < 2.0s on 4G networks.
   * Cumulative Layout Shift (CLS) < 0.05.
   * Next-Gen image formats (WebP/AVIF) with lazy-loading for off-screen product galleries.
2. **SEO & Discoverability:**
   * Schema.org `Product`, `Offer`, and `BreadcrumbList` microdata.
   * Semantic targeting: *"Indoor plants online Bengaluru"*, *"Scented soy candles India"*, *"Housewarming plant combos"*.
3. **Customer Support:**
   * Sticky, unobtrusive WhatsApp button linking directly to the concierge line for repotting guidance and custom bulk gift orders.
