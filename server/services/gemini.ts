import {
  type Content,
  type FunctionDeclaration,
  GoogleGenAI,
  ThinkingLevel,
  Type,
} from '@google/genai';
import { db } from '../db/repository.ts';
import type { Product } from '../types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const searchProductsTool: FunctionDeclaration = {
  name: 'search_products',
  description:
    'Search Fresh Mart live grocery catalog by keyword or category. Always call this before stating prices, units, or availability.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Product name, Urdu/English keyword, or grocery type (e.g., rice, mango, milk, tea, oil).',
      },
    },
    required: ['query'],
  },
};

const getAllCatalogTool: FunctionDeclaration = {
  name: 'list_catalog_and_categories',
  description:
    'Retrieve all active Fresh Mart grocery products and categories with exact PKR prices and stock counts.',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getDeliveryInfoTool: FunctionDeclaration = {
  name: 'get_delivery_info',
  description:
    'Retrieve live Karachi delivery settings configured by Fresh Mart admin (fixed delivery fee in PKR, minimum order, free delivery threshold, active Karachi areas, and delivery instructions).',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const trackOrderTool: FunctionDeclaration = {
  name: 'track_order',
  description:
    'Check the live status of a Fresh Mart order using BOTH the order number (e.g. FM-20261117-1001) and the customer mobile number.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      orderNumber: {
        type: Type.STRING,
        description: 'Order ID like FM-20261117-1001',
      },
      phone: {
        type: Type.STRING,
        description: 'Customer mobile number used at checkout (e.g. 03001234567)',
      },
    },
    required: ['orderNumber', 'phone'],
  },
};

export interface AiChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiChatResponse {
  reply: string;
  suggestedProducts: Array<{
    id: string;
    name_en: string;
    name_ur: string;
    unit_label: string;
    price_pkr: number;
    stock: number;
    image_url: string;
  }>;
}

