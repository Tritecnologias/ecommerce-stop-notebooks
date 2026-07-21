import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

// ─── Carrega só os IDs da wishlist (leve, compartilhado entre todos os cards) ──
export function useWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: wishlistIds = new Set<string>() } = useQuery({
    queryKey: ["wishlist-ids", user?.id],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);
      return new Set((data ?? []).map((w) => w.product_id as string));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const toggleMut = useMutation({
    mutationFn: async ({
      productId,
      inWishlist,
    }: {
      productId: string;
      inWishlist: boolean;
    }) => {
      if (!user) throw new Error("login_required");
      if (inWishlist) {
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase
          .from("wishlists")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw new Error(error.message);
      }
    },

    // Atualização otimista — o coração muda instantaneamente
    onMutate: async ({ productId, inWishlist }) => {
      await qc.cancelQueries({ queryKey: ["wishlist-ids", user?.id] });
      const prev = qc.getQueryData<Set<string>>(["wishlist-ids", user?.id]) ?? new Set<string>();
      const next = new Set(prev);
      if (inWishlist) next.delete(productId);
      else next.add(productId);
      qc.setQueryData(["wishlist-ids", user?.id], next);
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      // Rollback otimista em caso de erro
      if (ctx?.prev) qc.setQueryData(["wishlist-ids", user?.id], ctx.prev);
    },

    onSuccess: () => {
      // Invalida a página de favoritos se estiver ativa
      qc.invalidateQueries({ queryKey: ["wishlist", user?.id] });
    },
  });

  return {
    wishlistIds,
    isInWishlist: (productId: string) => wishlistIds.has(productId),
    toggle: toggleMut.mutate,
    isPending: toggleMut.isPending,
    isLoggedIn: !!user,
  };
}
