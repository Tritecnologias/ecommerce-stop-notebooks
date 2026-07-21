import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrCode, CreditCard, FileText, Save, Loader2, Truck, FlaskConical, Zap, TriangleAlert, Package2, Eye, EyeOff, Wifi, WifiOff, CheckCircle2, MessageCircle, Bell, Star } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getStoreSettings, updateStoreSettings, getShippingConfig, updateShippingConfig, getTestMode, updateTestMode, getInventorySettings, updateInventorySettings, type InventorySettings } from "@/fns/settings";
import { getLoyaltyConfig, updateLoyaltyConfig, type LoyaltyConfig } from "@/fns/loyalty";
import { getCorreiosSettings, updateCorreiosSettings, testCorreiosConnection, CORREIOS_SERVICES, type CorreiosSettings } from "@/fns/correios";
import { getWhatsAppSettings, updateWhatsAppSettings, testWhatsAppConnection, type WhatsAppSettings } from "@/fns/whatsapp";
import { SHIPPING_RATES } from "@/lib/shipping";
import { formatBRL } from "@/lib/cart";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";
import type { PaymentMethod } from "@/fns/settings";

export const Route = createFileRoute("/admin/configuracoes/")({
  head: () => ({ meta: [{ title: "Configurações — Admin Secret Desire" }] }),
  component: AdminConfig,
});

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; description: string; icon: typeof QrCode }[] = [
  { id: "pix", label: "Pix", description: "QR Code gerado automaticamente. Confirmação instantânea.", icon: QrCode },
  { id: "credit_card", label: "Cartão de crédito", description: "Redireciona para o checkout seguro do gateway.", icon: CreditCard },
  { id: "boleto", label: "Boleto bancário", description: "Vencimento em 3 dias úteis após a emissão.", icon: FileText },
];

