import crypto from 'crypto';
import { db } from '../db/repository.ts';
import type { Order, OrderStatus, WhatsAppLog } from '../types.ts';
import { toWhatsAppE164 } from './auth.ts';

const GRAPH_VERSION = 'v21.0';

export function getWhatsAppConfigStatus() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || '';
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() || '';

  const hasAccessToken =
    Boolean(accessToken) && !accessToken.includes('your-meta-whatsapp');
  const hasPhoneNumberId =
    Boolean(phoneNumberId) && !phoneNumberId.includes('your-whatsapp');
  const hasBusinessAccountId =
    Boolean(businessAccountId) && !businessAccountId.includes('your-whatsapp');
  const hasVerifyToken = Boolean(verifyToken);

  return {
    configured: hasAccessToken && hasPhoneNumberId,
    hasAccessToken,
    hasPhoneNumberId,
    hasBusinessAccountId,
    hasVerifyToken,
    storePhone: process.env.STORE_OWNER_PHONE || '03233469424',
  };
}

interface SendResult {
  sent: boolean;
  status: WhatsAppLog['status'];
  metaMessageId: string | null;
  errorMessage: string | null;
  logId: string;
}

async function sendMetaGraphMessage(payload: Record<string, unknown>): Promise<{
  ok: boolean;
  metaMessageId: string | null;
  errorMessage: string | null;
}> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneId || token.includes('your-meta-whatsapp') || phoneId.includes('your-whatsapp')) {
    return {
      ok: false,
      metaMessageId: null,
      errorMessage: 'WhatsApp Business Cloud API credentials are not configured on the server.',
    };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;
  let lastError = 'Unknown WhatsApp API error';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
        error?: { message?: string; code?: number };
      };

      if (response.ok && data.messages?.[0]?.id) {
        return {
          ok: true,
          metaMessageId: data.messages[0].id,
          errorMessage: null,
        };
      }

      lastError = data.error?.message || `HTTP ${response.status} from Meta Graph API`;
      // Do not retry 4xx client/template/auth errors
      if (response.status >= 400 && response.status < 500) {
        break;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error reaching Meta Graph API';
    }

    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }

  return { ok: false, metaMessageId: null, errorMessage: lastError };
}

export async function dispatchWhatsAppText(params: {
  orderId: string | null;
  recipientPhone: string;
  templateName: string;
  messageBody: string;
  useApprovedTemplate?: {
    name: string;
    languageCode: string;
    components?: unknown[];
  };
}): Promise<SendResult> {
  const config = getWhatsAppConfigStatus();
  const to = toWhatsAppE164(params.recipientPhone);

  const payload: Record<string, unknown> = params.useApprovedTemplate
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: params.useApprovedTemplate.name,
          language: { code: params.useApprovedTemplate.languageCode },
          ...(params.useApprovedTemplate.components
            ? { components: params.useApprovedTemplate.components }
            : {}),
        },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: params.messageBody },
      };

  if (!config.configured) {
    const log = await db.createWhatsAppLog({
      order_id: params.orderId,
      recipient_phone: params.recipientPhone,
      direction: 'outbound',
      template_name: params.templateName,
      message_body: params.messageBody,
      meta_message_id: null,
      status: 'skipped_unconfigured',
      error_message:
        'WhatsApp Cloud API credentials (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) not configured.',
      retry_count: 0,
      payload_json: payload,
    });
    return {
      sent: false,
      status: 'skipped_unconfigured',
      metaMessageId: null,
      errorMessage: log.error_message,
      logId: log.id,
    };
  }

  const result = await sendMetaGraphMessage(payload);
  const status: WhatsAppLog['status'] = result.ok ? 'sent' : 'failed';

  const log = await db.createWhatsAppLog({
    order_id: params.orderId,
    recipient_phone: params.recipientPhone,
    direction: 'outbound',
    template_name: params.templateName,
    message_body: params.messageBody,
    meta_message_id: result.metaMessageId,
    status,
    error_message: result.errorMessage,
    retry_count: result.ok ? 0 : 2,
    payload_json: payload,
  });

  return {
    sent: result.ok,
    status,
    metaMessageId: result.metaMessageId,
    errorMessage: result.errorMessage,
    logId: log.id,
  };
}

export async function retryWhatsAppLog(logId: string): Promise<WhatsAppLog> {
  const logs = await db.listWhatsAppLogs();
  const target = logs.find((l) => l.id === logId);
  if (!target) {
    throw new Error('WhatsApp log entry not found');
  }
  const config = getWhatsAppConfigStatus();
  if (!config.configured) {
    throw new Error('Cannot retry: WhatsApp Business Cloud API credentials are not configured.');
  }

  const result = await sendMetaGraphMessage(target.payload_json);
  const updated = await db.updateWhatsAppLog(target.id, {
    status: result.ok ? 'sent' : 'failed',
    meta_message_id: result.metaMessageId ?? target.meta_message_id,
    error_message: result.errorMessage,
    retry_count: target.retry_count + 1,
  });
  if (!updated) throw new Error('Failed to update WhatsApp log');
  return updated;
}

