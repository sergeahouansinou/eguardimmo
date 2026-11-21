<?php

declare(strict_types=1);

namespace App\Modules\Rent\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Un bail facturé par Rent : `billing_from` est le premier jour de la première période appelée. Sert aussi de verrou
 * d'ordre par bail : toute écriture qui touche aux échéances ou aux encaissements d'un bail le prend en premier.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $lease_id
 * @property Carbon $billing_from
 */
final class RentSchedule extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['lease_id', 'billing_from'];

    protected function casts(): array
    {
        return ['billing_from' => 'date:Y-m-d'];
    }
}
