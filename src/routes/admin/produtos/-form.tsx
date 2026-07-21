import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X, Search } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { DbProduct } from "@/lib/types";
import { ImageGalleryEditor } from "@/components/ImageGalleryEditor";

const schema = z.object({
  name: z.string().min(1, "Obrigatório"),
  slug: z.string().min(1, "Obrigatório").regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  short_description: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().positive("Preço deve ser positivo"),
  old_price: z.coerce.number().positive().optional(),
  category: z.string().optional(),
  tag: z.enum(["Mais Vendido", "Lançamento", "Frete Grátis", ""]).optional(),
  notes: z.array(z.object({ value: z.string() })).default([]),
  sizes: z.array(z.object({ value: z.string() })).default([{ value: "100ml" }, { value: "200ml" }]),
  // Armazenamos como array de URLs diretas (não mais como { value } wrappados no schema)
  images: z.array(z.string()).default([]),
  stock: z.coerce.number().int().min(0).default(0),
  rating: z.coerce.number().min(0).max(5).default(0),
  review_count: z.coerce.number().int().min(0).default(0),
  active: z.boolean().default(true),
  // SEO
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  og_image: z.string().optional(),
});

export type ProductFormValues = Omit<z.infer<typeof schema>, "notes" | "sizes" | "tag" | "meta_title" | "meta_description" | "og_image"> & {
  notes: string[];
  sizes: string[];
  images: string[];
  tag?: "Mais Vendido" | "Lançamento" | "Frete Grátis" | null;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
};

