import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { createProduct } from "@/fns/products";
import { AdminLayout } from "@/routes/admin/index";
import { toast } from "sonner";
import { ProductForm, type ProductFormValues } from "./-form";

export const Route = createFileRoute("/admin/produtos/novo")({
  head: () => ({ meta: [{ title: "Novo produto — Admin" }] }),
  component: NewProduct,
});

function NewProduct() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login" });
      else if (profile && profile.role !== "admin") navigate({ to: "/" });
    }
  }, [user, profile, loading, navigate]);

  const mutation = useMutation({
    mutationFn: (data: ProductFormValues) =>
      createProduct({
        data: {
          ...data,
          old_price: data.old_price ?? null,
          tag: data.tag ?? null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Produto criado!");
      navigate({ to: "/admin/produtos" });
    },
    onError: (err) => toast.error(err.message),
  });

  if (loading || !profile) return null;

  return (
    <AdminLayout title="Novo produto">
      <ProductForm
        onSubmit={(data) => mutation.mutate(data)}
        isSubmitting={mutation.isPending}
        submitLabel="Criar produto"
      />
    </AdminLayout>
  );
}
