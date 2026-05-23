import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Truck, ShieldCheck } from "lucide-react";
import { PRODUCTS } from "@/lib/products";
import { STORE } from "@/lib/store";
import { ProductCard } from "@/components/ProductCard";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 gradient-hero opacity-70" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:gap-8 md:px-6 md:py-24">
          <div className="animate-fade-in">
            <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 bg-neon/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neon">
              <Sparkles className="h-3.5 w-3.5" /> Nova coleção 2026
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Aromas que <span className="neon-text">marcam</span>.
              <br />Entrega rápida.
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground md:text-lg">
              {STORE.description}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#colecao"
                className="group inline-flex items-center gap-2 rounded-md bg-neon px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:scale-[1.02] glow"
              >
                Ver coleção <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href="#bestsellers" className="rounded-md border border-border px-6 py-3 text-sm font-semibold hover:border-neon hover:text-neon transition-colors">
                Mais vendidos
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4 text-neon" /> Frete grátis acima de R$149</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-neon" /> Compra 100% segura</span>
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className="absolute -inset-8 rounded-full bg-neon/20 blur-3xl" />
            <img
              src={heroImg}
              alt="Body splash BodySplashers"
              width={1600}
              height={1000}
              className="relative w-full rounded-xl border border-border object-cover"
            />
          </div>
        </div>
      </section>

      {/* COLEÇÃO */}
      <section id="colecao" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-neon">Catálogo</p>
            <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">A coleção completa</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* BEST SELLERS */}
      <section id="bestsellers" className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <p className="text-xs uppercase tracking-widest text-neon">Top da loja</p>
          <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">Mais vendidos</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.filter((p) => p.tag === "Mais Vendido").map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* NOVIDADES */}
      <section id="novidades" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <p className="text-xs uppercase tracking-widest text-neon">Acabou de chegar</p>
        <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">Novidades</h2>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.filter((p) => p.tag === "Lançamento").map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-neon">
            Voltar ao topo ↑
          </Link>
        </div>
      </section>
    </>
  );
}
