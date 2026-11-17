import type { Language, OrderStatus } from '../types';

export const TRANSLATIONS: Record<
  Language,
  {
    brandName: string;
    karachiBadge: string;
    navShop: string;
    navCategories: string;
    navTrack: string;
    navAI: string;
    navAdmin: string;
    navAccount: string;
    cart: string;
    heroHeadline: string;
    heroSubhead: string;
    heroShopBtn: string;
    heroAiBtn: string;
    deliveryCityLabel: string;
    deliveryCityValue: string;
    fixedFeeLabel: string;
    pendingSetup: string;
    paymentLabel: string;
    paymentCodOnly: string;
    supportLabel: string;
    allCategories: string;
    searchPlaceholder: string;
    sortFeatured: string;
    sortPriceAsc: string;
    sortPriceDesc: string;
    inStock: string;
    lowStock: string;
    outOfStock: string;
    addToCart: string;
    viewDetails: string;
    emptyCatalog: string;
    cartTitle: string;
    cartEmpty: string;
    subtotal: string;
    deliveryFee: string;
    discount: string;
    grandTotal: string;
    proceedCheckout: string;
    couponPlaceholder: string;
    applyCoupon: string;
    remove: string;
    checkoutTitle: string;
    customerName: string;
    customerPhone: string;
    customerEmailOptional: string;
    karachiArea: string;
    fullAddress: string;
    deliveryNotes: string;
    placeCodOrder: string;
    placingOrder: string;
    orderConfirmedTitle: string;
    orderNumberLabel: string;
    printInvoice: string;
    trackTitle: string;
    trackPrompt: string;
    orderIdInput: string;
    phoneInput: string;
    trackButton: string;
    aiTitle: string;
    aiPlaceholder: string;
    aiSend: string;
    aiThinking: string;
    statusLabels: Record<OrderStatus, string>;
    footerTagline: string;
  }
