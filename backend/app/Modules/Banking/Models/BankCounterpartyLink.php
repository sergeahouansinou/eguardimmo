<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Empreinte de contrepartie liée à une partie : `parties` (IBAN connu de Parties) ou `confirmed` (nourri par une validation).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $counterparty_hash
 * @property string $party_id
 * @property string $origin
 * @property int $confirmations
 * @property Carbon|null $last_confirmed_at
 */
final class BankCounterpartyLink extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return ['confirmations' => 'integer', 'last_confirmed_at' => 'datetime'];
    }
}
