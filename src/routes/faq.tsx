import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Lock, Truck, CreditCard, RotateCcw, ShieldCheck, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "Perguntas Frequentes — Secret Desire" }] }),
  component: FAQ,
});

type FAQItem = {
  question: string;
  answer: string;
  icon: typeof Lock;
};

const FAQ_ITEMS: FAQItem[] = [
  {
    icon: Lock,
    question: "Como é a embalagem?",
    answer:
      "Todos os pedidos são enviados em caixa parda sem nenhuma identificação externa. Não há logotipo, nome da loja ou qualquer indicação do conteúdo. A embalagem é totalmente discreta e lacrada.",
  },
  {
    icon: CreditCard,
    question: "O que aparece na fatura do cartão?",
    answer:
      'Na fatura do seu cartão aparecerá "SD Comercio" ou "SD Comércio Digital". Não há menção ao nome da loja ou ao tipo de produto adquirido.',
  },
  {
    icon: ShieldCheck,
    question: "É seguro comprar aqui?",
    answer:
      "Sim! Utilizamos certificado SSL, pagamentos processados por MercadoPago e Stripe (líderes mundiais em segurança de pagamentos), e nunca armazenamos dados do seu cartão em nossos servidores.",
  },
  {
    icon: Truck,
    question: "Como funciona a entrega?",
    answer:
      "Enviamos para todo o Brasil via transportadoras parceiras. O prazo varia de 2 a 8 dias úteis dependendo da região. Frete grátis para compras acima de R$199. Você recebe um código de rastreamento por email assim que o pedido é despachado.",
  },
  {
    icon: RotateCcw,
    question: "Posso devolver um produto?",
    answer:
      "Sim. Você tem até 7 dias após o recebimento para solicitar a devolução (direito de arrependimento conforme CDC). O produto deve estar lacrado e na embalagem original. Produtos abertos/usados não podem ser devolvidos por questões de higiene, exceto em caso de defeito.",
  },
  {
    icon: Lock,
    question: "Meus dados estão protegidos?",
    answer:
      "Absolutamente. Seguimos a LGPD (Lei Geral de Proteção de Dados). Seus dados pessoais são criptografados e nunca compartilhados com terceiros. Você pode solicitar a exclusão dos seus dados a qualquer momento.",
  },
  {
    icon: MessageCircle,
    question: "Como entro em contato com vocês?",
    answer:
      "Você pode nos contatar pelo WhatsApp (botão no canto da tela), por email ou pelo formulário de contato. Respondemos em até 2 horas durante o horário comercial. Todas as comunicações são discretas.",
  },
  {
    icon: CreditCard,
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "Aceitamos PIX (aprovação instantânea), cartão de crédito (Visa, Mastercard, Elo — em até 6x sem juros) e boleto bancário (prazo de 3 dias para compensação).",
  },
  {
    icon: ShieldCheck,
    question: "Preciso criar uma conta para comprar?",
    answer:
      "Não é obrigatório. Você pode finalizar a compra como convidado informando apenas os dados necessários para entrega e pagamento. Criar uma conta permite acompanhar pedidos e acumular pontos de fidelidade.",
  },
  {
    icon: Lock,
    question: "Vocês enviam emails discretos?",
    answer:
      'Sim. Todos os nossos emails têm assuntos genéricos como "Atualização do seu pedido" ou "Seu item está disponível". Nunca mencionamos o tipo de produto no assunto ou preview do email.',
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-4 py-5 text-left transition-colors hover:text-neon"
      >
        <Icon className="h-5 w-5 flex-none text-neon" />
        <span className="flex-1 text-sm font-semibold">{item.question}</span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="pb-5 pl-9 pr-4 animate-in slide-in-from-top-1 duration-150">
          <p className="text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

function FAQ() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl font-bold">Perguntas Frequentes</h1>
        <p className="mt-3 text-muted-foreground">
          Tire suas dúvidas sobre privacidade, entrega e pagamento.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card/50 px-6">
        {FAQ_ITEMS.map((item, i) => (
          <FAQAccordion key={i} item={item} />
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-neon/20 bg-neon/5 p-6 text-center">
        <p className="text-sm font-medium">Ainda tem dúvidas?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fale conosco pelo WhatsApp — atendimento discreto e rápido.
        </p>
      </div>
    </div>
  );
}