export async function notifyOrderPlaced(order: Order): Promise<{
  customer: SendResult;
  owner: SendResult;
}> {
  const store = await db.getStoreSettings();
  const ownerPhone = store.whatsapp_phone || '03233469424';
  const itemLines = (order.items ?? [])
    .map((i) => `- ${i.product_name_en} (${i.unit_label}) x${i.quantity} = Rs. ${i.line_total_pkr}`)
    .join('\n');

  const customerBody = [
    `Fresh Mart – Order Received (${order.order_number})`,
    `Assalam-o-Alaikum ${order.customer_name}, thank you for shopping with Fresh Mart Karachi!`,
    ``,
    `Items:`,
    itemLines,
    ``,
    `Subtotal: Rs. ${order.subtotal_pkr}`,
    `Delivery (Karachi): Rs. ${order.delivery_fee_pkr}`,
    order.discount_pkr > 0 ? `Discount: -Rs. ${order.discount_pkr}` : null,
    `Grand Total (Cash on Delivery): Rs. ${order.grand_total_pkr}`,
    `Address: ${order.delivery_area}, ${order.delivery_address}`,
    ``,
    `For help, call or WhatsApp Fresh Mart at 03233469424.`,
  ]
    .filter((line) => line !== null)
    .join('\n');

  const ownerBody = [
    `NEW COD ORDER: ${order.order_number}`,
    `Customer: ${order.customer_name} (${order.customer_phone})`,
    `Area: ${order.delivery_area}`,
    `Address: ${order.delivery_address}`,
    `Grand Total: Rs. ${order.grand_total_pkr} (COD)`,
    `Items:\n${itemLines}`,
  ].join('\n');

  const [customer, owner] = await Promise.all([
    dispatchWhatsAppText({
      orderId: order.id,
      recipientPhone: order.customer_phone,
      templateName: 'freshmart_order_placed_customer',
      messageBody: customerBody,
    }),
    dispatchWhatsAppText({
      orderId: order.id,
      recipientPhone: ownerPhone,
      templateName: 'freshmart_order_placed_owner',
      messageBody: ownerBody,
    }),
  ]);

  return { customer, owner };
}

const STATUS_TEMPLATES: Record<
  OrderStatus,
  { template: string; message: (order: Order) => string }
> = {
  pending: {
    template: 'freshmart_order_pending',
    message: (o) =>
      `Fresh Mart Update: Your order ${o.order_number} (Rs. ${o.grand_total_pkr} COD) is pending confirmation. Support: 03233469424.`,
  },
  confirmed: {
    template: 'freshmart_order_confirmed',
    message: (o) =>
      `Fresh Mart: Your order ${o.order_number} has been CONFIRMED! Total Cash on Delivery: Rs. ${o.grand_total_pkr}. Helpline: 03233469424.`,
  },
  preparing: {
    template: 'freshmart_order_preparing',
    message: (o) =>
      `Fresh Mart: We are hand-packing your fresh groceries for order ${o.order_number} in Karachi. Helpline: 03233469424.`,
  },
  out_for_delivery: {
    template: 'freshmart_order_out_for_delivery',
    message: (o) =>
      `Fresh Mart: Your order ${o.order_number} is OUT FOR DELIVERY to ${o.delivery_area}! Please keep Rs. ${o.grand_total_pkr} ready for Cash on Delivery. Rider support: 03233469424.`,
  },
  delivered: {
    template: 'freshmart_order_delivered',
    message: (o) =>
      `Fresh Mart: Order ${o.order_number} has been DELIVERED. Thank you for choosing Fresh Mart Karachi! Contact us anytime on 03233469424.`,
  },
  cancelled: {
    template: 'freshmart_order_cancelled',
    message: (o) =>
      `Fresh Mart: Your order ${o.order_number} has been CANCELLED. If this was unexpected, please WhatsApp or call 03233469424.`,
  },
};

export async function notifyOrderStatusChange(order: Order): Promise<SendResult> {
  const spec = STATUS_TEMPLATES[order.status];
  return dispatchWhatsAppText({
    orderId: order.id,
    recipientPhone: order.customer_phone,
    templateName: spec.template,
    messageBody: spec.message(order),
  });
}

export function verifyWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret || appSecret.includes('your-meta-app-secret')) {
    return true;
  }
  if (!rawBody || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function processIncomingWebhook(body: unknown): Promise<void> {
  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{
            id?: string;
            status?: string;
            errors?: Array<{ message?: string; title?: string }>;
          }>;
          messages?: Array<{
            id?: string;
            from?: string;
            text?: { body?: string };
            type?: string;
          }>;
        };
      }>;
    }>;
  };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      for (const st of value.statuses ?? []) {
        if (!st.id || !st.status) continue;
        const mapped =
          st.status === 'sent' || st.status === 'delivered' || st.status === 'read' || st.status === 'failed'
            ? st.status
            : null;
        if (mapped) {
          const errMsg = st.errors?.[0]?.message || st.errors?.[0]?.title || null;
          await db.updateWhatsAppLogByMetaId(st.id, mapped, errMsg);
        }
      }

      for (const msg of value.messages ?? []) {
        if (!msg.from) continue;
        await db.createWhatsAppLog({
          order_id: null,
          recipient_phone: msg.from,
          direction: 'inbound',
          template_name: 'customer_inbound',
          message_body: msg.text?.body || `[${msg.type || 'message'}]`,
          meta_message_id: msg.id ?? null,
          status: 'received',
          error_message: null,
          retry_count: 0,
          payload_json: msg as unknown as Record<string, unknown>,
        });
      }
    }
  }
}
