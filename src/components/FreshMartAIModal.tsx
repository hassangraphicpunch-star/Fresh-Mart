import { Loader2, Plus, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatPkr } from '../i18n/translations';

interface SuggestedProduct {
  id: string;
  name_en: string;
  name_ur: string;
  unit_label: string;
  price_pkr: number;
  stock: number;
  image_url: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  suggestedProducts?: SuggestedProduct[];
}

export function FreshMartAIModal() {
  const { language, t, aiOpen, setAiOpen, store, addToCart } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (aiOpen && messages.length === 0) {
      const welcome =
        language === 'ur'
          ? store?.ai_welcome_ur ||
            'السلام علیکم! فریش مارٹ اے آئی میں خوش آمدید۔ آپ گروسری، قیمتوں یا بجٹ لسٹ کے بارے میں پوچھ سکتے ہیں۔'
          : store?.ai_welcome_en ||
            'Assalam-o-Alaikum! Ask Fresh Mart AI about live prices, stock, budget grocery lists, or Karachi delivery.';
      setMessages([{ id: 'welcome', role: 'assistant', text: welcome }]);
    }
  }, [aiOpen, language, store, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  if (!aiOpen) return null;

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({ role: m.role, text: m.text })),
          language,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        suggestedProducts?: SuggestedProduct[];
        error?: string;
      };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Fresh Mart AI could not reply');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
          suggestedProducts: data.suggestedProducts,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Fresh Mart AI');
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts =
    language === 'ur'
      ? [
          '3000 روپے میں ماہانہ گروسری لسٹ بنائیں',
          'کیا تازہ سندھڑی آم اور باسمتی چاول دستیاب ہیں؟',
          'کراچی ڈیلیوری چارجز کیا ہیں؟',
        ]
      : [
          'Build a Rs. 3,000 grocery shopping list',
          'Check price & stock of Basmati rice and Sindhri mangoes',
          'What are the Karachi delivery fees and active areas?',
        ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.aiTitle}
    >
      <div className="bg-white border border-[#E4E6E0] rounded-xl w-full max-w-2xl h-[85vh] max-h-[680px] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-[#E4E6E0] flex items-center justify-between bg-[#FAFAF8]">
          <div>
            <h2 className="font-display text-lg font-bold text-[#141715]">{t.aiTitle}</h2>
            <p className="text-xs text-[#5C665E]">
              {language === 'ur'
                ? 'لائیو فریش مارٹ اسٹاک اور قیمتوں سے منسلک'
                : 'Grounded in live Fresh Mart Karachi inventory & prices'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAiOpen(false)}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-[#E4E6E0]/60 cursor-pointer"
            aria-label="Close Fresh Mart AI"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#0F5132] text-white'
                    : 'bg-[#F3F4F1] text-[#141715] border border-[#E4E6E0]'
                }`}
              >
                {msg.text}
              </div>

              {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-[92%]">
                  {msg.suggestedProducts.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-[#E4E6E0] bg-white"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#141715] truncate">
                          {language === 'ur' ? p.name_ur : p.name_en}
                        </p>
                        <p className="text-xs text-[#5C665E] tabular-nums">
                          {p.unit_label} · {formatPkr(p.price_pkr)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(p.id, 1)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#0F5132] text-white text-xs font-semibold shrink-0 cursor-pointer hover:bg-[#0B3D26]"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#5C665E]">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>{t.aiThinking}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-[#FEE2E2] border border-[#EF4444]/30 text-xs text-[#991B1B]">
              {error}
            </div>
          )}
        </div>

        {/* Quick Prompts */}
        <div className="px-5 py-2 border-t border-[#F0F1EE] bg-[#FAFAF8] flex gap-2 overflow-x-auto">
          {quickPrompts.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => void sendMessage(qp)}
              className="text-xs px-3 py-1.5 rounded-md border border-[#D4D8D0] bg-white hover:border-[#0F5132] text-[#3A433D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="p-4 border-t border-[#E4E6E0] bg-white flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.aiPlaceholder}
            className="flex-1 px-3.5 py-2.5 text-sm border border-[#D4D8D0] rounded-lg focus:outline-none focus:border-[#0F5132] min-h-[44px]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] disabled:bg-[#B8C2BA] text-white text-sm font-semibold cursor-pointer min-h-[44px]"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t.aiSend}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
