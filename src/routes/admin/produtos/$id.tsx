import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { updateProduct, getAdminProductById } from "@/fns/products";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";
import { ProductForm, type ProductFormValues } from "./-form";
import { StockMovements } from "./-stock-movements";

export const Route = createFileRoute("/admin/produtos/$id")({
  head: () => ({ meta: [{ title: "Editar produto — Admin" }] }),
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const { data: product, isLoading } = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => getAdminProductById({ data: id }),
    enabled: !!user && profile?.role === "admin",
  });

  const mutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      updateProduct({
        data: {
          id,
          data: {
            ...data,
            old_price: data.old_price ?? null,
            tag: data.tag ?? null,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product", id] });
      toast.success("Produto atualizado!");
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading || !profile || isLoading) {
    return (
      <AdminLayout title="Editar produto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout title="Produto não encontrado">
        <p className="text-muted-foreground">Este produto não existe.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Editar: ${product.name}`}>
      <ProductForm
        defaultValues={product}
        onSubmit={(data) => mutation.mutate(data)}
        isSubmitting={mutation.isPending}
        submitLabel="Salvar alterações"
      />
      <div className="mt-6">
        <StockMovements productId={id} productName={product.name} />
      </div>
    </AdminLayout>
  );
}
