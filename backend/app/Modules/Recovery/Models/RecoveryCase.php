<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Modules\Recovery\Enums\CaseStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Dossier de recouvrement d'un bail et d'un débiteur (ADR 0023). Le reste dû se lit toujours au grand livre.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $number
 * @property string $lease_id
 * @property string $debtor_party_id
 * @property CaseStatus $status
 * @property string $currency
 * @property Carbon $opened_on
 * @property Carbon|null $closed_on
 * @property string|null $status_reason
 * @property string|null $opened_by_user_id
 */
final class RecoveryCase extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'recovery_cases';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['number', 'lease_id', 'debtor_party_id', 'status', 'currency', 'opened_on', 'closed_on', 'status_reason', 'opened_by_user_id'];

    /**
     * @return HasMany<RecoveryCaseItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(RecoveryCaseItem::class, 'case_id')->orderBy('included_at')->orderBy('id');
    }

    /**
     * @return HasMany<RecoveryCaseItem, $this>
     */
    public function activeItems(): HasMany
    {
        return $this->items()->whereNull('removed_at');
    }

    /**
     * @return HasMany<RecoveryAct, $this>
     */
    public function acts(): HasMany
    {
        return $this->hasMany(RecoveryAct::class, 'case_id')->orderByDesc('performed_on')->orderByDesc('id');
    }

    /**
     * @return HasMany<RecoveryBundle, $this>
     */
    public function bundles(): HasMany
    {
        return $this->hasMany(RecoveryBundle::class, 'case_id')->orderByDesc('id');
    }

    protected function casts(): array
    {
        return [
            'status' => CaseStatus::class,
            'opened_on' => 'date:Y-m-d',
            'closed_on' => 'date:Y-m-d',
        ];
    }
}
