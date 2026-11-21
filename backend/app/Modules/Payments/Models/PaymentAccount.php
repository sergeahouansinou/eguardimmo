<?php

declare(strict_types=1);

namespace App\Modules\Payments\Models;

use App\Modules\Payments\Enums\PaymentAccountStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Compte connecté de l'organisation chez le PSP : l'argent va du locataire à ce compte, jamais chez eGuardImmo.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $provider
 * @property string $provider_account_id
 * @property PaymentAccountStatus $status
 * @property Carbon|null $onboarded_at
 */
final class PaymentAccount extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['provider', 'provider_account_id', 'status', 'onboarded_at'];

    protected function casts(): array
    {
        return ['status' => PaymentAccountStatus::class, 'onboarded_at' => 'datetime'];
    }
}