> = {
  en: {
    brandName: 'Fresh Mart',
    karachiBadge: 'Karachi Delivery · Cash on Delivery · 03233469424',
    navShop: 'Shop',
    navCategories: 'Categories',
    navTrack: 'Track Order',
    navAI: 'Fresh Mart AI',
    navAdmin: 'Admin',
    navAccount: 'Account',
    cart: 'Cart',
    heroHeadline: 'Daily Karachi groceries delivered fresh to your doorstep.',
    heroSubhead:
      'Hand-selected Sindhri mangoes, farm dairy, aged Super Kernel Basmati, and everyday pantry staples across Karachi with straightforward Cash on Delivery.',
    heroShopBtn: 'Browse Groceries',
    heroAiBtn: 'Ask Fresh Mart AI',
    deliveryCityLabel: 'Delivery City',
    deliveryCityValue: 'Karachi, Pakistan',
    fixedFeeLabel: 'Fixed Karachi Fee',
    pendingSetup: 'Pending admin setup',
    paymentLabel: 'Payment Method',
    paymentCodOnly: 'Cash on Delivery (COD)',
    supportLabel: 'WhatsApp & Call',
    allCategories: 'All Groceries',
    searchPlaceholder: 'Search mangoes, Basmati rice, milk, tea...',
    sortFeatured: 'Featured First',
    sortPriceAsc: 'Price: Low to High',
    sortPriceDesc: 'Price: High to Low',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    addToCart: 'Add to Cart',
    viewDetails: 'Details',
    emptyCatalog: 'No matching groceries found. Try clearing your search or switching category.',
    cartTitle: 'Your Grocery Bag',
    cartEmpty: 'Your bag is empty. Add fresh produce or pantry staples to get started.',
    subtotal: 'Product Subtotal',
    deliveryFee: 'Fixed Karachi Delivery',
    discount: 'Coupon Discount',
    grandTotal: 'Grand Total (COD)',
    proceedCheckout: 'Proceed to COD Checkout',
    couponPlaceholder: 'Coupon code (e.g. KARACHI100)',
    applyCoupon: 'Apply',
    remove: 'Remove',
    checkoutTitle: 'Cash on Delivery Checkout',
    customerName: 'Full Name',
    customerPhone: 'Mobile Number (03XXXXXXXXX)',
    customerEmailOptional: 'Email Address (Optional)',
    karachiArea: 'Karachi Neighborhood',
    fullAddress: 'Complete House / Street Address',
    deliveryNotes: 'Delivery Instructions (Optional)',
    placeCodOrder: 'Confirm Cash on Delivery Order',
    placingOrder: 'Confirming Order...',
    orderConfirmedTitle: 'Order Confirmed',
    orderNumberLabel: 'Order Number',
    printInvoice: 'Print Invoice',
    trackTitle: 'Track Your Karachi Order',
    trackPrompt: 'Enter your Fresh Mart Order Number and mobile number used at checkout.',
    orderIdInput: 'Order Number (e.g. FM-20261117-1001)',
    phoneInput: 'Mobile Number (03XXXXXXXXX)',
    trackButton: 'Track Order',
    aiTitle: 'Fresh Mart AI Assistant',
    aiPlaceholder: 'Ask in English or Urdu (e.g., Make a Rs. 3,000 grocery list)...',
    aiSend: 'Send',
    aiThinking: 'Checking live Fresh Mart inventory...',
    statusLabels: {
      pending: 'Pending Confirmation',
      confirmed: 'Confirmed',
      preparing: 'Preparing Groceries',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
    },
    footerTagline: 'Fresh Mart Karachi — Reliable daily groceries with Cash on Delivery.',
  },
  ur: {
    brandName: 'فریش مارٹ',
    karachiBadge: 'کراچی ڈیلیوری · کیش آن ڈیلیوری · 03233469424',
    navShop: 'خریداری',
    navCategories: 'اقسام',
    navTrack: 'آرڈر ٹریکنگ',
    navAI: 'فریش مارٹ اے آئی',
    navAdmin: 'ایڈمن',
    navAccount: 'اکاؤنٹ',
    cart: 'ٹوکری',
    heroHeadline: 'کراچی میں روزمرہ کی تازہ گروسری سیدھے آپ کے گھر تک۔',
    heroSubhead:
      'تازہ سندھڑی آم، فارم کا خالص دودھ، پرانا باسمتی چاول اور باورچی خانے کی ضروری اشیاء آسان کیش آن ڈیلیوری کے ساتھ۔',
    heroShopBtn: 'اشیاء دیکھیں',
    heroAiBtn: 'فریش مارٹ اے آئی سے پوچھیں',
    deliveryCityLabel: 'ڈیلیوری کا شہر',
    deliveryCityValue: 'کراچی، پاکستان',
    fixedFeeLabel: 'فکسڈ ڈیلیوری چارجز',
    pendingSetup: 'ایڈمن کی سیٹنگ باقی ہے',
    paymentLabel: 'ادائیگی کا طریقہ',
    paymentCodOnly: 'کیش آن ڈیلیوری (COD)',
    supportLabel: 'واٹس ایپ اور ہیلپ لائن',
    allCategories: 'تمام گروسری',
    searchPlaceholder: 'آم، باسمتی چاول، دودھ، چائے تلاش کریں...',
    sortFeatured: 'نمایاں اشیاء',
    sortPriceAsc: 'کم سے زیادہ قیمت',
    sortPriceDesc: 'زیادہ سے کم قیمت',
    inStock: 'دستیاب ہے',
    lowStock: 'کم اسٹاک',
    outOfStock: 'اسٹاک ختم',
    addToCart: 'ٹوکری میں شامل کریں',
    viewDetails: 'تفصیلات',
    emptyCatalog: 'کوئی شے نہیں ملی۔ براہ کرم تلاش تبدیل کریں۔',
    cartTitle: 'آپ کی شاپنگ ٹوکری',
    cartEmpty: 'آپ کی ٹوکری خالی ہے۔ خریداری شروع کرنے کے لیے اشیاء شامل کریں۔',
    subtotal: 'اشیاء کا کل',
    deliveryFee: 'فکسڈ کراچی ڈیلیوری',
    discount: 'کوپن رعایت',
    grandTotal: 'کل رقم (کیش آن ڈیلیوری)',
    proceedCheckout: 'کیش آن ڈیلیوری چیک آؤٹ',
    couponPlaceholder: 'کوپن کوڈ درج کریں',
    applyCoupon: 'لاگو کریں',
    remove: 'ہٹائیں',
    checkoutTitle: 'کیش آن ڈیلیوری چیک آؤٹ',
    customerName: 'پورا نام',
    customerPhone: 'موبائل نمبر (03XXXXXXXXX)',
    customerEmailOptional: 'ای میل (اختیاری)',
    karachiArea: 'کراچی کا علاقہ',
    fullAddress: 'مکمل گھر / گلی کا پتہ',
    deliveryNotes: 'ڈیلیوری ہدایات (اختیاری)',
    placeCodOrder: 'کیش آن ڈیلیوری آرڈر کنفرم کریں',
    placingOrder: 'آرڈر محفوظ ہو رہا ہے...',
    orderConfirmedTitle: 'آرڈر موصول ہو گیا',
    orderNumberLabel: 'آرڈر نمبر',
    printInvoice: 'انوائس پرنٹ کریں',
    trackTitle: 'اپنا کراچی آرڈر ٹریک کریں',
    trackPrompt: 'اپنا فریش مارٹ آرڈر نمبر اور موبائل نمبر درج کریں۔',
    orderIdInput: 'آرڈر نمبر (مثلاً FM-20261117-1001)',
    phoneInput: 'موبائل نمبر (03XXXXXXXXX)',
    trackButton: 'آرڈر چیک کریں',
    aiTitle: 'فریش مارٹ اے آئی اسسٹنٹ',
    aiPlaceholder: 'اردو یا انگریزی میں پوچھیں (مثلاً 3000 روپے کی گروسری لسٹ بنائیں)...',
    aiSend: 'بھیجیں',
    aiThinking: 'لائیو اسٹاک چیک کیا جا رہا ہے...',
    statusLabels: {
      pending: 'تصدیق کا منتظر',
      confirmed: 'تصدیق شدہ',
      preparing: 'تیاری جاری ہے',
      out_for_delivery: 'ڈیلیوری کے لیے روانہ',
      delivered: 'پہنچا دیا گیا',
      cancelled: 'منسوخ شدہ',
    },
    footerTagline: 'فریش مارٹ کراچی — کیش آن ڈیلیوری کے ساتھ قابل اعتماد گروسری۔',
  },
};

export function formatPkr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `Rs. ${amount.toLocaleString('en-PK')}`;
}
