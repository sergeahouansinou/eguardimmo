import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoA11yViolations } from '../../../../test/axe';
import { MAX_UPLOAD_BYTES } from '../schemas/common';
import { FilePicker, validateFiles } from './FilePicker';
import type { PickedFile } from './FilePicker';

const ACCEPT = ['.pdf', 'image/png'] as const;

function fileOf(name: string, type: string, size = 10): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateFiles', () => {
  it('accepte une extension ou un type MIME autorisé', () => {
    const { accepted, errors } = validateFiles([fileOf('Bail.PDF', 'application/pdf'), fileOf('photo.bin', 'image/png')], ACCEPT);
    expect(accepted.map((file) => file.name)).toEqual(['Bail.PDF', 'photo.bin']);
    expect(errors).toEqual([]);
  });

  it('refuse un format inconnu, un fichier vide et un fichier trop gros', () => {
    const { accepted, errors } = validateFiles(
      [fileOf('virus.exe', 'application/octet-stream'), fileOf('vide.pdf', 'application/pdf', 0), fileOf('gros.pdf', 'application/pdf', MAX_UPLOAD_BYTES + 1)],
      ACCEPT,
    );
    expect(accepted).toEqual([]);
    expect(errors).toEqual([
      '« virus.exe » : format non accepté.',
      '« vide.pdf » : le fichier est vide.',
      expect.stringContaining('« gros.pdf » :'),
    ]);
  });

  it('accepte un fichier à la taille maximale exacte', () => {
    expect(validateFiles([fileOf('limite.pdf', 'application/pdf', MAX_UPLOAD_BYTES)], ACCEPT).accepted).toHaveLength(1);
  });
});

describe('FilePicker', () => {
  function setup(multiple = false) {
    const onPick = vi.fn<(files: PickedFile[]) => void>();
    const view = render(<FilePicker label="Déposer ici" hint="PDF ou PNG" accept={ACCEPT} multiple={multiple} onPick={onPick} />);
    return { onPick, ...view };
  }

  it('remonte le fichier choisi', async () => {
    const { onPick } = setup();
    await userEvent.upload(screen.getByLabelText('Déposer ici'), fileOf('bail.pdf', 'application/pdf'));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]?.[0][0]).toMatchObject({ name: 'bail.pdf', sizeBytes: 10 });
  });

  it('signale un format refusé sans rien remonter', async () => {
    const { onPick } = setup();
    await userEvent.upload(screen.getByLabelText('Déposer ici'), fileOf('virus.exe', 'application/octet-stream'), { applyAccept: false });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('« virus.exe » : format non accepté.')).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('ne retient que le premier fichier hors mode multiple', async () => {
    const { onPick } = setup();
    await userEvent.upload(screen.getByLabelText('Déposer ici'), [fileOf('a.pdf', 'application/pdf'), fileOf('b.pdf', 'application/pdf')]);
    expect(onPick.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('remonte plusieurs fichiers en mode multiple et signale ceux refusés', async () => {
    const { onPick } = setup(true);
    await userEvent.upload(screen.getByLabelText('Déposer ici'), [fileOf('a.pdf', 'application/pdf'), fileOf('b.exe', 'application/octet-stream')], { applyAccept: false });
    expect(onPick.mock.calls[0]?.[0].map((file) => file.name)).toEqual(['a.pdf']);
    expect(screen.getByText('« b.exe » : format non accepté.')).toBeTruthy();
  });

  it('ne présente aucune violation d’accessibilité', async () => {
    const { container } = setup();
    await expectNoA11yViolations(container);
  });
});
