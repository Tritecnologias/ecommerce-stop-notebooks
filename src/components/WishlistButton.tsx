import { Heart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useWishlist } from "@/lib/useWishlist";

interface WishlistButtonProps {
  productId: string;
  productName: string;
  /** "card" = pequeno, sobre a imagem | "page" = maior, ao lado do título */
  variant?: "card" | "page";
  className?: string;
}

export function WishlistButton({
  productId,
  productName,
  variant = "card",
  className = "",
}: WishlistButtonProps) {
  const { isInWishlist, toggle, isPending, isLoggedIn } = useWishlist();
  const navigate = useNavigate();
  const inWishlist = isInWishlist(productId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      toast.info("Faça login para salvar favoritos");
      navigate({ to: "/login" });
      return;
    }

    toggle({ productId, inWishlist });

    if (inWishlist) {
      toast(`"${productName}" removido dos favoritos`, { icon: "🤍" });
    } else {
      toast.success(`"${productName}" salvo nos favoritos`, { icon: "❤️" });
    }
  };

  if (variant === "page") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
          inWishlist
            ? "border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
            : "border-border text-muted-foreground hover:border-rose-400 hover:text-rose-400"
        } ${className}`}
      >
        <Heart
          className={`h-4 w-4 transition-all ${inWishlist ? "fill-rose-500 text-rose-500 scale-110" : ""}`}
        />
        {inWishlist ? "Nos favoritos" : "Favoritar"}
      </button>
    );
  }

  // variant === "card"
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={inWishlist ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-all hover:bg-black/60 disabled:opacity-50 ${className}`}
    >
      <Heart
        className={`h-4 w-4 transition-all duration-200 ${
          inWishlist
            ? "fill-rose-500 text-rose-500 scale-110"
            : "text-white/90"
        }`}
      />
    </button>
  );
}
