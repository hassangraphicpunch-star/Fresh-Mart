-- Fresh Mart – Seed Data (Karachi Grocery Catalog)
-- Note: delivery_settings.fixed_fee_pkr is intentionally NOT invented here;
-- store admin configures the fixed Karachi delivery charge via Admin Dashboard.

INSERT INTO public.categories (slug, name_en, name_ur, description_en, description_ur, image_url, sort_order, is_active)
VALUES
  ('fruits-vegetables', 'Fruits & Vegetables', 'پھل اور سبزیاں', 'Farm-fresh seasonal Sindhri mangoes, leafy greens, and daily Karachi sabzi.', 'تازہ موسمی آم، ہری سبزیاں اور روزمرہ کی ترکاریاں۔', '/src/assets/images/cat_fruits_veg_1794944192060.jpg', 1, true),
  ('dairy-bakery', 'Dairy & Bakery', 'ڈیری اور بیکری', 'Pure farm milk, fresh dahi, cultured butter, and stone-baked bread.', 'خالص فارم کا دودھ، تازہ دہی، مکھن اور بیکری بریڈ۔', '/src/assets/images/cat_dairy_bakery_1794944191735.jpg', 2, true),
  ('rice-oil-pantry', 'Rice, Oil & Spices', 'چاول، تیل اور مصالحے', 'Aged Super Kernel Basmati, cooking oil, lentils, and whole spices.', 'پرانا باسمتی چاول، کوکنگ آئل، دالیں اور ثابت مصالحے۔', '/src/assets/images/cat_pantry_spices_1794944192514.jpg', 3, true),
  ('tea-beverages', 'Tea, Honey & Dry Fruits', 'چائے، شہد اور خشک میوہ جات', 'Premium Pakistani loose-leaf tea, pure honey, mango nectar, and almonds.', 'پاکستانی پتی چائے، خالص شہد، آم کا رس اور بادام۔', '/src/assets/images/cat_beverages_snacks_1794944192972.jpg', 4, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert realistic Fresh Mart Karachi products
WITH cats AS (
  SELECT id, slug FROM public.categories
)
INSERT INTO public.products (category_id, sku, slug, name_en, name_ur, description_en, description_ur, unit_label, price_pkr, compare_at_price_pkr, stock, low_stock_threshold, image_url, is_featured, is_active)
SELECT
  cats.id,
  v.sku,
  v.slug,
  v.name_en,
  v.name_ur,
  v.description_en,
  v.description_ur,
  v.unit_label,
  v.price_pkr,
  v.compare_at_price_pkr,
  v.stock,
  v.low_stock_threshold,
  v.image_url,
  v.is_featured,
  true
FROM (VALUES
  ('fruits-vegetables', 'FM-VEG-001', 'sindhri-mangoes-2kg', 'Sindhri Mangoes (Grade A)', 'سندھڑی آم (درجہ اول)', 'Sweet, aromatic Mirpurkhas Sindhri mangoes hand-selected daily.', 'میرپورخاص کے میٹھے اور خوشبودار تازہ سندھڑی آم۔', '2 kg', 780, 880, 45, 10, '/src/assets/images/hero_fresh_produce_1794944191373.jpg', true),
  ('fruits-vegetables', 'FM-VEG-002', 'vine-tomatoes-1kg', 'Farm Vine Tomatoes', 'تازہ ٹماٹر', 'Firm, juicy red tomatoes ideal for karahi, salan, and salads.', 'کڑاہی، سالن اور سلاد کے لیے تازہ سرخ ٹماٹر۔', '1 kg', 180, NULL, 90, 15, '/src/assets/images/cat_fruits_veg_1794944192060.jpg', true),
  ('fruits-vegetables', 'FM-VEG-003', 'red-onions-2kg', 'Sindh Red Onions', 'سرخ پیاز', 'Crisp, pungent red onions sourced directly from Sindh farms.', 'سندھ کے کھیتوں سے تازہ اور معیاری سرخ پیاز۔', '2 kg', 260, 300, 110, 20, '/src/assets/images/cat_fruits_veg_1794944192060.jpg', false),
  ('fruits-vegetables', 'FM-VEG-004', 'fresh-coriander-mint-bundle', 'Fresh Coriander & Mint Bundle', 'تازہ دھنیا اور پودینہ', 'Washed garden-fresh dhania and podina bunches for daily cooking.', 'روزمرہ کھانوں کے لیے تازہ ہرا دھنیا اور پودینہ۔', '2 bunches', 90, NULL, 75, 15, '/src/assets/images/cat_fruits_veg_1794944192060.jpg', false),
  ('dairy-bakery', 'FM-DAI-001', 'fresh-farm-milk-1l', 'Pure Chilled Farm Milk', 'خالص فارم کا تازہ دودھ', 'Unadulterated chilled whole milk in sealed glass-grade bottles.', 'خالص اور ٹھنڈا فارم کا دودھ، روزانہ کی تازہ سپلائی۔', '1 Litre', 240, NULL, 60, 12, '/src/assets/images/cat_dairy_bakery_1794944191735.jpg', true),
  ('dairy-bakery', 'FM-DAI-002', 'creamy-set-yogurt-500g', 'Traditional Clay-Set Yogurt', 'تازہ ملائی والا دہی', 'Thick, naturally fermented yogurt with rich malai.', 'گاڑھا اور تازہ ملائی والا روایتی دہی۔', '500 g', 190, NULL, 40, 10, '/src/assets/images/cat_dairy_bakery_1794944191735.jpg', false),
  ('dairy-bakery', 'FM-DAI-003', 'cultured-farm-butter-250g', 'Cultured Salted Butter', 'خالص مکھن', 'Rich golden farm butter churned in small batches.', 'خالص دودھ سے تیار کردہ لذیذ سنہری مکھن۔', '250 g', 560, 620, 28, 8, '/src/assets/images/cat_dairy_bakery_1794944191735.jpg', true),
  ('dairy-bakery', 'FM-DAI-004', 'whole-wheat-sourdough-loaf', 'Artisanal Whole-Wheat Loaf', 'تازہ گندم کی روٹی / ڈبل روٹی', 'Stone-baked whole-grain loaf with crisp crust and soft crumb.', 'تازہ گندم سے بنی نرم اور خستہ بیکری بریڈ۔', '450 g', 320, NULL, 24, 6, '/src/assets/images/cat_dairy_bakery_1794944191735.jpg', false),
  ('rice-oil-pantry', 'FM-PAN-001', 'super-kernel-basmati-5kg', 'Aged Super Kernel Basmati Rice', 'سپر کرنل باسمتی چاول', '2-year aged extra-long grain Punjab Basmati rice for biryani & pulao.', 'بریانی اور پلاؤ کے لیے دو سال پرانا لمبے دانے والا باسمتی چاول۔', '5 kg', 1850, 2050, 50, 10, '/src/assets/images/cat_pantry_spices_1794944192514.jpg', true),
  ('rice-oil-pantry', 'FM-PAN-002', 'cold-pressed-cooking-oil-1l', 'Refined Sunflower Cooking Oil', 'خالص کوکنگ آئل', 'Light, cholesterol-free cooking oil for everyday Pakistani kitchens.', 'روزمرہ کھانوں کے لیے ہلکا اور خالص کوکنگ آئل۔', '1 Litre', 540, 580, 80, 15, '/src/assets/images/cat_pantry_spices_1794944192514.jpg', true),
  ('rice-oil-pantry', 'FM-PAN-003', 'masoor-lentils-1kg', 'Washed Red Lentils (Masoor)', 'دھلی ہوئی مسور دال', 'Triple-cleaned premium masoor dal, quick cooking and protein-rich.', 'صاف ستھری اور جلد گلنے والی اعلیٰ معیار کی مسور دال۔', '1 kg', 390, NULL, 65, 12, '/src/assets/images/cat_pantry_spices_1794944192514.jpg', false),
  ('rice-oil-pantry', 'FM-PAN-004', 'green-cardamom-turmeric-pack', 'Whole Green Cardamom & Haldi Pack', 'سبز الائچی اور خالص ہلدی', 'Aromatic whole elaichi (50g) paired with pure ground haldi (200g).', 'خوشبودار سبز الائچی اور خالص پسی ہوئی ہلدی کا پیک۔', '250 g pack', 640, NULL, 35, 8, '/src/assets/images/cat_pantry_spices_1794944192514.jpg', false),
  ('tea-beverages', 'FM-BEV-001', 'shalimar-loose-leaf-tea-250g', 'Pakistani Loose-Leaf Chai Blend', 'پاکستانی کڑک پتی چائے', 'Strong, brisk Kenyan-blend black tea crafted for doodh patti.', 'دودھ پتی اور کڑک چائے کے لیے بہترین بلیک ٹی۔', '250 g tin', 490, 540, 55, 10, '/src/assets/images/cat_beverages_snacks_1794944192972.jpg', true),
  ('tea-beverages', 'FM-BEV-002', 'wildflower-natural-honey-500g', 'Pure Wildflower Honey', 'خالص جنگلی پھولوں کا شہد', 'Unheated raw honey harvested from northern valleys of Pakistan.', 'پاکستان کی شمالی وادیوں کا خالص اور کچا شہد۔', '500 g jar', 1250, 1400, 22, 5, '/src/assets/images/cat_beverages_snacks_1794944192972.jpg', false),
  ('tea-beverages', 'FM-BEV-003', 'roasted-almonds-250g', 'Pakistani Giri Almonds', 'خالص بادام گری', 'Crunchy sweet almonds ideal for snacking, kheer, and breakfast.', 'میٹھے اور خستہ بادام، ناشتے اور کھیر کے لیے بہترین۔', '250 g', 720, NULL, 30, 8, '/src/assets/images/cat_beverages_snacks_1794944192972.jpg', false),
  ('tea-beverages', 'FM-BEV-004', 'fresh-mango-nectar-1l', '100% Pure Mango Nectar', 'خالص آم کا جوس', 'Chilled cold-pressed Sindhri mango nectar with zero added preservatives.', 'بغیر کسی ملاوٹ کے تازہ سندھڑی آم کا خالص جوس۔', '1 Litre', 420, NULL, 38, 10, '/src/assets/images/cat_beverages_snacks_1794944192972.jpg', false)
) AS v(cat_slug, sku, slug, name_en, name_ur, description_en, description_ur, unit_label, price_pkr, compare_at_price_pkr, stock, low_stock_threshold, image_url, is_featured)
JOIN cats ON cats.slug = v.cat_slug
ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.coupons (code, discount_type, discount_value, min_order_pkr, max_discount_pkr, usage_limit, is_active)
VALUES
  ('KARACHI100', 'fixed', 100, 1500, NULL, 500, true),
  ('FRESH10', 'percent', 10, 2000, 350, 500, true)
ON CONFLICT (code) DO NOTHING;
