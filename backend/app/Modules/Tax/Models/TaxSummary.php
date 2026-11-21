<?php

declare(strict_types=1);

namespace App\Modules\Tax\Models;

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property SummaryScope $scope
 * @property string|null $mandant_party_id
 * @property int $income_year
 * @property string $form_version
 * @property SummaryStatus $status
 * @property string $currency
 * @property array<string, mixed> $snapshot
 * @property string|null $ledger_cutoff
 * @property string $fingerprint
 * @property string $template_version
 * @property string|null $issued_document_id
 * @property string|null $stored_file_id
 * @property string|null $supersedes_id
 * @property string|null $rectification_reason
 * @property string $idempotency_key
 * @property string $request_hash
 * @property int $lock_version
 * @property string|null $active_key
 * @property Carbon|null $published_at
 * @property string|null $published_by_user_id
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
final class TaxSummary extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'scope' => SummaryScope::class,
            'status' => SummaryStatus::class,
            'income_year' => 'integer',
            'snapshot' => 'array',
            'lock_version' => 'integer',
            'published_at' => 'datetime:Y-m-d H:i:s.u',
        ];
    }

    /**
     * @return HasMany<TaxSummaryLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(TaxSummaryLine::class, 'summary_id');
    }

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['snapshot', 'fingerprint', 'request_hash', 'idempotency_key', 'rectification_reason', 'ledger_cutoff'];
    }
}
