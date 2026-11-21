<?php

declare(strict_types=1);

namespace App\Modules\Charges\Models;

use App\Modules\Charges\Enums\ExerciseStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $property_id
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property ExerciseStatus $status
 * @property string $jurisdiction
 * @property string|null $only_lease_id
 * @property string|null $supersedes_statement_id
 * @property string|null $rectification_reason
 * @property bool $prescription_acknowledged
 * @property Carbon|null $computed_at
 * @property Carbon|null $issued_at
 * @property string|null $idempotency_key
 * @property string|null $fingerprint
 * @property int $lock_version
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class ChargeExercise extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'status' => ExerciseStatus::class,
            'prescription_acknowledged' => 'boolean',
            'computed_at' => PreciseTimestamp::class,
            'issued_at' => PreciseTimestamp::class,
            'lock_version' => 'integer',
        ];
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['idempotency_key', 'fingerprint', 'rectification_reason'];
    }
}
