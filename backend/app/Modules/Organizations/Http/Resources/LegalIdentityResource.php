<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Resources;

use App\Modules\Organizations\Models\OrganizationLegalIdentity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Money\Money;

/**
 * @property OrganizationLegalIdentity $resource
 */
final class LegalIdentityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $i = $this->resource;

        return [
            'legal_name' => $i->legal_name,
            'address' => $i->address,
            'siren' => $i->siren,
            'siret' => $i->siret,
            'vat_number' => $i->vat_number,
            'legal_form' => $i->legal_form,
            'share_capital' => self::money($i->share_capital),
            'registry_city' => $i->registry_city,
            'professional_card_number' => $i->professional_card_number,
            'professional_card_issuer' => $i->professional_card_issuer,
            'guarantee_provider' => $i->guarantee_provider,
            'guarantee_amount' => self::money($i->guarantee_amount),
            'vat_regime' => $i->vat_regime->value,
            'vat_on_debits' => $i->vat_on_debits,
            'payment_terms_days' => $i->payment_terms_days,
        ];
    }

    /**
     * @return array{amount: int, currency: string}|null
     */
    private static function money(?Money $montant): ?array
    {
        return $montant === null ? null : ['amount' => (int) $montant->getAmount(), 'currency' => $montant->getCurrency()->getCode()];
    }
}
