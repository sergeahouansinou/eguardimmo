<?php

declare(strict_types=1);

namespace App\Modules\Leases\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Trace d'une relance d'assurance de l'agence : sert à n'en autoriser qu'une par 7 jours et par bail.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property string $sent_by_user_id
 * @property Carbon $sent_at
 */
final class LeaseInsuranceReminder extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'sent_by_user_id', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }
}
