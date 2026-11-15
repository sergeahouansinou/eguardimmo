<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Models;

use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Support\ImmutableRecord;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property int $fiscal_year
 * @property int $number
 * @property Journal $journal
 * @property string $entry_date
 * @property string $label
 * @property SourceType $source_type
 * @property string $source_id
 * @property string $idempotency_key
 * @property string $fingerprint
 * @property string|null $reversal_of_id
 * @property Carbon $created_at
 * @property-read Collection<int, JournalLine> $lines
 */
final class JournalEntry extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;
    use ImmutableRecord;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<JournalLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(JournalLine::class)->orderBy('position');
    }

    public function reference(): string
    {
        return sprintf('%d-%06d', $this->fiscal_year, $this->number);
    }

    protected function casts(): array
    {
        return [
            'journal' => Journal::class,
            'source_type' => SourceType::class,
            'fiscal_year' => 'integer',
            'number' => 'integer',
        ];
    }
}
