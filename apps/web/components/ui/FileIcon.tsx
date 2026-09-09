import { fileKind, type FileKind } from "@/lib/file-kind";
import { cn } from "@/lib/cn";

const META: Record<FileKind, { label: string; bar: string; ring: string }> = {
  pdf: { label: "PDF", bar: "bg-[#e5252a]", ring: "ring-[#f0b4b4]" },
  docx: { label: "DOC", bar: "bg-[#2b579a]", ring: "ring-[#b7c9e2]" },
  xlsx: { label: "XLS", bar: "bg-[#1d6f42]", ring: "ring-[#b7d4c4]" },
  csv: { label: "CSV", bar: "bg-[#0f9d58]", ring: "ring-[#b7dcc8]" },
  md: { label: "MD", bar: "bg-primary", ring: "ring-primary-200" },
  txt: { label: "TXT", bar: "bg-[#667085]", ring: "ring-[#d0d5dd]" },
  image: { label: "IMG", bar: "bg-[#f79009]", ring: "ring-[#f7d5a8]" },
  file: { label: "FILE", bar: "bg-[#667085]", ring: "ring-line" },
};

const SIZES = {
  sm: {
    box: "h-8 w-6",
    fold: "h-2 w-2",
    bar: "mx-0.5 mb-0.5 rounded-[2px] py-px text-[6px] leading-none",
  },
  md: {
    box: "h-10 w-8",
    fold: "h-2.5 w-2.5",
    bar: "mx-0.5 mb-1 rounded-[3px] py-0.5 text-[7px] leading-none",
  },
  lg: {
    box: "h-14 w-11",
    fold: "h-3.5 w-3.5",
    bar: "mx-1 mb-1.5 rounded-[3px] py-0.5 text-[8px] leading-none",
  },
};

export function FileIcon({
  filename,
  mime,
  size = "md",
}: {
  filename: string;
  mime?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const type = fileKind(filename, mime);
  const meta = META[type];
  const dim = SIZES[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 flex-col justify-end overflow-hidden rounded-[5px] bg-white shadow-sm ring-1",
        dim.box,
        meta.ring,
      )}
      aria-hidden="true"
      title={meta.label}
    >
      <span
        className={cn(
          "absolute top-0 right-0 bg-[#eef1f4]",
          dim.fold,
        )}
        style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
      />
      <span
        className={cn(
          "text-center font-bold tracking-wide text-white",
          dim.bar,
          meta.bar,
        )}
      >
        {meta.label}
      </span>
    </span>
  );
}
