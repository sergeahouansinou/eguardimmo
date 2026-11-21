<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use App\Modules\Payments\Enums\OnlinePaymentMethod;
use App\Modules\Payments\Enums\OnlinePaymentStatus;
use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Intention de paiement d'un locataire : le montant est le reste dû lu au grand livre au moment de la création, jamais celui du client.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $party_id
 * @property string $created_by_user_id
 * @property list<string> $installment_ids
 * @property string $installments_hash
 * @property Money $amount
 * @property string $currency
 * @property OnlinePaymentMethod $method
 * @property OnlinePaymentStatus $status
 * @property string $provider
 * @property string|null $provider_reference
 * @property string|null $checkout_url
 * @property string $client_id
 * @property string|null $failure_code
 * @property Carbon|null $confirmed_at
 * @property Carbon $created_at
 */
final class OnlinePayment extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'lease_id', 'party_id', 'created_by_user_id', 'installment_ids', 'installments_hash', 'amount', 'currency', 'method', 'status',
        'provider', 'provider_reference', 'checkout_url', 'client_id', 'failure_code', 'confirmed_at',
    ];

    protected function casts(): array
    {
        return [
            'installment_ids' => 'array',
            'amount' => MoneyCast::class.':currency',
            'method' => OnlinePaymentMethod::class,
            'status' => OnlinePaymentStatus::class,
            'confirmed_at' => 'datetime',
        ];
    }
}
