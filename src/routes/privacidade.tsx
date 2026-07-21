import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Secret Desire" }] }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <h1 className="font-display text-4xl font-bold">Política de Privacidade e Discrição</h1>
      <p className="mt-3 text-sm text-muted-foreground">Última atualização: Janeiro 2026</p>

      <div className="mt-10 space-y-10 text-sm text-muted-foreground leading-relaxed">
        <Section title="1. Nosso compromisso com sua privacidade">
          <p>
            A Secret Desire entende que a privacidade é fundamental para nossos clientes.
            Todos os processos — da navegação à entrega — foram desenhados para garantir
            o máximo sigilo e discrição.
          </p>
        </Section>

        <Section title="2. Embalagem discreta">
          <ul className="list-disc pl-5 space-y-2">
            <li>Todos os pedidos são enviados em caixa parda sem identificação.</li>
            <li>Não há logotipo, nome da loja ou descrição do conteúdo na embalagem externa.</li>
            <li>O remetente aparece como "SD Comércio Digital" na etiqueta de envio.</li>
            <li>Nenhum material promocional é incluído dentro da embalagem.</li>
          </ul>
        </Section>

        <Section title="3. Fatura do cartão">
          <p>
            Na fatura do cartão de crédito, a cobrança aparecerá como <strong className="text-foreground">"SD Comercio"</strong> ou
            <strong className="text-foreground"> "SD Comércio Digital"</strong>. Não há menção ao nome da loja,
            tipo de produto ou qualquer referência que identifique a natureza da compra.
          </p>
        </Section>

        <Section title="4. Comunicações por email">
          <ul className="list-disc pl-5 space-y-2">
            <li>Assuntos de email são sempre genéricos (ex: "Atualização do seu pedido").</li>
            <li>Nunca mencionamos o tipo de produto no assunto ou preview do email.</li>
            <li>Você pode optar por não receber comunicações de marketing a qualquer momento.</li>
          </ul>
        </Section>

        <Section title="5. Dados pessoais (LGPD)">
          <ul className="list-disc pl-5 space-y-2">
            <li>Coletamos apenas os dados necessários para processar seu pedido.</li>
            <li>Seus dados são criptografados em trânsito (SSL/TLS) e em repouso.</li>
            <li>Nunca compartilhamos seus dados com terceiros para fins de marketing.</li>
            <li>Dados de pagamento são processados diretamente pelos gateways (MercadoPago/Stripe) — não armazenamos dados de cartão.</li>
            <li>Você pode solicitar a exclusão completa dos seus dados a qualquer momento pelo email de contato.</li>
          </ul>
        </Section>

        <Section title="6. Cookies">
          <p>
            Utilizamos cookies essenciais para funcionamento do site (carrinho, sessão, verificação de idade)
            e cookies analíticos para melhorar a experiência. Nenhum cookie identifica o tipo de produto
            que você visualizou.
          </p>
        </Section>

        <Section title="7. Segurança">
          <ul className="list-disc pl-5 space-y-2">
            <li>Certificado SSL em todas as páginas.</li>
            <li>Pagamentos processados por gateways certificados PCI-DSS.</li>
            <li>Autenticação segura com criptografia de senhas.</li>
            <li>Monitoramento contínuo contra acessos não autorizados.</li>
          </ul>
        </Section>

        <Section title="8. Seus direitos">
          <p>
            Conforme a LGPD (Lei 13.709/2018), você tem direito a: acessar seus dados,
            corrigir informações incorretas, solicitar exclusão, revogar consentimento
            e solicitar portabilidade. Para exercer qualquer direito, entre em contato
            pelo nosso canal de atendimento.
          </p>
        </Section>

        <Section title="9. Contato">
          <p>
            Para questões sobre privacidade, entre em contato pelo WhatsApp ou email.
            Respondemos em até 48 horas úteis.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-3">{title}</h2>
      {children}
    </section>
  );
}