type RawValues = z.infer<typeof schema>;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ProductForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues?: Partial<DbProduct>;
  onSubmit: (data: ProductFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<RawValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
      short_description: defaultValues?.short_description ?? "",
      description: defaultValues?.description ?? "",
      price: defaultValues?.price ?? 0,
      old_price: defaultValues?.old_price ?? undefined,
      category: defaultValues?.category ?? "",
      tag: (defaultValues?.tag ?? "") as RawValues["tag"],
      notes: (defaultValues?.notes ?? []).map((v) => ({ value: v })),
      sizes: (defaultValues?.sizes ?? ["100ml", "200ml"]).map((v) => ({ value: v })),
      images: defaultValues?.images ?? [],
      stock: defaultValues?.stock ?? 0,
      rating: defaultValues?.rating ?? 0,
      review_count: defaultValues?.review_count ?? 0,
      active: defaultValues?.active ?? true,
      meta_title: defaultValues?.meta_title ?? "",
      meta_description: defaultValues?.meta_description ?? "",
      og_image: defaultValues?.og_image ?? "",
    },
  });

  const notes = useFieldArray({ control, name: "notes" });
  const sizes = useFieldArray({ control, name: "sizes" });
  const imageUrls = watch("images");
  const watchName = watch("name");
  const watchSlug = watch("slug");
  const watchShortDesc = watch("short_description");
  const watchMetaTitle = watch("meta_title");
  const watchMetaDesc = watch("meta_description");

  const handleSubmitTransform = (raw: RawValues) => {
    onSubmit({
      ...raw,
      tag: (raw.tag || null) as ProductFormValues["tag"],
      notes: raw.notes.map((n) => n.value).filter(Boolean),
      sizes: raw.sizes.map((s) => s.value).filter(Boolean),
      images: raw.images.filter(Boolean),
      // SEO: normalize empty strings to null
      meta_title: raw.meta_title?.trim() || null,
      meta_description: raw.meta_description?.trim() || null,
      og_image: raw.og_image?.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit(handleSubmitTransform)} className="space-y-6 max-w-3xl">
      <Section title="Informações básicas">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome *" error={errors.name?.message}>
            <input
              {...register("name")}
              placeholder="Ex: Midnight Rush"
              className={inputCls}
              onChange={(e) => {
                register("name").onChange(e);
                if (!defaultValues?.slug) setValue("slug", slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Slug (URL) *" error={errors.slug?.message}>
            <input {...register("slug")} placeholder="midnight-rush" className={inputCls} />
          </Field>
        </div>
        <Field label="Descrição curta" error={errors.short_description?.message}>
          <input {...register("short_description")} placeholder="Frase de impacto do produto" className={inputCls} />
        </Field>
        <Field label="Descrição completa">
          <textarea {...register("description")} rows={4} placeholder="Descreva o produto em detalhes…" className={inputCls + " h-auto resize-y py-3"} />
        </Field>
      </Section>

      <Section title="Preço e estoque">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Preço (R$) *" error={errors.price?.message}>
            <input {...register("price")} type="number" step="0.01" placeholder="89.90" className={inputCls} />
          </Field>
          <Field label="Preço original (R$)" error={errors.old_price?.message}>
            <input {...register("old_price")} type="number" step="0.01" placeholder="Deixe vazio se sem desconto" className={inputCls} />
          </Field>
          <Field label="Estoque" error={errors.stock?.message}>
            <input {...register("stock")} type="number" min="0" className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="Categorização">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Categoria">
            <input {...register("category")} placeholder="Ex: Vibradores, Lingeries, Cosméticos" className={inputCls} />
          </Field>
          <Field label="Tag destaque">
            <select {...register("tag")} className={inputCls}>
              <option value="">Nenhuma</option>
              <option value="Mais Vendido">Mais Vendido</option>
              <option value="Lançamento">Lançamento</option>
              <option value="Frete Grátis">Frete Grátis</option>
            </select>
          </Field>
          <Field label="Ativo">
            <label className="flex h-11 items-center gap-3 cursor-pointer">
              <input {...register("active")} type="checkbox" className="h-4 w-4 rounded accent-green-400" />
              <span className="text-sm">Visível na loja</span>
            </label>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Field label="Para quem">
            <select {...register("for_whom")} className={inputCls}>
              <option value="">Não definido</option>
              <option value="ela">Para Ela</option>
              <option value="ele">Para Ele</option>
              <option value="casal">Para Casais</option>
              <option value="todos">Unissex</option>
            </select>
          </Field>
          <Field label="Nível de experiência">
            <select {...register("experience_level")} className={inputCls}>
              <option value="">Não definido</option>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Características">
        <div className="flex flex-wrap gap-2">
          {notes.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1">
              <input {...register(`notes.${i}.value`)} className="bg-transparent text-xs outline-none w-24" />
              <button type="button" onClick={() => notes.remove(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => notes.append({ value: "" })}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-neon hover:text-neon">
            <Plus className="h-3 w-3" /> Adicionar
          </button>
        </div>
      </Section>

      <Section title="Tamanhos disponíveis">
        <div className="flex flex-wrap gap-2">
          {sizes.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5">
              <input {...register(`sizes.${i}.value`)} className="bg-transparent text-sm outline-none w-20" />
              <button type="button" onClick={() => sizes.remove(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => sizes.append({ value: "" })}
            className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-neon hover:text-neon">
            <Plus className="h-3 w-3" /> Tamanho
          </button>
        </div>
      </Section>

      <Section title="Imagens do produto">
        <ImageGalleryEditor
          value={imageUrls}
          onChange={(urls) => setValue("images", urls, { shouldDirty: true })}
        />
      </Section>

      <Section title="Avaliações">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rating (0–5)">
            <input {...register("rating")} type="number" step="0.1" min="0" max="5" className={inputCls} />
          </Field>
          <Field label="Total de avaliações">
            <input {...register("review_count")} type="number" min="0" className={inputCls} />
          </Field>
        </div>
      </Section>

      <Section title="SEO — Google & Redes Sociais">
        <p className="text-xs text-muted-foreground -mt-2 mb-2">
          Campos opcionais. Quando não preenchidos, o sistema usa o nome e a descrição curta do produto.
        </p>

        <Field label="Meta Title">
          <div className="relative">
            <input
              {...register("meta_title")}
              maxLength={60}
              placeholder={watchName ? `${watchName} — Secret Desire` : "Título para Google e redes sociais"}
              className={inputCls + " pr-14"}
            />
            <span
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums ${
                (watchMetaTitle?.length ?? 0) > 55 ? "text-orange-400" : "text-muted-foreground/60"
              }`}
            >
              {watchMetaTitle?.length ?? 0}/60
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/70">Padrão: "Nome — Secret Desire"</p>
        </Field>

        <Field label="Meta Description">
          <div className="relative">
            <textarea
              {...register("meta_description")}
              maxLength={160}
              rows={3}
              placeholder={watchShortDesc || "Descrição exibida nos resultados do Google e preview de compartilhamento"}
              className={inputCls + " h-auto resize-y py-3 pr-14"}
            />
            <span
              className={`pointer-events-none absolute right-3 top-3 text-[10px] tabular-nums ${
                (watchMetaDesc?.length ?? 0) > 150 ? "text-orange-400" : "text-muted-foreground/60"
              }`}
            >
              {watchMetaDesc?.length ?? 0}/160
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground/70">Padrão: descrição curta do produto</p>
        </Field>

        <Field label="Imagem Open Graph (URL)">
          <input
            {...register("og_image")}
            type="text"
            placeholder="https://… (padrão: primeira imagem do produto)"
            className={inputCls}
          />
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            Imagem exibida ao compartilhar no WhatsApp, Telegram e redes sociais. Recomendado: 1200×630 px.
          </p>
        </Field>

        {/* Preview snippet Google */}
        <div className="rounded-lg border border-border bg-background/40 p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Search className="h-3 w-3 text-muted-foreground/60" />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">Pré-visualização no Google</p>
          </div>
          <div className="rounded border border-border/50 bg-background p-3.5 font-sans">
            <p className="mb-0.5 text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
              secretdesire.com.br › produto › <span>{watchSlug || "slug-do-produto"}</span>
            </p>
            <p className="text-[15px] font-medium leading-snug text-blue-500 line-clamp-1">
              {watchMetaTitle?.trim() || (watchName ? `${watchName} — Secret Desire` : "Título do produto — Secret Desire")}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground line-clamp-2">
              {watchMetaDesc?.trim() || watchShortDesc || "A meta description do produto aparecerá aqui. Preencha o campo acima para personalizar."}
            </p>
          </div>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-md bg-neon px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60 glow transition-transform hover:scale-[1.01]"
        >
          {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : submitLabel}
        </button>
        <Link to="/admin/produtos" className="text-sm text-muted-foreground hover:text-foreground">Cancelar</Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="font-display font-semibold mb-4 text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-md border border-border bg-background/50 px-3 text-sm placeholder:text-muted-foreground focus:border-neon focus:outline-none focus:ring-1 focus:ring-neon transition";
