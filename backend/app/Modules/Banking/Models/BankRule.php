<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\Direction;
use App\Modules\Banking\Enums\IgnoreReason;
use App\Modules\Banking\Enums\RuleAction;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Règle de l'organisation (« Automatisations ») : elle propose, n'écrit jamais.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property string|null $label_contains
 * @property string|null $counterparty_hash
 * @property string|null $transaction_code
 * @property int|null $amount_min
 * @property int|null $amount_max
 * @property Direction|null $direction
 * @property RuleAction $action
 * @property string|null $target_lease_id
 * @property string|null $target_party_id
 * @property IgnoreReason|null $ignore_reason
 * @property Confidence $confidence
 * @property int $position
 * @property bool $active
 * @property int $lock_version
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 */
final class BankRule extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'direction' => Direction::class,
            'action' => RuleAction::class,
            'ignore_reason' => IgnoreReason::class,
            'confidence' => Confidence::class,
            'amount_min' => 'integer',
            'amount_max' => 'integer',
            'position' => 'integer',
            'active' => 'boolean',
            'lock_version' => 'integer',
        ];
    }
}