function AdminConfig() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => getStoreSettings(),
    enabled: !!user && profile?.role === "admin",
  });

  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>([]);

  // Sincroniza estado local quando os dados chegam
  useEffect(() => {
    if (settings) setEnabledMethods(settings.payment_methods);
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: () => updateStoreSettings({ data: { payment_methods: enabledMethods } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("Configurações salvas!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const toggle = (method: PaymentMethod) => {
    setEnabledMethods((prev) => {
      if (prev.includes(method)) {
        if (prev.length === 1) {
          toast.error("Pelo menos uma forma de pagamento deve estar ativa");
          return prev;
        }
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const isDirty = settings
    ? JSON.stringify([...enabledMethods].sort()) !== JSON.stringify([...settings.payment_methods].sort())
    : false;

  // ── Frete ─────────────────────────────────────────────────────────────────
  const { data: shippingConfig, isLoading: shippingLoading } = useQuery({
    queryKey: ["shipping-config"],
    queryFn: () => getShippingConfig(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 5 * 60 * 1000,
  });

  const [freeFrom, setFreeFrom] = useState<string>("");
  const [rateEdits, setRateEdits] = useState<Record<string, { price: string; days: string }>>({});

  useEffect(() => {
    if (shippingConfig) {
      setFreeFrom(String(shippingConfig.freeFrom));
      setRateEdits(
        Object.fromEntries(
          Object.entries(shippingConfig.rates).map(([state, r]) => [state, { price: String(r.price), days: String(r.days) }])
        )
      );
    }
  }, [shippingConfig]);

  const shippingMut = useMutation({
    mutationFn: () => {
      const parsedFreeFrom = parseFloat(freeFrom);
      if (isNaN(parsedFreeFrom) || parsedFreeFrom < 0) throw new Error("Frete grátis inválido");
      const rates: Record<string, { price: number; days: number }> = {};
      for (const [state, val] of Object.entries(rateEdits)) {
        const price = parseFloat(val.price);
        const days = parseInt(val.days, 10);
        if (isNaN(price) || price < 0 || isNaN(days) || days < 1) throw new Error(`Valores inválidos para ${state}`);
        rates[state] = { price, days };
      }
      return updateShippingConfig({ data: { freeFrom: parsedFreeFrom, rates } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shipping-config"] });
      toast.success("Configurações de frete salvas!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar frete"),
  });

  // ── Modo de Teste ──────────────────────────────────────────────────────────
  const { data: testMode, isLoading: testModeLoading } = useQuery({
    queryKey: ["test-mode"],
    queryFn: () => getTestMode(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 60 * 1000,
  });

  const testModeMut = useMutation({
    mutationFn: (pixEnabled: boolean) => updateTestMode({ data: { pix_enabled: pixEnabled } }),
    onSuccess: (_data, pixEnabled) => {
      qc.invalidateQueries({ queryKey: ["test-mode"] });
      toast.success(pixEnabled ? "Modo de Teste PIX ativado!" : "Modo de Teste PIX desativado.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  // Group states by region
  const regions = Object.entries(SHIPPING_RATES).reduce<Record<string, string[]>>((acc, [state, r]) => {
    if (!acc[r.region]) acc[r.region] = [];
    acc[r.region].push(state);
    return acc;
  }, {});

  // ── Integração Correios ────────────────────────────────────────────────────
  const { data: correiosSettings, isLoading: correiosLoading } = useQuery({
    queryKey: ["correios-settings"],
    queryFn: () => getCorreiosSettings(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 10 * 60 * 1000,
  });

  const [correios, setCorreios] = useState<CorreiosSettings>({
    usuario: "", senha: "", cartaoPostagem: "", contrato: "",
    remetenteNome: "", remetenteCpfCnpj: "", remetenteCep: "",
    remetenteLogradouro: "", remetenteNumero: "", remetenteBairro: "",
    remetenteCidade: "", remetenteUf: "", remetenteEmail: "",
    codigoServico: "03298", pesoGramas: 300,
    comprimentoCm: 20, alturaCm: 5, larguraCm: 15,
    ambiente: "homologacao",
  });
  const [showSenha, setShowSenha] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (correiosSettings) setCorreios(correiosSettings);
  }, [correiosSettings]);

  const correiosMut = useMutation({
    mutationFn: () => updateCorreiosSettings({ data: correios }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["correios-settings"] });
      toast.success("Configurações dos Correios salvas!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const testMut = useMutation({
    mutationFn: () => testCorreiosConnection(),
    onSuccess: (result) => {
      setTestResult(result);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro no teste"),
  });

  const setC = <K extends keyof CorreiosSettings>(key: K, value: CorreiosSettings[K]) =>
    setCorreios((prev) => ({ ...prev, [key]: value }));

  // ── WhatsApp ───────────────────────────────────────────────────────────────
  const { data: waSettings, isLoading: waLoading } = useQuery({
    queryKey: ["whatsapp-settings"],
    queryFn: () => getWhatsAppSettings(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 10 * 60 * 1000,
  });

  const [wa, setWa] = useState<WhatsAppSettings>({
    enabled: false, supportPhone: "", adminPhone: "", zapiInstanceId: "", zapiToken: "",
  });
  const [showWaToken, setShowWaToken] = useState(false);
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { if (waSettings) setWa(waSettings); }, [waSettings]);

  const waMut = useMutation({
    mutationFn: () => updateWhatsAppSettings({ data: wa }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["whatsapp-settings"] }); qc.invalidateQueries({ queryKey: ["whatsapp-settings-public"] }); toast.success("Configurações do WhatsApp salvas!"); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const waTestMut = useMutation({
    mutationFn: () => testWhatsAppConnection(),
    onSuccess: (result) => { setWaTestResult(result); if (result.ok) toast.success(result.message); else toast.error(result.message); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro no teste"),
  });

  const setW = <K extends keyof WhatsAppSettings>(key: K, value: WhatsAppSettings[K]) =>
    setWa((prev) => ({ ...prev, [key]: value }));

  // ── Estoque / inventário ───────────────────────────────────────────────────
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: () => getInventorySettings(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 10 * 60 * 1000,
  });

  const [inv, setInv] = useState<InventorySettings>({ lowStockThreshold: 5, adminEmail: "" });
  useEffect(() => { if (inventoryData) setInv(inventoryData); }, [inventoryData]);

  const invMut = useMutation({
    mutationFn: () => updateInventorySettings({ data: inv }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory-settings"] }); toast.success("Configurações de estoque salvas!"); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  // ── Fidelidade ────────────────────────────────────────────────────────────
  const { data: loyaltyData } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: () => getLoyaltyConfig(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 10 * 60 * 1000,
  });

  const [loyaltyConf, setLoyaltyConf] = useState<LoyaltyConfig>({
    enabled: true, pointsPerReal: 1, minRedeemPoints: 100, redeemRatio: 0.01,
  });
  useEffect(() => { if (loyaltyData) setLoyaltyConf(loyaltyData); }, [loyaltyData]);

  const loyaltyMut = useMutation({
    mutationFn: () => updateLoyaltyConfig({ data: loyaltyConf }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loyalty-config"] }); toast.success("Programa de fidelidade salvo!"); },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Configurações">
      <div className="max-w-3xl space-y-6">

        {/* Formas de pagamento */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-display font-bold mb-1">Formas de pagamento</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Controle quais métodos aparecem no checkout. Pelo menos um deve estar ativo.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map(({ id, label, description, icon: Icon }) => {
                const active = enabledMethods.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className={`w-full flex items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors ${
                      active
                        ? "border-neon bg-neon/5"
                        : "border-border bg-secondary/20 opacity-60 hover:opacity-80"
                    }`}
                  >
                    {/* Toggle visual */}
                    <div
                      className={`relative flex-none h-5 w-9 rounded-full transition-colors ${
                        active ? "bg-neon" : "bg-zinc-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${
                          active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>

                    <Icon className={`h-5 w-5 flex-none ${active ? "text-neon" : "text-muted-foreground"}`} />

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>
                        {label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{description}</p>
                    </div>

                    <span className={`text-xs font-semibold ${active ? "text-neon" : "text-muted-foreground"}`}>
                      {active ? "Ativo" : "Inativo"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && (
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                {enabledMethods.length} de {PAYMENT_OPTIONS.length} método{enabledMethods.length !== 1 ? "s" : ""} ativo{enabledMethods.length !== 1 ? "s" : ""}
              </p>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !isDirty}
                className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:scale-100"
              >
                {saveMut.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                  : <><Save className="h-3.5 w-3.5" /> Salvar alterações</>}
              </button>
            </div>
          )}
        </div>

        {/* Frete */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Configurações de frete</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Defina o valor do frete por estado e o limiar para frete grátis.
          </p>

          {shippingLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {/* Frete grátis a partir de */}
              <div className="mb-5 flex items-end gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Frete grátis a partir de (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={freeFrom}
                    onChange={(e) => setFreeFrom(e.target.value)}
                    className="h-10 w-40 rounded-md border border-border bg-background/50 px-3 text-sm focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-2">
                  Atual: {shippingConfig ? formatBRL(shippingConfig.freeFrom) : "—"}
                </p>
              </div>

              {/* Tabela por região */}
              <div className="space-y-4">
                {Object.entries(regions).map(([region, states]) => (
                  <div key={region}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{region}</h3>
                    <div className="rounded-md border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/20 text-xs uppercase text-muted-foreground">
                            <th className="px-3 py-2 text-left w-16">UF</th>
                            <th className="px-3 py-2 text-left">Preço (R$)</th>
                            <th className="px-3 py-2 text-left">Prazo (dias úteis)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {states.map((state) => (
                            <tr key={state} className="hover:bg-secondary/10">
                              <td className="px-3 py-2 font-mono font-bold text-xs">{state}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={rateEdits[state]?.price ?? ""}
                                  onChange={(e) =>
                                    setRateEdits((prev) => ({
                                      ...prev,
                                      [state]: { ...prev[state], price: e.target.value },
                                    }))
                                  }
                                  className="h-8 w-24 rounded border border-border bg-background/50 px-2 text-sm focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={rateEdits[state]?.days ?? ""}
                                  onChange={(e) =>
                                    setRateEdits((prev) => ({
                                      ...prev,
                                      [state]: { ...prev[state], days: e.target.value },
                                    }))
                                  }
                                  className="h-8 w-20 rounded border border-border bg-background/50 px-2 text-sm focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-end border-t border-border pt-4">
                <button
                  onClick={() => shippingMut.mutate()}
                  disabled={shippingMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:scale-100"
                >
                  {shippingMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                    : <><Save className="h-3.5 w-3.5" /> Salvar configurações de frete</>}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Modo de Teste */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="h-4 w-4 text-yellow-400" />
            <h2 className="font-display font-bold">Modo de Teste</h2>
            <span className="ml-auto rounded-full bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-0.5 text-[10px] font-bold text-yellow-400 uppercase tracking-wide">
              Somente admin
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Ative o PIX de Teste para criar pedidos reais sem integração com gateway.
            Útil para verificar e-mails, painel admin e timeline de pedidos.
          </p>

          {testModeLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {/* Toggle */}
              <button
                type="button"
                onClick={() => testModeMut.mutate(!(testMode?.pix_enabled ?? false))}
                disabled={testModeMut.isPending}
                className={`flex w-full items-center gap-4 rounded-lg border px-4 py-4 text-left transition-colors ${
                  testMode?.pix_enabled
                    ? "border-yellow-500/50 bg-yellow-500/5"
                    : "border-border bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                {/* Toggle visual */}
                <div className={`relative flex-none h-5 w-9 rounded-full transition-colors ${testMode?.pix_enabled ? "bg-yellow-400" : "bg-zinc-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${testMode?.pix_enabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>

                <Zap className={`h-5 w-5 flex-none ${testMode?.pix_enabled ? "text-yellow-400" : "text-muted-foreground"}`} />

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${testMode?.pix_enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    PIX de Teste
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aparece no checkout como opção de pagamento. Confirma o pedido automaticamente.
                  </p>
                </div>

                <span className={`text-xs font-bold ${testMode?.pix_enabled ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {testModeMut.isPending ? "…" : testMode?.pix_enabled ? "ATIVO" : "INATIVO"}
                </span>
              </button>

              {/* Aviso quando ativo */}
              {testMode?.pix_enabled && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400">
                  <TriangleAlert className="h-4 w-4 flex-none mt-0.5" />
                  <div>
                    <p className="font-semibold">Modo de Teste ATIVO</p>
                    <p className="text-xs text-yellow-400/70 mt-0.5">
                      O checkout exibe a opção "⚡ PIX de Teste" para qualquer visitante.
                      Desative após os testes.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Integração Correios */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Package2 className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Integração Correios</h2>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              API v2
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Gere etiquetas de postagem diretamente no painel ao marcar um pedido como "Enviado".
            O código de rastreio é preenchido automaticamente.
          </p>

          {correiosLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Credenciais ────────────────────────────────────────── */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Credenciais
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CField label="Usuário (login Correios)">
                    <input
                      value={correios.usuario}
                      onChange={(e) => setC("usuario", e.target.value)}
                      placeholder="seu@email.com"
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Senha">
                    <div className="relative">
                      <input
                        type={showSenha ? "text" : "password"}
                        value={correios.senha}
                        onChange={(e) => setC("senha", e.target.value)}
                        placeholder="••••••••"
                        className={cfgInput + " pr-10"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSenha((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </CField>
                  <CField label="Cartão de Postagem">
                    <input
                      value={correios.cartaoPostagem}
                      onChange={(e) => setC("cartaoPostagem", e.target.value)}
                      placeholder="0000000000"
                      className={cfgInput + " font-mono"}
                    />
                  </CField>
                  <CField label="Contrato">
                    <input
                      value={correios.contrato}
                      onChange={(e) => setC("contrato", e.target.value)}
                      placeholder="0000000000"
                      className={cfgInput + " font-mono"}
                    />
                  </CField>
                </div>
              </section>

              {/* ── Remetente ──────────────────────────────────────────── */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dados do remetente
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CField label="Nome / Razão Social">
                    <input
                      value={correios.remetenteNome}
                      onChange={(e) => setC("remetenteNome", e.target.value)}
                      placeholder="Secret Desire Ltda"
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="CPF / CNPJ">
                    <input
                      value={correios.remetenteCpfCnpj}
                      onChange={(e) => setC("remetenteCpfCnpj", e.target.value)}
                      placeholder="00.000.000/0001-00"
                      className={cfgInput + " font-mono"}
                    />
                  </CField>
                  <CField label="E-mail">
                    <input
                      type="email"
                      value={correios.remetenteEmail}
                      onChange={(e) => setC("remetenteEmail", e.target.value)}
                      placeholder="contato@loja.com"
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="CEP">
                    <input
                      value={correios.remetenteCep}
                      onChange={(e) => setC("remetenteCep", e.target.value)}
                      placeholder="00000-000"
                      className={cfgInput + " font-mono"}
                    />
                  </CField>
                  <CField label="Logradouro">
                    <input
                      value={correios.remetenteLogradouro}
                      onChange={(e) => setC("remetenteLogradouro", e.target.value)}
                      placeholder="Rua das Flores"
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Número">
                    <input
                      value={correios.remetenteNumero}
                      onChange={(e) => setC("remetenteNumero", e.target.value)}
                      placeholder="100"
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Bairro">
                    <input
                      value={correios.remetenteBairro}
                      onChange={(e) => setC("remetenteBairro", e.target.value)}
                      placeholder="Centro"
                      className={cfgInput}
                    />
                  </CField>
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <CField label="Cidade">
                      <input
                        value={correios.remetenteCidade}
                        onChange={(e) => setC("remetenteCidade", e.target.value)}
                        placeholder="São Paulo"
                        className={cfgInput}
                      />
                    </CField>
                    <CField label="UF">
                      <input
                        value={correios.remetenteUf}
                        onChange={(e) => setC("remetenteUf", e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="SP"
                        maxLength={2}
                        className={cfgInput + " font-mono text-center uppercase"}
                      />
                    </CField>
                  </div>
                </div>
              </section>

              {/* ── Embalagem padrão ───────────────────────────────────── */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Embalagem padrão
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CField label="Serviço">
                    <select
                      value={correios.codigoServico}
                      onChange={(e) => setC("codigoServico", e.target.value)}
                      className={cfgInput}
                    >
                      {CORREIOS_SERVICES.map((s) => (
                        <option key={s.code} value={s.code}>{s.label} ({s.code})</option>
                      ))}
                    </select>
                  </CField>
                  <CField label="Peso (gramas)">
                    <input
                      type="number" min={1} step={1}
                      value={correios.pesoGramas}
                      onChange={(e) => setC("pesoGramas", Number(e.target.value))}
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Comprimento (cm)">
                    <input
                      type="number" min={1} step={0.1}
                      value={correios.comprimentoCm}
                      onChange={(e) => setC("comprimentoCm", Number(e.target.value))}
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Altura (cm)">
                    <input
                      type="number" min={1} step={0.1}
                      value={correios.alturaCm}
                      onChange={(e) => setC("alturaCm", Number(e.target.value))}
                      className={cfgInput}
                    />
                  </CField>
                  <CField label="Largura (cm)">
                    <input
                      type="number" min={1} step={0.1}
                      value={correios.larguraCm}
                      onChange={(e) => setC("larguraCm", Number(e.target.value))}
                      className={cfgInput}
                    />
                  </CField>
                </div>
              </section>

              {/* ── Ambiente ───────────────────────────────────────────── */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ambiente
                </h3>
                <div className="flex gap-3">
                  {(["homologacao", "producao"] as const).map((env) => (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setC("ambiente", env)}
                      className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        correios.ambiente === env
                          ? "border-neon bg-neon/5 text-foreground"
                          : "border-border bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                      }`}
                    >
                      <p className="font-semibold capitalize">{env === "homologacao" ? "Homologação" : "Produção"}</p>
                      <p className="text-xs mt-0.5 opacity-70">
                        {env === "homologacao" ? "apihom.correios.com.br · testes" : "api.correios.com.br · real"}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Teste + Salvar ─────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => { setTestResult(null); testMut.mutate(); }}
                  disabled={testMut.isPending || correiosMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-neon hover:text-neon disabled:opacity-40"
                >
                  {testMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando…</>
                    : <><Wifi className="h-3.5 w-3.5" /> Testar conexão</>}
                </button>

                {testResult && (
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${testResult.ok ? "text-green-400" : "text-destructive"}`}>
                    {testResult.ok
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : <WifiOff className="h-3.5 w-3.5" />}
                    {testResult.message}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => correiosMut.mutate()}
                  disabled={correiosMut.isPending || testMut.isPending}
                  className="ml-auto inline-flex items-center gap-2 rounded-md bg-neon px-4 py-2 text-sm font-bold text-primary-foreground glow transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:scale-100"
                >
                  {correiosMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                    : <><Save className="h-3.5 w-3.5" /> Salvar Correios</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            <h2 className="font-display font-bold">WhatsApp</h2>
            <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              Z-API
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Botão de suporte flutuante no site e notificações automáticas de pedidos para cliente e admin.
          </p>

          {waLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <div className="space-y-5">

              {/* Toggle ativo */}
              <button
                type="button"
                onClick={() => setW("enabled", !wa.enabled)}
                className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors ${wa.enabled ? "border-[#25D366]/50 bg-[#25D366]/5" : "border-border bg-secondary/20 hover:bg-secondary/40"}`}
              >
                <div className={`relative flex-none h-5 w-9 rounded-full transition-colors ${wa.enabled ? "bg-[#25D366]" : "bg-zinc-600"}`}>
                  <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${wa.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <MessageCircle className={`h-5 w-5 flex-none ${wa.enabled ? "text-[#25D366]" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${wa.enabled ? "text-foreground" : "text-muted-foreground"}`}>Integração ativa</p>
                  <p className="text-xs text-muted-foreground">Habilita o botão flutuante e o envio de notificações</p>
                </div>
                <span className={`text-xs font-bold ${wa.enabled ? "text-[#25D366]" : "text-muted-foreground"}`}>
                  {wa.enabled ? "ATIVO" : "INATIVO"}
                </span>
              </button>

              {/* Números */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Números</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CField label="Número de suporte (público)">
                    <input
                      value={wa.supportPhone}
                      onChange={(e) => setW("supportPhone", e.target.value)}
                      placeholder="5511999999999"
                      className={cfgInput + " font-mono"}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground/70">Exibido no botão flutuante do site. Formato: DDI + DDD + número.</p>
                  </CField>
                  <CField label="Número admin (notificações)">
                    <input
                      value={wa.adminPhone}
                      onChange={(e) => setW("adminPhone", e.target.value)}
                      placeholder="5511999999999"
                      className={cfgInput + " font-mono"}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground/70">Recebe aviso de cada novo pedido confirmado.</p>
                  </CField>
                </div>
              </section>

              {/* Z-API credentials */}
              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credenciais Z-API</h3>
                <p className="mb-3 text-[11px] text-muted-foreground/80">
                  Crie sua conta em{" "}
                  <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" className="text-neon underline-offset-2 hover:underline">z-api.io</a>
                  , crie uma instância e copie o Instance ID e Token abaixo.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CField label="Instance ID">
                    <input
                      value={wa.zapiInstanceId}
                      onChange={(e) => setW("zapiInstanceId", e.target.value)}
                      placeholder="3ABC1DEF…"
                      className={cfgInput + " font-mono"}
                    />
                  </CField>
                  <CField label="Token">
                    <div className="relative">
                      <input
                        type={showWaToken ? "text" : "password"}
                        value={wa.zapiToken}
                        onChange={(e) => setW("zapiToken", e.target.value)}
                        placeholder="••••••••••••"
                        className={cfgInput + " pr-10 font-mono"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowWaToken((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showWaToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </CField>
                </div>
              </section>

              {/* Testar + Salvar */}
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => { setWaTestResult(null); waTestMut.mutate(); }}
                  disabled={waTestMut.isPending || waMut.isPending}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-[#25D366] hover:text-[#25D366] disabled:opacity-40"
                >
                  {waTestMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testando…</>
                    : <><Wifi className="h-3.5 w-3.5" /> Testar conexão</>}
                </button>

                {waTestResult && (
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${waTestResult.ok ? "text-green-400" : "text-destructive"}`}>
                    {waTestResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {waTestResult.message}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => waMut.mutate()}
                  disabled={waMut.isPending || waTestMut.isPending}
                  className="ml-auto inline-flex items-center gap-2 rounded-md bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.01] disabled:opacity-40 disabled:scale-100"
                >
                  {waMut.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
                    : <><Save className="h-3.5 w-3.5" /> Salvar WhatsApp</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Alertas de estoque ─────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Alertas de estoque</h2>
          </div>
          <div className="space-y-4">
            <CField label="Limite crítico (unidades)">
              <input
                type="number"
                min={0}
                max={999}
                value={inv.lowStockThreshold}
                onChange={(e) => setInv((p) => ({ ...p, lowStockThreshold: Number(e.target.value) }))}
                className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Um e-mail de alerta é enviado quando o estoque de um produto cai abaixo deste valor.
              </p>
            </CField>
            <CField label="E-mail de destino">
              <input
                type="email"
                placeholder="admin@secretdesire.com.br"
                value={inv.adminEmail}
                onChange={(e) => setInv((p) => ({ ...p, adminEmail: e.target.value }))}
                className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe em branco para desativar os alertas por e-mail.
              </p>
            </CField>
            <div className="flex justify-end">
              <button
                onClick={() => invMut.mutate()}
                disabled={invMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-neon px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {invMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</> : <><Save className="h-3.5 w-3.5" /> Salvar alertas</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Programa de fidelidade ─────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Star className="h-4 w-4 text-neon" />
            <h2 className="font-display font-bold">Programa de fidelidade</h2>
          </div>
          <div className="space-y-4">
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setLoyaltyConf((p) => ({ ...p, enabled: !p.enabled }))}
              className={`flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors ${loyaltyConf.enabled ? "border-neon/50 bg-neon/5" : "border-border bg-secondary/20 hover:bg-secondary/40"}`}
            >
              <div className={`relative flex-none h-5 w-9 rounded-full transition-colors ${loyaltyConf.enabled ? "bg-neon" : "bg-zinc-600"}`}>
                <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform ${loyaltyConf.enabled ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold">Programa ativo</p>
                <p className="text-xs text-muted-foreground">Clientes ganham pontos em cada compra confirmada</p>
              </div>
              <span className={`ml-auto text-xs font-bold ${loyaltyConf.enabled ? "text-neon" : "text-muted-foreground"}`}>
                {loyaltyConf.enabled ? "ATIVO" : "INATIVO"}
              </span>
            </button>

            {loyaltyConf.enabled && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <CField label="Pontos por R$1">
                  <input
                    type="number" min={1} max={100}
                    value={loyaltyConf.pointsPerReal}
                    onChange={(e) => setLoyaltyConf((p) => ({ ...p, pointsPerReal: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
                  />
                </CField>
                <CField label="Mínimo para resgatar">
                  <input
                    type="number" min={1}
                    value={loyaltyConf.minRedeemPoints}
                    onChange={(e) => setLoyaltyConf((p) => ({ ...p, minRedeemPoints: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
                  />
                </CField>
                <CField label="Valor por ponto (R$)">
                  <input
                    type="number" min={0.001} max={1} step={0.001}
                    value={loyaltyConf.redeemRatio}
                    onChange={(e) => setLoyaltyConf((p) => ({ ...p, redeemRatio: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm focus:border-neon focus:outline-none"
                  />
                </CField>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => loyaltyMut.mutate()}
                disabled={loyaltyMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-neon px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {loyaltyMut.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</> : <><Save className="h-3.5 w-3.5" /> Salvar fidelidade</>}
              </button>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

function CField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const cfgInput =
  "h-10 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground/50 focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";
