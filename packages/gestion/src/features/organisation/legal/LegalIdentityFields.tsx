'use client';

import { Alert, Checkbox, Select, TextField } from '@eguardimmo/ui';
import { SectionCard } from '../../locataires/kit';
import type { ZodForm } from '../../locataires/kit/useZodForm';
import { parseCurrency } from './form';
import type { LegalDraft, LegalTextField } from './form';
import { VAT_REGIMES } from './model';
import type { LegalIdentityInput, VatRegime } from './model';

const REGIME_LABEL: Record<VatRegime, string> = { normal: 'TVA normale', franchise: 'Franchise en base de TVA' };
const regimeOptions = VAT_REGIMES.map((value) => ({ value, label: REGIME_LABEL[value] }));
const isRegime = (value: string): value is VatRegime => VAT_REGIMES.some((regime) => regime === value);

type Form = ZodForm<LegalDraft, LegalIdentityInput>;

export function LegalIdentityFields({ form, currency, readOnly }: { form: Form; currency: string | null; readOnly: boolean }) {
  const text = (name: LegalTextField, label: string, { placeholder = '', ...extra }: { placeholder?: string; hint?: string; inputMode?: 'numeric' | 'decimal' } = {}) => (
    <TextField
      label={label}
      placeholder={placeholder}
      value={form.values[name]}
      error={form.error(name)}
      readOnly={readOnly}
      onChange={(event) => { form.setValue(name, event.target.value); }}
      onBlur={() => { form.touch(name); }}
      {...extra}
    />
  );
  const symbol = parseCurrency(currency) === 'XOF' ? 'FCFA' : currency === 'EUR' || currency === null ? '€' : currency;
  return (
    <>
      <SectionCard id="legal-identite" title="Identité">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {text('legalName', 'Raison sociale *', { placeholder: 'Ex. Agence du Port' })}
          {text('legalForm', 'Forme juridique', { placeholder: 'Ex. SARL' })}
          {text('siren', 'SIREN *', { inputMode: 'numeric', placeholder: 'Ex. 123 456 782' })}
          {text('siret', 'SIRET', { inputMode: 'numeric', placeholder: 'Ex. 123 456 782 00019' })}
          {text('vatNumber', 'Numéro de TVA intracommunautaire', { placeholder: 'Ex. FR12345678901' })}
          {text('registryCity', 'Ville d’immatriculation', { placeholder: 'Ex. Marseille' })}
          {text('shareCapital', `Capital social (${symbol})`, { inputMode: 'decimal', placeholder: 'Ex. 20000' })}
        </div>
      </SectionCard>
      <SectionCard id="legal-adresse" title="Siège">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {text('line1', 'Adresse *', { placeholder: 'Ex. 24 avenue de la République' })}
          {text('line2', 'Complément d’adresse')}
          {text('postalCode', 'Code postal *', { placeholder: 'Ex. 13002' })}
          {text('city', 'Ville *', { placeholder: 'Ex. Marseille' })}
          {text('country', 'Pays *', { placeholder: 'FR', hint: 'Code à deux lettres.' })}
        </div>
      </SectionCard>
      <SectionCard id="legal-carte" title="Carte professionnelle et garantie">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {text('professionalCardNumber', 'Numéro de carte professionnelle')}
          {text('professionalCardIssuer', 'Délivrée par')}
          {text('guaranteeProvider', 'Garant financier')}
          {text('guaranteeAmount', `Montant de la garantie (${symbol})`, { inputMode: 'decimal' })}
        </div>
      </SectionCard>
      <SectionCard id="legal-facturation" title="Facturation">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Select
            label="Régime de TVA *"
            placeholder="Choisir un régime"
            value={form.values.vatRegime}
            disabled={readOnly}
            options={regimeOptions}
            onValueChange={(value) => { if (isRegime(value)) form.setValue('vatRegime', value); }}
          />
          {text('paymentTermsDays', 'Délai de paiement (jours)', { inputMode: 'numeric', placeholder: 'Ex. 30' })}
        </div>
        <Checkbox label="TVA sur les débits" checked={form.values.vatOnDebits} disabled={readOnly} onChange={(event) => { form.setValue('vatOnDebits', event.target.checked); }} />
        {form.error('vatRegime') ? <Alert tone="danger" title="Régime de TVA">{form.error('vatRegime')}</Alert> : null}
      </SectionCard>
    </>
  );
}
