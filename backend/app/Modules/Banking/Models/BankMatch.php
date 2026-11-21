<?php

declare(strict_types=1);

namespace App\Modules\Banking\Models;

use App\Modules\Banking\Enums\Confidence;
use App\Modules\Banking\Enums\MatchKind;
use App\Modules\Banking\Enums\SuggestionRule;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Pointage : relie des lignes de relevé à des lignes d'écriture ; ajout seul, seul le passage à « défait » est permis.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $bank_account_id
 * @property MatchKind $kind
 * @property SuggestionRule|null $rule
 * @property Confidence|null $confidence
 * @property array<string, mixed>|null $explanation
 * @property string|null $matched_by_user_id
 * @property Carbon|null $undone_at
 * @property string|null $undone_by_user_id
 * @property string|null $undo_reason
 * @property Carbon|null $created_at
 */
final class BankMatch extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return HasMany<BankMatchItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(BankMatchItem::class, 'match_id')->orderBy('side')->orderBy('id');
    }

    protected function casts(): array
    {
        return [
            'kind' => MatchKind::class,
            'rule' => SuggestionRule::class,
            'confidence' => Confidence::class,
            'explanation' => 'array',
            'undone_at' => 'datetime',
        ];
    }
}
