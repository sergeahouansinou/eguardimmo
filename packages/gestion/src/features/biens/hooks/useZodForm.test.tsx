import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useZodForm } from './useZodForm';

const schema = z.object({
  name: z.string().trim().min(1, 'Champ requis'),
  age: z.string().trim().transform((text, context) => {
    const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isInteger(value)) {
      context.addIssue({ code: 'custom', message: 'Entier attendu' });
      return z.NEVER;
    }
    return value;
  }),
});

function Harness({ onValid }: { onValid: (data: { name: string; age: number }, submitter: HTMLElement | null) => void }) {
  const form = useZodForm(schema, { name: '', age: '' });
  const name = form.field('name');
  const age = form.field('age');
  return (
    <form noValidate onSubmit={form.submit(onValid)}>
      <label>
        Nom
        <input value={name.value} onChange={name.onChange} />
      </label>
      {name.error ? <p>{name.error}</p> : null}
      <label>
        Âge
        <input value={age.value} onChange={age.onChange} />
      </label>
      {age.error ? <p>{age.error}</p> : null}
      <button type="button" onClick={() => { form.set('name', 'Défini'); }}>Définir</button>
      <button type="button" onClick={() => { form.reset({ name: '', age: '' }); }}>Réinitialiser</button>
      <button type="submit">Valider</button>
      <output aria-label="Erreurs">{String(form.hasErrors)}</output>
    </form>
  );
}

describe('useZodForm', () => {
  it('n’affiche aucune erreur avant la première soumission', () => {
    render(<Harness onValid={vi.fn()} />);
    expect(screen.queryByText('Champ requis')).toBeNull();
    expect(screen.getByLabelText('Erreurs').textContent).toBe('false');
  });

  it('bloque la soumission invalide et affiche la première erreur de chaque champ', async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(screen.getByText('Champ requis')).toBeTruthy();
    expect(screen.getByText('Entier attendu')).toBeTruthy();
    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Erreurs').textContent).toBe('true');
  });

  it('transmet les données transformées et le bouton déclencheur quand tout est valide', async () => {
    const onValid = vi.fn();
    render(<Harness onValid={onValid} />);
    await userEvent.type(screen.getByLabelText('Nom'), '  Ada  ');
    await userEvent.type(screen.getByLabelText('Âge'), '36');
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(onValid.mock.calls[0]?.[0]).toEqual({ name: 'Ada', age: 36 });
    expect((onValid.mock.calls[0]?.[1] as HTMLElement).textContent).toBe('Valider');
  });

  it('corrige les erreurs au fil de la saisie après une tentative', async () => {
    render(<Harness onValid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));
    await userEvent.type(screen.getByLabelText('Nom'), 'Ada');
    expect(screen.queryByText('Champ requis')).toBeNull();
  });

  it('set modifie une valeur et reset efface valeurs et erreurs', async () => {
    render(<Harness onValid={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Définir' }));
    expect(screen.getByLabelText<HTMLInputElement>('Nom').value).toBe('Défini');
    await userEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(screen.getByText('Entier attendu')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(screen.getByLabelText<HTMLInputElement>('Nom').value).toBe('');
    expect(screen.queryByText('Entier attendu')).toBeNull();
  });
});
