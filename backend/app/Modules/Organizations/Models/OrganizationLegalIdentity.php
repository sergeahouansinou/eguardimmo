<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Models;

use App\Modules\Organizations\Enums\VatRegime;
use App\Shared\Audit\Auditable;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Money\Money;

/**
 * Identité légale du siège : mentions obligatoires des pièces émises (facture, loi Hoguet).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $legal_name
 * @property array{line1: string, line2?: string|null, postal_code: string, city: string, country: string} $address
 * @property string $siren
 * @property string|null $siret
 * @property string|null $vat_number
 * @property string|null $legal_form
 * @property Money|null $share_capital
 * @property string $currency
 * @property string|null $registry_city
 * @property string|null $professional_card_number
 * @property string|null $professional_card_issuer
 * @property string|null $guarantee_provider
 * @property Money|null $guarantee_amount
 * @property VatRegime $vat_regime
 * @property bool $vat_on_debits
 * @property int|null $payment_terms_days
 */
final class OrganizationLegalIdentity extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['legal_name', 'address', 'siren', 'siret', 'vat_number'];
    }

    protected function casts(): array
    {
        return [
            'address' => 'array',
            'share_capital' => MoneyCast::class.':currency',
            'guarantee_amount' => MoneyCast::class.':currency',
            'vat_regime' => VatRegime::class,
            'vat_on_debits' => 'boolean',
            'payment_terms_days' => 'integer',
        ];
    }
}
