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
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    slug: "midnight-rush",
    name: "Midnight Rush",
    price: 89.9,
    oldPrice: 119.9,
    tag: "Mais Vendido",
    category: "Amadeirado",
    notes: ["Baunilha", "Âmbar", "Sândalo"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Aroma quente e magnético para a noite.",
    description:
      "Um body splash intenso e envolvente, com notas de baunilha cremosa, âmbar e sândalo. Fixação prolongada para quem quer marcar presença.",
    images: [img("photo-1541643600914-78b084683601"), img("photo-1592945403244-b3fbafd7f539")],
    rating: 4.9,
    reviewCount: 312,
  },
  {
    id: "p2",
    slug: "neon-bloom",
    name: "Neon Bloom",
    price: 74.9,
    tag: "Lançamento",
    category: "Floral",
    notes: ["Peônia", "Jasmim", "Musk Branco"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Floral vibrante com toque elétrico.",
    description:
      "Frescor floral moderno, com peônia, jasmim e um fundo de musk branco. Leve, jovem e marcante o dia todo.",
    images: [img("photo-1588405748880-12d1d2a59d75"), img("photo-1615634260167-c8cdede054de")],
    rating: 4.8,
    reviewCount: 184,
  },
  {
    id: "p3",
    slug: "tropic-glow",
    name: "Tropic Glow",
    price: 69.9,
    oldPrice: 89.9,
    tag: "Frete Grátis",
    category: "Frutal",
    notes: ["Maracujá", "Coco", "Pêssego"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Verão na pele, do dia à noite.",
    description:
      "Frutado solar e adocicado, com maracujá, coco e pêssego maduro. Perfeito para climas quentes.",
    images: [img("photo-1547887537-6158d64c35b3"), img("photo-1523293182086-7651a899d37f")],
    rating: 4.7,
    reviewCount: 256,
  },
  {
    id: "p4",
    slug: "ice-vapor",
    name: "Ice Vapor",
    price: 79.9,
    category: "Fresco",
    notes: ["Menta", "Limão Siciliano", "Cedro"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Refrescância gelada com toque amadeirado.",
    description:
      "Sensação de frescor instantâneo, com menta crocante, limão siciliano e cedro suave. Ideal pós-banho.",
    images: [img("photo-1594035910387-fea47794261f"), img("photo-1517141928534-fbb1d9d96e25")],
    rating: 4.6,
    reviewCount: 98,
  },
  {
    id: "p5",
    slug: "velvet-noir",
    name: "Velvet Noir",
    price: 99.9,
    oldPrice: 129.9,
    tag: "Mais Vendido",
    category: "Oriental",
    notes: ["Rosa Negra", "Patchouli", "Couro"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Sedutor, misterioso, inesquecível.",
    description:
      "Composição oriental sofisticada com rosa negra, patchouli e um leve toque de couro. Para ocasiões especiais.",
    images: [img("photo-1557170334-a9086d51c3c1"), img("photo-1610461888750-10bfc601b874")],
    rating: 5.0,
    reviewCount: 421,
  },
  {
    id: "p6",
    slug: "sunset-haze",
    name: "Sunset Haze",
    price: 64.9,
    tag: "Lançamento",
    category: "Cítrico",
    notes: ["Bergamota", "Tangerina", "Almíscar"],
    sizes: ["100ml", "200ml"],
    shortDescription: "Luz dourada em forma de aroma.",
    description:
      "Cítrico solar com bergamota e tangerina, finalizando em almíscar quente. Despertador para os sentidos.",
    images: [img("photo-1585386959984-a4155224a1ad"), img("photo-1592842232655-e5d345cbc2c1")],
    rating: 4.7,
    reviewCount: 142,
  },
];

export const getProduct = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
