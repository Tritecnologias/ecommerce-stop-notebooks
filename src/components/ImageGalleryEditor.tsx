import { useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { getProductImageUploadUrl } from "@/fns/storage";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_MB = 5;

type UploadSlot = {
  id: string;
  preview: string; // object URL — exibição imediata antes do upload terminar
  name: string;
};

// ─────────────────────────────────────────────────────────────────────────────
export function ImageGalleryEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragSrc = useRef<number | null>(null); // índice do thumbnail sendo arrastado

  const [slots, setSlots] = useState<UploadSlot[]>([]); // uploads em andamento
  const [dragOver, setDragOver] = useState<number | null>(null); // thumbnail alvo
  const [fileDropActive, setFileDropActive] = useState(false); // arquivo vindo de fora

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function uploadOne(file: File): Promise<string | null> {
    if (!ACCEPTED.includes(file.type)) {
      toast.error(`Tipo não suportado: "${file.type}". Use JPG, PNG ou WebP.`);
      return null;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`"${file.name}" excede ${MAX_MB} MB.`);
      return null;
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const preview = URL.createObjectURL(file);
    setSlots((s) => [...s, { id, preview, name: file.name }]);

    try {
      const { uploadUrl, publicUrl } = await getProductImageUploadUrl({
        data: { fileName: file.name, contentType: file.type },
      });

      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!res.ok) throw new Error(`Upload falhou (HTTP ${res.status})`);
      URL.revokeObjectURL(preview);
      return publicUrl;
    } catch (err) {
      URL.revokeObjectURL(preview);
      toast.error(err instanceof Error ? err.message : "Erro no upload");
      return null;
    } finally {
      setSlots((s) => s.filter((u) => u.id !== id));
    }
  }

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files).slice(0, 10);
    const results = await Promise.all(arr.map(uploadOne));
    const urls = results.filter(Boolean) as string[];
    if (urls.length > 0) onChange([...value, ...urls]);
  }

  // ── Drag-and-drop reorder (thumbnails) ────────────────────────────────────
  function onThumbDragStart(e: React.DragEvent, i: number) {
    dragSrc.current = i;
    e.dataTransfer.effectAllowed = "move";
    // Previne que o container interprete como file-drop
    e.stopPropagation();
  }

  function onThumbDragOver(e: React.DragEvent, i: number) {
    if (dragSrc.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragSrc.current !== i) setDragOver(i);
  }

  function onThumbDrop(e: React.DragEvent, i: number) {
    e.preventDefault();
    const src = dragSrc.current;
    dragSrc.current = null;
    setDragOver(null);
    if (src === null || src === i) return;
    const next = [...value];
    const [moved] = next.splice(src, 1);
    next.splice(i, 0, moved);
    onChange(next);
  }

  function onThumbDragEnd() {
    dragSrc.current = null;
    setDragOver(null);
  }

  // ── Drag-and-drop de arquivos sobre o container ───────────────────────────
  function onContainerDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setFileDropActive(true);
  }

  function onContainerDragLeave(e: React.DragEvent) {
    // Ignora quando o mouse passa sobre um filho
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setFileDropActive(false);
  }

  function onContainerDrop(e: React.DragEvent) {
    e.preventDefault();
    setFileDropActive(false);
    if (dragSrc.current !== null) return; // é reorder, não file-drop
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }

  const isEmpty = value.length === 0 && slots.length === 0;

  return (
    <div
      onDragOver={onContainerDragOver}
      onDragLeave={onContainerDragLeave}
      onDrop={onContainerDrop}
      className={[
        "rounded-xl border-2 border-dashed p-4 transition-colors",
        fileDropActive ? "border-neon bg-neon/5" : "border-border",
      ].join(" ")}
    >
      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = ""; // permite re-selecionar o mesmo arquivo
        }}
      />

      {/* Grade de thumbnails */}
      <div className="flex flex-wrap gap-3">

        {/* Imagens já salvas */}
        {value.map((url, i) => (
          <div
            key={`${url}-${i}`}
            draggable
            onDragStart={(e) => onThumbDragStart(e, i)}
            onDragOver={(e) => onThumbDragOver(e, i)}
            onDrop={(e) => onThumbDrop(e, i)}
            onDragEnd={onThumbDragEnd}
            className={[
              "group relative h-28 w-28 flex-none select-none overflow-hidden rounded-lg border-2",
              "cursor-grab active:cursor-grabbing transition-all duration-150",
              dragOver === i && dragSrc.current !== i
                ? "border-neon ring-2 ring-neon/30 scale-[1.06]"
                : i === 0
                ? "border-neon/60"
                : "border-border hover:border-foreground/30",
            ].join(" ")}
          >
            <img
              src={url}
              alt={`Imagem ${i + 1}`}
              className="h-full w-full object-cover pointer-events-none"
            />

            {/* Badge CAPA na primeira */}
            {i === 0 && (
              <div className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-neon px-2 py-0.5 text-[9px] font-bold text-black">
                <Star className="h-2.5 w-2.5 fill-black stroke-none" />
                CAPA
              </div>
            )}

            {/* Índice nas demais */}
            {i > 0 && (
              <div className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1 text-[9px] font-bold text-white">
                {i + 1}
              </div>
            )}

            {/* Overlay de hover — botão remover + hint arrastar */}
            <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-1.5">
              <div className="flex justify-end">
                <button
                  type="button"
                  title="Remover imagem"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(value.filter((_, j) => j !== i));
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/90 text-white shadow hover:bg-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/80">
                <GripVertical className="h-3.5 w-3.5" />
                <span>Arrastar</span>
              </div>
            </div>
          </div>
        ))}

        {/* Placeholders de upload em andamento */}
        {slots.map((slot) => (
          <div
            key={slot.id}
            className="relative h-28 w-28 flex-none overflow-hidden rounded-lg border-2 border-border"
          >
            <img
              src={slot.preview}
              alt=""
              className="h-full w-full object-cover opacity-30 pointer-events-none"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/50">
              <Loader2 className="h-6 w-6 animate-spin text-neon" />
              <span className="w-full px-2 text-center text-[9px] text-white/70 truncate">
                {slot.name}
              </span>
            </div>
          </div>
        ))}

        {/* Botão adicionar */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-28 flex-none flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-neon hover:bg-neon/5 hover:text-neon"
        >
          <ImagePlus className="h-6 w-6" />
          <span className="text-center text-[10px] font-medium leading-tight">
            {isEmpty ? "Adicionar\nimagem" : "+ Imagem"}
          </span>
        </button>
      </div>

      {/* Instrução contextual */}
      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
        {isEmpty
          ? "Clique em + ou arraste arquivos aqui · JPG, PNG, WebP, GIF · máx. 5 MB por imagem"
          : "Arraste os thumbnails para reordenar · A primeira imagem é a capa · Solte arquivos aqui para adicionar"}
      </p>
    </div>
  );
}
