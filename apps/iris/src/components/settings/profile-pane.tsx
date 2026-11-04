import { AVATAR_EXTENSIONS } from '@filcdev/api/domains/users';
import { useSession } from '@filcdev/auth/client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@filcdev/ui/components/avatar';
import { Button } from '@filcdev/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Label } from '@filcdev/ui/components/label';
import { useForm, useStore } from '@tanstack/react-form';
import { Trash, Upload } from 'lucide-react';
import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRemoveAvatar, useUploadAvatar } from '@/hooks/profile';
import { AvatarCropper, type AvatarCropperHandle } from './avatar-cropper';

/** The content types the file picker offers; the server enforces the same list. */
const ACCEPTED_TYPES = Object.keys(AVATAR_EXTENSIONS).join(',');

/**
 * The "Profile" pane: the caller's own picture. A picked file is cropped in the
 * browser first — the upload is always a square WebP, well under the server's
 * cap — and both writes take effect immediately, so unlike the General pane
 * there is no dialog-wide save.
 */
export function ProfilePane() {
  const { t } = useTranslation();
  const formId = useId();
  const inputId = useId();
  const cropper = useRef<AvatarCropperHandle | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const { data: session } = useSession();
  const imageUrl = session?.user.image ?? null;
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();

  const form = useForm({
    defaultValues: { file: null } as { file: File | null },
    onSubmit: async ({ value }) => {
      if (!value.file) {
        return;
      }
      const cropped = await cropper.current?.export();
      if (!cropped) {
        return;
      }
      await upload.mutateAsync({ file: cropped });
      form.reset();
      // The form drops the file, the native input keeps its name: clear both so
      // the pane shows the new picture rather than the file it came from.
      if (input.current) {
        input.current.value = '';
      }
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!value.file) {
          return t('profile.picture.pickError');
        }
        if (!AVATAR_EXTENSIONS[value.file.type]) {
          return t('profile.picture.typeError');
        }
        return undefined;
      },
    },
  });

  const file = useStore(form.store, (state) => state.values.file);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.picture.title')}</CardTitle>
        <CardDescription>{t('profile.picture.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            form.handleSubmit();
          }}
        >
          {file ? (
            <AvatarCropper file={file} ref={cropper} />
          ) : (
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 shrink-0 border">
                <AvatarImage
                  alt={t('profile.picture.title')}
                  src={imageUrl ?? undefined}
                />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {t('profile.picture.empty')}
                </AvatarFallback>
              </Avatar>
              <p className="text-muted-foreground text-sm">
                {imageUrl
                  ? t('profile.picture.current')
                  : t('profile.picture.emptyHint')}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            <Label htmlFor={inputId}>{t('profile.picture.choose')}</Label>
            <input
              accept={ACCEPTED_TYPES}
              className="w-full cursor-pointer rounded-lg border-2 border-muted-foreground/25 border-dashed p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:font-medium file:text-secondary-foreground hover:border-muted-foreground/50"
              id={inputId}
              onChange={(event) =>
                form.setFieldValue('file', event.target.files?.[0] ?? null)
              }
              ref={input}
              type="file"
            />
            <p className="text-muted-foreground text-xs">
              {t('profile.picture.hint')}
            </p>
          </div>

          <form.Subscribe selector={(state) => state.errorMap.onSubmit}>
            {(error) =>
              error ? (
                <p className="mt-4 text-destructive text-xs">{String(error)}</p>
              ) : null
            }
          </form.Subscribe>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button disabled={!(file && !isSubmitting)} type="submit">
              <Upload className="h-4 w-4" />
              {t('profile.picture.upload')}
            </Button>
            {imageUrl && (
              <Button
                disabled={remove.isPending}
                onClick={() => remove.mutate({})}
                type="button"
                variant="destructive"
              >
                <Trash className="h-4 w-4" />
                {t('profile.picture.remove')}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
