<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\SuggestionAction;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Proposition calculée : cache recalculable, hors `Auditable` (ADR 0035 § 3), purgé à la validation.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $statement_line_id
 * @property SuggestionRule $rule
 * @property Confidence $confidence
 * @property int $score
 * @property SuggestionAction $action
 * @property list<array{type: string, id: string, amount: int}> $targets
 * @property array{codes: list<string>, ids: array<string, mixed>} $explanation
 * @property string $ledger_version
 * @property Carbon $computed_at
 */
final class BankSuggestion extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected function casts(): array
    {
        return [
            'rule' => SuggestionRule::class,
            'confidence' => Confidence::class,
            'action' => SuggestionAction::class,
            'score' => 'integer',
            'targets' => 'array',
            'explanation' => 'array',
            'computed_at' => 'datetime',
        ];
    }
}
