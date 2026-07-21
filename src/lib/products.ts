import type { DbProduct } from "./types";

// Tipo público usado pelos componentes (camelCase por compatibilidade)
export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  oldPrice?: number;
  tag?: "Mais Vendido" | "Lançamento" | "Frete Grátis";
  category: string;
  notes: string[];
  sizes: string[];
  shortDescription: string;
  description: string;
  images: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  // Filtros sex shop
  forWhom?: "ela" | "ele" | "casal" | "todos" | null;
  experienceLevel?: "iniciante" | "intermediario" | "avancado" | null;
  // SEO
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  // Internos
  active?: boolean;
  createdAt?: string;
};

export function dbProductToProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    oldPrice: p.old_price ?? undefined,
    tag: p.tag ?? undefined,
    category: p.category ?? "",
    notes: p.notes,
    sizes: p.sizes,
    shortDescription: p.short_description ?? "",
    description: p.description ?? "",
    images: p.images,
    rating: p.rating,
    reviewCount: p.review_count,
    stock: p.stock,
    forWhom: p.for_whom ?? null,
    experienceLevel: p.experience_level ?? null,
    metaTitle: p.meta_title ?? null,
    metaDescription: p.meta_description ?? null,
    ogImage: p.og_image ?? null,
    active: p.active,
    createdAt: p.created_at,
  };
}

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

// Fallback mock — usado quando o Supabase não está configurado
export const PRODUCTS: Product[] = [
  {
    id: "p1",
    slug: "vibrador-rabbit-deluxe",
    name: "Vibrador Rabbit Deluxe",
    price: 189.9,
    oldPrice: 249.9,
    tag: "Mais Vendido",
    category: "Vibradores",
    notes: ["Silicone médico", "10 velocidades", "Recarregável USB"],
    sizes: ["Padrão"],
    shortDescription: "Estimulação dupla com 10 modos de vibração.",
    description: "Vibrador rabbit em silicone médico hipoalergênico com motor duplo, 10 modos de vibração e carregamento USB. À prova d'água.",
    images: [img("photo-1616628188859-7a11abb6fcc9"), img("photo-1631729371254-42c2892f0e6e")],
    rating: 4.9,
    reviewCount: 312,
    stock: 50,
    forWhom: "ela",
    experienceLevel: "intermediario",
  },
  {
    id: "p2",
    slug: "kit-massagem-sensual",
    name: "Kit Massagem Sensual",
    price: 129.9,
    tag: "Lançamento",
    category: "Cosméticos",
    notes: ["Óleo aquecedor", "Vela aromática", "Pluma"],
    sizes: ["Kit completo"],
    shortDescription: "Tudo para uma noite inesquecível a dois.",
    description: "Kit com óleo de massagem aquecedor, vela aromática comestível e pluma estimulante. Perfeito para casais.",
    images: [img("photo-1600428877878-1a0ff561571c"), img("photo-1596755389378-c31d21fd1273")],
    rating: 4.8,
    reviewCount: 184,
    stock: 38,
    forWhom: "casal",
    experienceLevel: "iniciante",
  },
  {
    id: "p3",
    slug: "lingerie-renda-preta",
    name: "Lingerie Renda Luxo",
    price: 149.9,
    oldPrice: 199.9,
    tag: "Frete Grátis",
    category: "Lingeries",
    notes: ["Renda francesa", "Conjunto 3 peças", "P ao GG"],
    sizes: ["P", "M", "G", "GG"],
    shortDescription: "Conjunto em renda francesa com 3 peças.",
    description: "Conjunto de lingerie em renda francesa importada: sutiã, calcinha e cinta-liga. Disponível do P ao GG.",
    images: [img("photo-1616628188859-7a11abb6fcc9"), img("photo-1631729371254-42c2892f0e6e")],
    rating: 4.7,
    reviewCount: 256,
    stock: 45,
    forWhom: "ela",
    experienceLevel: "iniciante",
  },
  {
    id: "p4",
    slug: "gel-lubrificante-premium",
    name: "Gel Lubrificante Premium",
    price: 59.9,
    category: "Cosméticos",
    notes: ["Base água", "Longa duração", "Sem parabenos"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Lubrificante à base de água, longa duração.",
    description: "Gel lubrificante íntimo à base de água, sem parabenos, dermatologicamente testado. Compatível com preservativos e brinquedos.",
    images: [img("photo-1556228578-0d85b1a4d571"), img("photo-1598440947619-2c35fc9aa908")],
    rating: 4.6,
    reviewCount: 98,
    stock: 22,
    forWhom: "todos",
    experienceLevel: "iniciante",
  },
  {
    id: "p5",
    slug: "kit-bdsm-iniciante",
    name: "Kit BDSM Iniciante",
    price: 219.9,
    oldPrice: 289.9,
    tag: "Mais Vendido",
    category: "Acessórios",
    notes: ["7 peças", "Couro sintético", "Estojo incluso"],
    sizes: ["Kit 7 peças"],
    shortDescription: "Kit completo para explorar novas sensações.",
    description: "Kit com 7 peças em couro sintético: algemas, venda, coleira, chicote, mordaça, corda e grampos. Acompanha estojo de armazenamento.",
    images: [img("photo-1557170334-a9086d51c3c1"), img("photo-1610461888750-10bfc601b874")],
    rating: 5.0,
    reviewCount: 421,
    stock: 15,
    forWhom: "casal",
    experienceLevel: "iniciante",
  },
  {
    id: "p6",
    slug: "jogo-erotico-dados",
    name: "Jogo dos Dados Picantes",
    price: 49.9,
    tag: "Lançamento",
    category: "Jogos Eróticos",
    notes: ["3 dados", "Posições", "Ações"],
    sizes: ["Padrão"],
    shortDescription: "Dados com posições e ações para apimentar.",
    description: "Conjunto de 3 dados eróticos: um com partes do corpo, outro com ações e o terceiro com posições. Diversão garantida para casais.",
    images: [img("photo-1585386959984-a4155224a1ad"), img("photo-1592842232655-e5d345cbc2c1")],
    rating: 4.7,
    reviewCount: 142,
    stock: 33,
    forWhom: "casal",
    experienceLevel: "iniciante",
  },
];

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
