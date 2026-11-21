<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Models;

use App\Modules\Reporting\Data\ReportPeriod;
use App\Modules\Reporting\Enums\PeriodKind;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $mandant_party_id
 * @property string|null $number
 * @property PeriodKind $period_kind
 * @property Carbon $period_start
 * @property Carbon $period_end
 * @property ReportStatus $status
 * @property string $currency
 * @property array<string, mixed> $content
 * @property array<string, mixed> $options
 * @property int|null $collected_total
 * @property int|null $fees_total
 * @property int|null $works_total
 * @property int|null $payout_total
 * @property int|null $adjustments_total
 * @property int|null $opening_balance
 * @property int|null $closing_balance
 * @property array<string, mixed>|null $snapshot
 * @property array<string, mixed>|null $ledger_cutoff
 * @property string|null $fingerprint
 * @property string|null $template_version
 * @property string|null $issued_document_id
 * @property string|null $stored_file_id
 * @property string|null $supersedes_id
 * @property string|null $rectification_reason
 * @property Carbon|null $scheduled_for
 * @property bool $notify
 * @property Carbon|null $generated_at
 * @property Carbon|null $published_at
 * @property string|null $published_by_user_id
 * @property Carbon|null $first_read_at
 * @property string $idempotency_key
 * @property string $request_hash
 * @property int $lock_version
 * @property string|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property-read Collection<int, ManagementReportLine> $lines
 */
final class ManagementReport extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return ['snapshot', 'ledger_cutoff', 'fingerprint', 'idempotency_key', 'request_hash', 'lock_version', 'opening_balance', 'closing_balance', 'collected_total', 'fees_total', 'works_total', 'payout_total', 'adjustments_total'];
    }

    public function period(): ReportPeriod
    {
        return new ReportPeriod($this->period_kind, CarbonImmutable::parse($this->period_start->toDateString()), CarbonImmutable::parse($this->period_end->toDateString())->subDay());
    }

    /**
     * @return HasMany<ManagementReportLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(ManagementReportLine::class, 'report_id')->orderBy('position');
    }

    protected function casts(): array
    {
        return [
            'period_kind' => PeriodKind::class,
            'status' => ReportStatus::class,
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'content' => 'array',
            'options' => 'array',
            'snapshot' => 'array',
            'ledger_cutoff' => 'array',
            'collected_total' => 'integer',
            'fees_total' => 'integer',
            'works_total' => 'integer',
            'payout_total' => 'integer',
            'adjustments_total' => 'integer',
            'opening_balance' => 'integer',
            'closing_balance' => 'integer',
            'scheduled_for' => 'datetime',
            'generated_at' => 'datetime',
            'published_at' => 'datetime',
            'first_read_at' => 'datetime',
            'notify' => 'boolean',
            'lock_version' => 'integer',
        ];
    }
}
