import { Autocomplete } from "@/components/ui/Autocomplete";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { DOCUMENT_CATEGORIES } from "@/lib/categories";

export function DocumentMetaFields({
  categoryId,
  notesId,
  category,
  notes,
  onCategory,
  onNotes,
}: {
  categoryId: string;
  notesId: string;
  category: string;
  notes: string;
  onCategory: (value: string) => void;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <Field label="Category" htmlFor={categoryId}>
        <Autocomplete
          id={categoryId}
          value={category}
          onChange={onCategory}
          options={DOCUMENT_CATEGORIES.map((item) => ({
            value: item,
            label: item,
          }))}
          placeholder="Uncategorized"
          allowClear
        />
      </Field>
      <Field
        label="Notes"
        htmlFor={notesId}
        hint="Optional. Shown in the library after upload."
      >
        <Textarea
          id={notesId}
          value={notes}
          maxLength={280}
          rows={3}
          placeholder="Short description for this file"
          onChange={(event) => onNotes(event.target.value)}
        />
      </Field>
    </div>
  );
}
