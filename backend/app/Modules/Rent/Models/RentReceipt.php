<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Quittance émise (loi 89-462 art. 21) : loyer et charges distingués, pièce figée. Une annulation d'encaissement qui
 * rouvre l'échéance la déclare nulle (`voided_at`) ; elle n'est ni supprimée ni modifiée autrement.
 * `active_installment_id` est une colonne générée : jamais écrite.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $installment_id
 * @property string $number
 * @property string $issued_document_id
 * @property string $stored_file_id
 * @property string $fingerprint
 * @property string $template_version
 * @property array<string, mixed> $snapshot
 * @property string $currency
 * @property Money $rent_amount
 * @property Money $charges_amount
 * @property Money $vat_amount
 * @property Money $total_amount
 * @property Carbon $issued_on
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property string|null $issued_by_user_id
 */
final class RentReceipt extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'rent_receipts';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'installment_id', 'number', 'issued_document_id', 'stored_file_id', 'fingerprint', 'template_version',
        'snapshot', 'currency', 'rent_amount', 'charges_amount', 'vat_amount', 'total_amount', 'issued_on', 'voided_at',
        'void_reason', 'issued_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'rent_amount' => MoneyCast::class.':currency',
            'charges_amount' => MoneyCast::class.':currency',
            'vat_amount' => MoneyCast::class.':currency',
            'total_amount' => MoneyCast::class.':currency',
            'issued_on' => 'date:Y-m-d',
            'voided_at' => 'datetime',
        ];
    }
}
