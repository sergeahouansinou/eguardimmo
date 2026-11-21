<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Data\UpdateLegalIdentityData;
use App\Modules\Organizations\Enums\VatRegime;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UpdateLegalIdentityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Montants en unités mineures ; la devise vient du pays de l'organisation.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'legal_name' => ['required', 'string', 'max:200'],
            'address' => ['required', 'array:line1,line2,postal_code,city,country'],
            'address.line1' => ['required', 'string', 'max:200'],
            'address.line2' => ['nullable', 'string', 'max:200'],
            'address.postal_code' => ['required', 'string', 'max:12'],
            'address.city' => ['required', 'string', 'max:120'],
            'address.country' => ['required', 'string', 'regex:/^[A-Z]{2}$/'],
            'siren' => ['required', 'string', 'regex:/^[0-9]{9}$/'],
            'siret' => ['nullable', 'string', 'regex:/^[0-9]{14}$/'],
            'vat_number' => ['nullable', 'string', 'regex:/^[A-Z]{2}[A-Z0-9]{2,12}$/'],
            'legal_form' => ['nullable', 'string', 'max:80'],
            'share_capital' => ['nullable', 'integer', 'min:0', 'max:100000000000000'],
            'registry_city' => ['nullable', 'string', 'max:120'],
            'professional_card_number' => ['nullable', 'string', 'max:60'],
            'professional_card_issuer' => ['nullable', 'string', 'max:120'],
            'guarantee_provider' => ['nullable', 'string', 'max:160'],
            'guarantee_amount' => ['nullable', 'integer', 'min:0', 'max:100000000000000'],
            'vat_regime' => ['required', Rule::enum(VatRegime::class)],
            'vat_on_debits' => ['required', 'boolean'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:120'],
        ];
    }

    public function toData(): UpdateLegalIdentityData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        /** @var array{line1: string, line2?: string|null, postal_code: string, city: string, country: string} $adresse */
        $adresse = $v['address'];

        return new UpdateLegalIdentityData(
            legalName: trim((string) $v['legal_name']),
            address: [
                'line1' => trim($adresse['line1']),
                'line2' => isset($adresse['line2']) ? trim($adresse['line2']) : null,
                'postal_code' => trim($adresse['postal_code']),
                'city' => trim($adresse['city']),
                'country' => $adresse['country'],
            ],
            siren: (string) $v['siren'],
            siret: isset($v['siret']) ? (string) $v['siret'] : null,
            vatNumber: isset($v['vat_number']) ? (string) $v['vat_number'] : null,
            legalForm: isset($v['legal_form']) ? trim((string) $v['legal_form']) : null,
            shareCapital: isset($v['share_capital']) ? (int) $v['share_capital'] : null,
            registryCity: isset($v['registry_city']) ? trim((string) $v['registry_city']) : null,
            professionalCardNumber: isset($v['professional_card_number']) ? trim((string) $v['professional_card_number']) : null,
            professionalCardIssuer: isset($v['professional_card_issuer']) ? trim((string) $v['professional_card_issuer']) : null,
            guaranteeProvider: isset($v['guarantee_provider']) ? trim((string) $v['guarantee_provider']) : null,
            guaranteeAmount: isset($v['guarantee_amount']) ? (int) $v['guarantee_amount'] : null,
            vatRegime: VatRegime::from((string) $v['vat_regime']),
            vatOnDebits: (bool) $v['vat_on_debits'],
            paymentTermsDays: isset($v['payment_terms_days']) ? (int) $v['payment_terms_days'] : null,
        );
    }
}
