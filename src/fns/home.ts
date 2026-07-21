import { createServerFn } from "@tanstack/react-start";
import { createSupabaseAdmin } from "@/lib/supabase";

export type TrustBadgeIcon =
  | "truck" | "shield" | "star" | "gift" | "zap" | "heart" | "lock" | "package" | "award" | "clock";

export type HomeContent = {
  promoBar: {
    visible: boolean;
    text: string;
    btnText: string;
    btnUrl: string;
    bgColor: string;
    textColor: string;
  };
  hero: {
    badge: string;
    headingPre: string;
    headingHighlight: string;
    headingPost: string;
    description: string;
    primaryBtnText: string;
    primaryBtnUrl: string;
    secondaryBtnText: string;
    secondaryBtnUrl: string;
    imageUrl: string;
    imageAlt: string;
  };
  trustBadges: Array<{ icon: TrustBadgeIcon; text: string }>;
  sections: {
    collection: { eyebrow: string; title: string; visible: boolean };
    bestsellers: { eyebrow: string; title: string; visible: boolean };
    novidades: { eyebrow: string; title: string; visible: boolean };
  };
  categories: Array<{
    name: string;
    imageUrl: string;
    filterCategory: string;
    visible: boolean;
  }>;
};

export const DEFAULT_HOME: HomeContent = {
  promoBar: {
    visible: false,
    text: "🔥 Use o cupom DESIRE10 e ganhe 10% OFF na primeira compra!",
    btnText: "Aproveitar",
    btnUrl: "#colecao",
    bgColor: "#be123c",
    textColor: "#ffffff",
  },
  hero: {
    badge: "Novidades 2026",
    headingPre: "Prazer com",
    headingHighlight: "discrição",
    headingPost: ".\nEntrega sigilosa.",
    description:
      "Produtos eróticos selecionados para casais e solo. Embalagem 100% discreta garantida.",
    primaryBtnText: "Ver produtos",
    primaryBtnUrl: "#colecao",
    secondaryBtnText: "Mais vendidos",
    secondaryBtnUrl: "#bestsellers",
    imageUrl: "",
    imageAlt: "Secret Desire - Sex Shop Online",
  },
  trustBadges: [
    { icon: "lock", text: "Embalagem 100% discreta" },
    { icon: "truck", text: "Frete grátis acima de R$199" },
    { icon: "shield", text: "Sigilo total no cartão" },
    { icon: "zap", text: "Envio em 24h" },
  ],
  sections: {
    collection: { eyebrow: "Catálogo", title: "Todos os produtos", visible: true },
    bestsellers: { eyebrow: "Top da loja", title: "Mais vendidos", visible: true },
    novidades: { eyebrow: "Acabou de chegar", title: "Novidades", visible: true },
  },
  categories: [
    { name: "Vibradores", imageUrl: "", filterCategory: "Vibradores", visible: true },
    { name: "Lingeries", imageUrl: "", filterCategory: "Lingeries", visible: true },
    { name: "Cosméticos", imageUrl: "", filterCategory: "Cosméticos", visible: true },
    { name: "Acessórios", imageUrl: "", filterCategory: "Acessórios", visible: true },
    { name: "Jogos Eróticos", imageUrl: "", filterCategory: "Jogos Eróticos", visible: true },
    { name: "Casais", imageUrl: "", filterCategory: "Casais", visible: true },
  ],
};

function mergeContent(saved: Partial<HomeContent>): HomeContent {
  return {
    promoBar: { ...DEFAULT_HOME.promoBar, ...(saved.promoBar ?? {}) },
    hero: { ...DEFAULT_HOME.hero, ...(saved.hero ?? {}) },
    trustBadges: saved.trustBadges ?? DEFAULT_HOME.trustBadges,
    sections: {
      collection: { ...DEFAULT_HOME.sections.collection, ...(saved.sections?.collection ?? {}) },
      bestsellers: { ...DEFAULT_HOME.sections.bestsellers, ...(saved.sections?.bestsellers ?? {}) },
      novidades: { ...DEFAULT_HOME.sections.novidades, ...(saved.sections?.novidades ?? {}) },
    },
    categories: saved.categories ?? DEFAULT_HOME.categories,
  };
}

export const getHomeContent = createServerFn().handler(async (): Promise<HomeContent> => {
  const db = createSupabaseAdmin();
  const { data } = await db.from("store_settings").select("value").eq("key", "home").single();
  if (!data) return DEFAULT_HOME;
  return mergeContent(data.value as Partial<HomeContent>);
});

export const updateHomeContent = createServerFn()
  .inputValidator((input: unknown) => input as HomeContent)
  .handler(async ({ data }) => {
    const db = createSupabaseAdmin();
    const { error } = await db
      .from("store_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ key: "home", value: data as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  });
