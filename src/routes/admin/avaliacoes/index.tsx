import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, BadgeCheck, Trash2, Check, X, Loader2, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getAdminReviews, updateReviewApproval, deleteReview } from "@/fns/reviews";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";
import type { Review } from "@/lib/types";

export const Route = createFileRoute("/admin/avaliacoes/")({
  head: () => ({ meta: [{ title: "Avaliações — Admin Secret Desire" }] }),
  component: AdminReviews,
});

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "fill-neon text-neon" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function AdminReviews() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => getAdminReviews(),
    enabled: !!user && profile?.role === "admin",
    staleTime: 60 * 1000,
  });

  const approveMut = useMutation({
    mutationFn: ({ reviewId, approved }: { reviewId: string; approved: boolean }) =>
      updateReviewApproval({ data: { reviewId, approved } }),
    onSuccess: (_, { approved }) => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success(approved ? "Avaliação aprovada" : "Avaliação ocultada");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  const deleteMut = useMutation({
    mutationFn: (reviewId: string) => deleteReview({ data: reviewId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-reviews"] });
      toast.success("Avaliação excluída");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro"),
  });

  if (loading || !profile) return null;

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <AdminLayout title="Avaliações">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard label="Total" value={String(reviews.length)} />
        <StatCard label="Aprovadas" value={String(approved.length)} color="text-neon" />
        <StatCard label="Pendentes" value={String(pending.length)} color={pending.length > 0 ? "text-yellow-400" : undefined} />
        <StatCard label="Nota média" value={avgRating} color="text-neon" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma avaliação ainda</p>
          <p className="text-sm text-muted-foreground mt-1">As avaliações dos clientes aparecem aqui.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Nota</th>
                <th className="px-4 py-3 text-left">Comentário</th>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reviews.map((review) => {
                const nameParts = review.customer_name.trim().split(" ");
                const displayName =
                  nameParts.length > 1
                    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                    : nameParts[0];

                return (
                  <tr key={review.id} className={`hover:bg-secondary/20 transition-colors ${!review.approved ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{review.customer_email}</p>
                      {review.verified_purchase && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-neon">
                          <BadgeCheck className="h-3 w-3" /> Verificada
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {review.product_slug ? (
                        <Link
                          to="/produto/$slug"
                          params={{ slug: review.product_slug }}
                          className="text-xs text-neon hover:underline"
                        >
                          {review.product_name}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">{review.product_name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Stars rating={review.rating} />
                      <span className="text-[10px] text-muted-foreground">{review.rating}/5</span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {review.comment || <em className="opacity-50">Sem comentário</em>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        review.approved
                          ? "border-neon/30 bg-neon/10 text-neon"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      }`}>
                        {review.approved ? "Aprovada" : "Oculta"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {review.approved ? (
                          <button
                            title="Ocultar"
                            onClick={() => approveMut.mutate({ reviewId: review.id, approved: false })}
                            disabled={approveMut.isPending}
                            className="flex h-7 w-7 items-center justify-center rounded border border-border hover:border-yellow-500 hover:text-yellow-400 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            title="Aprovar"
                            onClick={() => approveMut.mutate({ reviewId: review.id, approved: true })}
                            disabled={approveMut.isPending}
                            className="flex h-7 w-7 items-center justify-center rounded border border-border hover:border-neon hover:text-neon transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          title="Excluir"
                          onClick={() => {
                            if (confirm("Excluir esta avaliação?")) deleteMut.mutate(review.id);
                          }}
                          disabled={deleteMut.isPending}
                          className="flex h-7 w-7 items-center justify-center rounded border border-border hover:border-destructive hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );
}
