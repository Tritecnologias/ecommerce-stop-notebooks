// Script para inserir seed de produtos no Supabase remoto
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como variáveis de ambiente");
  process.exit(1);
}

const products = [
  {
    slug: "vibrador-rabbit-deluxe",
    name: "Vibrador Rabbit Deluxe",
    short_description: "Estimulação dupla com 10 modos de vibração.",
    description:
      "Vibrador rabbit em silicone médico hipoalergênico com motor duplo, 10 modos de vibração e carregamento USB. À prova d'água para uso no banho.",
    price: 189.9,
    old_price: 249.9,
    category: "Vibradores",
    tag: "Mais Vendido",
    notes: ["Silicone médico", "10 velocidades", "Recarregável USB", "À prova d'água"],
    sizes: ["Padrão"],
    images: [
      "https://images.unsplash.com/photo-1616628188859-7a11abb6fcc9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 4.9,
    review_count: 312,
    stock: 50,
    active: true,
  },
  {
    slug: "kit-massagem-sensual",
    name: "Kit Massagem Sensual",
    short_description: "Tudo para uma noite inesquecível a dois.",
    description:
      "Kit com óleo de massagem aquecedor, vela aromática comestível e pluma estimulante. Perfeito para casais que querem apimentar a relação.",
    price: 129.9,
    old_price: null,
    category: "Cosméticos",
    tag: "Lançamento",
    notes: ["Óleo aquecedor", "Vela aromática", "Pluma"],
    sizes: ["Kit completo"],
    images: [
      "https://images.unsplash.com/photo-1600428877878-1a0ff561571c?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 4.8,
    review_count: 184,
    stock: 38,
    active: true,
  },
  {
    slug: "lingerie-renda-luxo",
    name: "Lingerie Renda Luxo",
    short_description: "Conjunto em renda francesa com 3 peças.",
    description:
      "Conjunto de lingerie em renda francesa importada: sutiã, calcinha e cinta-liga. Disponível do P ao GG. Conforto e sensualidade.",
    price: 149.9,
    old_price: 199.9,
    category: "Lingeries",
    tag: "Frete Grátis",
    notes: ["Renda francesa", "Conjunto 3 peças", "P ao GG"],
    sizes: ["P", "M", "G", "GG"],
    images: [
      "https://images.unsplash.com/photo-1616628188859-7a11abb6fcc9?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 4.7,
    review_count: 256,
    stock: 45,
    active: true,
  },
  {
    slug: "gel-lubrificante-premium",
    name: "Gel Lubrificante Premium",
    short_description: "Lubrificante à base de água, longa duração.",
    description:
      "Gel lubrificante íntimo à base de água, sem parabenos, dermatologicamente testado. Compatível com preservativos e brinquedos eróticos.",
    price: 59.9,
    old_price: null,
    category: "Cosméticos",
    tag: null,
    notes: ["Base água", "Longa duração", "Sem parabenos"],
    sizes: ["100ml", "200ml"],
    images: [
      "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 4.6,
    review_count: 98,
    stock: 22,
    active: true,
  },
  {
    slug: "kit-bdsm-iniciante",
    name: "Kit BDSM Iniciante",
    short_description: "Kit completo para explorar novas sensações.",
    description:
      "Kit com 7 peças em couro sintético: algemas, venda, coleira, chicote, mordaça, corda e grampos. Acompanha estojo de armazenamento discreto.",
    price: 219.9,
    old_price: 289.9,
    category: "Acessórios",
    tag: "Mais Vendido",
    notes: ["7 peças", "Couro sintético", "Estojo incluso"],
    sizes: ["Kit 7 peças"],
    images: [
      "https://images.unsplash.com/photo-1557170334-a9086d51c3c1?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1610461888750-10bfc601b874?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 5.0,
    review_count: 421,
    stock: 15,
    active: true,
  },
  {
    slug: "jogo-dados-picantes",
    name: "Jogo dos Dados Picantes",
    short_description: "Dados com posições e ações para apimentar.",
    description:
      "Conjunto de 3 dados eróticos: um com partes do corpo, outro com ações e o terceiro com posições. Diversão garantida para casais.",
    price: 49.9,
    old_price: null,
    category: "Jogos Eróticos",
    tag: "Lançamento",
    notes: ["3 dados", "Posições", "Ações"],
    sizes: ["Padrão"],
    images: [
      "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1592842232655-e5d345cbc2c1?auto=format&fit=crop&w=900&q=80",
    ],
    rating: 4.7,
    review_count: 142,
    stock: 33,
    active: true,
  },
];

const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
  method: "POST",
  headers: {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "resolution=ignore-duplicates,return=minimal",
  },
  body: JSON.stringify(products),
});

if (res.ok) {
  console.log(`✓ ${products.length} produtos inseridos com sucesso!`);
} else {
  const err = await res.text();
  console.error("Erro:", res.status, err);
  process.exit(1);
}
