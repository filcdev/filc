import { Button } from '@filcdev/ui/components/button';
import { Label } from '@filcdev/ui/components/label';
import { Trash, Upload } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type ImageFieldLabels = {
  hint: string;
  onSave: string;
  remove: string;
  /** The field's own `<Label>` text. */
  title: string;
  upload: string;
};

type ImageFieldProps = {
  /** Null while creating: there is no row to upload against yet. */
  id: string | null;
  /** The file picked locally, uploaded together with the save. */
  file: File | null;
  imageKey: string | null;
  imageUrl: string | null;
  isRemoving: boolean;
  /** Dialog-specific copy: the two dialogs name the same control differently. */
  labels: ImageFieldLabels;
  onFileChange: (file: File | null) => void;
  onRemove: (id: string) => void;
  upload: (file: File, id: string) => Promise<unknown>;
};

/**
 * The picture field the event and announcement dialogs share: preview, file
 * picker, and — for a row that already exists — an immediate upload and a
 * remove button. A newly picked file is previewed from a local object URL until
 * the dialog saves it.
 */
export function ImageField({
  id,
  file,
  imageKey,
  imageUrl,
  isRemoving,
  labels,
  onFileChange,
  onRemove,
  upload,
}: ImageFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!file) {
      setPickedPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPickedPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    if (!(id && file)) {
      return;
    }
    setIsUploading(true);
    try {
      await upload(file, id);
      onFileChange(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch {
      // The hook toasted the failure; keep the file picked for a retry.
    } finally {
      setIsUploading(false);
    }
  };

  const previewUrl = pickedPreview ?? imageUrl;

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{labels.title}</Label>
      {previewUrl && (
        <img
          alt=""
          className="max-h-48 w-full rounded-md object-contain"
          height={600}
          src={previewUrl}
          width={800}
        />
      )}
      <input
        accept="image/png,image/jpeg,image/webp"
        className="w-full cursor-pointer rounded-lg border-2 border-muted-foreground/25 border-dashed p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-medium file:text-secondary-foreground hover:border-muted-foreground/50"
        id={inputId}
        onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        ref={inputRef}
        type="file"
      />
      {id && (
        <div className="flex items-center gap-2">
          <Button
            disabled={!(file && !isUploading)}
            onClick={handleUpload}
            size="sm"
            type="button"
          >
            <Upload className="h-4 w-4" />
            {labels.upload}
          </Button>
          {imageKey && (
            <Button
              disabled={isRemoving}
              onClick={() => onRemove(id)}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Trash className="h-4 w-4" />
              {labels.remove}
            </Button>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-xs">{labels.hint}</p>
      {!id && <p className="text-muted-foreground text-xs">{labels.onSave}</p>}
    </div>
  );
}