export async function runFreshMartAI(params: {
  message: string;
  history: AiChatMessage[];
  language: 'en' | 'ur';
}): Promise<AiChatResponse> {
  const store = await db.getStoreSettings();
  if (!store.ai_enabled) {
    throw new Error('Fresh Mart AI is currently disabled by store administration.');
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }

  const mentionedProducts = new Map<string, Product>();

  const systemInstruction = [
    `You are "Fresh Mart AI", the official bilingual (English & Urdu) shopping assistant for Fresh Mart, an online grocery store in Karachi, Pakistan.`,
    `Store phone / WhatsApp: ${store.phone} (03233469424). Currency: PKR (Rs.). Payment method: Cash on Delivery (COD) only.`,
    `Preferred UI language is ${params.language === 'ur' ? 'Urdu (اردو)' : 'English'}, though if the user writes in Urdu or Roman Urdu or English, respond naturally in the user's language.`,
    `CRITICAL GROUNDING RULES:`,
    `1. NEVER invent or guess product prices, stock quantities, product names, delivery charges, or order statuses.`,
    `2. ALWAYS call the provided tools (search_products, list_catalog_and_categories, get_delivery_info, track_order) to fetch real database values before answering.`,
    `3. If a product is out of stock (stock === 0) or unavailable, tell the user honestly and suggest in-stock alternatives from the catalog.`,
    `4. When creating budget-based shopping lists, calculate exact PKR totals using real unit prices from the catalog and stay within the user's requested budget.`,
    `5. If delivery_settings.fixed_fee_pkr is null, state clearly that the Karachi delivery fee is currently pending store admin configuration—never invent a delivery fee.`,
    `6. For order tracking, require both order number and customer phone number.`,
    `7. Keep replies concise, helpful, and formatted cleanly without markdown clutter.`,
  ].join('\n');

  const contents: Content[] = [
    ...params.history.slice(-10).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })),
    { role: 'user', parts: [{ text: params.message }] },
  ];

  const tools = [
    {
      functionDeclarations: [
        searchProductsTool,
        getAllCatalogTool,
        getDeliveryInfoTool,
        trackOrderTool,
      ],
    },
  ];

  async function callGeminiWithRetry() {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await ai!.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            tools,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      } catch (err) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE');
        if (!isTransient || attempt === 2) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 700 * Math.pow(2, attempt)));
      }
    }
    throw lastErr;
  }

  let response;
  try {
    response = await callGeminiWithRetry();

    // Up to 4 tool-execution rounds
    for (let round = 0; round < 4; round++) {
      const calls = response.functionCalls;
      if (!calls || calls.length === 0) break;

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) {
        contents.push(modelContent);
      }

      const functionResponses: Array<{
        functionResponse: { id?: string; name: string; response: Record<string, unknown> };
      }> = [];

      for (const call of calls) {
        const name = call.name || '';
        const args = (call.args || {}) as Record<string, unknown>;

        if (name === 'search_products') {
          const q = String(args.query || '');
          const matches = await db.listProducts({ includeInactive: false, search: q });
          for (const p of matches.slice(0, 6)) mentionedProducts.set(p.id, p);
          functionResponses.push({
            functionResponse: {
              id: call.id,
              name,
              response: {
                query: q,
                count: matches.length,
                products: matches.map((p) => ({
                  id: p.id,
                  name_en: p.name_en,
                  name_ur: p.name_ur,
                  unit: p.unit_label,
                  price_pkr: p.price_pkr,
                  stock: p.stock,
                  in_stock: p.stock > 0,
                })),
              },
            },
          });
        } else if (name === 'list_catalog_and_categories') {
          const [cats, prods] = await Promise.all([
            db.listCategories(false),
            db.listProducts({ includeInactive: false }),
          ]);
          for (const p of prods.slice(0, 6)) mentionedProducts.set(p.id, p);
          functionResponses.push({
            functionResponse: {
              id: call.id,
              name,
              response: {
                categories: cats.map((c) => ({
                  slug: c.slug,
                  name_en: c.name_en,
                  name_ur: c.name_ur,
                })),
                products: prods.map((p) => ({
                  id: p.id,
                  category_id: p.category_id,
                  name_en: p.name_en,
                  name_ur: p.name_ur,
                  unit: p.unit_label,
                  price_pkr: p.price_pkr,
                  stock: p.stock,
                  in_stock: p.stock > 0,
                })),
              },
            },
          });
        } else if (name === 'get_delivery_info') {
          const del = await db.getDeliverySettings();
          functionResponses.push({
            functionResponse: {
              id: call.id,
              name,
              response: {
                city: del.city,
                fixed_fee_pkr: del.fixed_fee_pkr,
                fee_configured: del.fixed_fee_pkr !== null,
                min_order_pkr: del.min_order_pkr,
                free_delivery_threshold_pkr: del.free_delivery_threshold_pkr,
                is_available: del.is_available,
                active_areas: del.active_areas,
                instructions_en: del.instructions_en,
                instructions_ur: del.instructions_ur,
                payment_method: 'Cash on Delivery (COD) only',
              },
            },
          });
        } else if (name === 'track_order') {
          const orderNumber = String(args.orderNumber || '');
          const phone = String(args.phone || '');
          const order = await db.trackOrder(orderNumber, phone);
          functionResponses.push({
            functionResponse: {
              id: call.id,
              name,
              response: order
                ? {
                    found: true,
                    order_number: order.order_number,
                    status: order.status,
                    subtotal_pkr: order.subtotal_pkr,
                    delivery_fee_pkr: order.delivery_fee_pkr,
                    discount_pkr: order.discount_pkr,
                    grand_total_pkr: order.grand_total_pkr,
                    delivery_area: order.delivery_area,
                    created_at: order.created_at,
                  }
                : {
                    found: false,
                    message:
                      'No matching order found for that order number and phone number.',
                  },
            },
          });
        }
      }

      contents.push({ role: 'user', parts: functionResponses });
      response = await callGeminiWithRetry();
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('503') || raw.includes('UNAVAILABLE')) {
      throw new Error(
        params.language === 'ur'
          ? 'فریش مارٹ اے آئی اس وقت زیادہ مصروف ہے۔ براہ کرم چند لمحوں بعد دوبارہ کوشش کریں۔'
          : 'Fresh Mart AI is temporarily busy due to high Gemini API demand. Please retry in a few seconds.'
      );
    }
    throw new Error(
      params.language === 'ur'
        ? 'اے آئی سروس سے رابطہ نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔'
        : `Fresh Mart AI encountered an upstream error: ${raw}`
    );
  }

  const replyText =
    response.text?.trim() ||
    (params.language === 'ur'
      ? 'معذرت، میں اس وقت جواب تیار نہیں کر سکا۔ براہ کرم دوبارہ کوشش کریں۔'
      : 'Sorry, I could not generate a response right now. Please try again.');

  // Filter suggested products to ones actually mentioned or in-stock relevant items
  const replyLower = replyText.toLowerCase();
  const matchedMentioned = Array.from(mentionedProducts.values()).filter(
    (p) =>
      p.stock > 0 &&
      (replyLower.includes(p.name_en.toLowerCase().split(' ')[0]) ||
        replyText.includes(p.name_ur))
  );

  return {
    reply: replyText,
    suggestedProducts: (matchedMentioned.length > 0
      ? matchedMentioned
      : Array.from(mentionedProducts.values()).filter((p) => p.stock > 0)
    )
      .slice(0, 4)
      .map((p) => ({
        id: p.id,
        name_en: p.name_en,
        name_ur: p.name_ur,
        unit_label: p.unit_label,
        price_pkr: p.price_pkr,
        stock: p.stock,
        image_url: p.image_url,
      })),
  };
}
