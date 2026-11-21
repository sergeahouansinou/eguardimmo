<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Models;

use App\Modules\Inspections\Enums\RemarkAnswer;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Enums\RemarkStatus;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Remarque d'un locataire sur un état des lieux : une trace en ajout seul, seule la réponse de l'équipe s'y ajoute (ADR 0036).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $inspection_id
 * @property string $party_id
 * @property string $author_user_id
 * @property RemarkKind $kind
 * @property string $body
 * @property string $client_id
 * @property RemarkStatus $status
 * @property RemarkAnswer|null $answer
 * @property string|null $answer_body
 * @property string|null $answered_by_user_id
 * @property Carbon|null $answered_at
 * @property Carbon $created_at
 * @property-read Collection<int, InspectionRemarkFile> $files
 */
final class InspectionRemark extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['inspection_id', 'party_id', 'author_user_id', 'kind', 'body', 'client_id', 'status', 'answer', 'answer_body', 'answered_by_user_id', 'answered_at'];

    protected $attributes = ['status' => 'open', 'answer' => null, 'answer_body' => null, 'answered_by_user_id' => null, 'answered_at' => null];

    /**
     * @return HasMany<InspectionRemarkFile, $this>
     */
    public function files(): HasMany
    {
        return $this->hasMany(InspectionRemarkFile::class, 'remark_id')->orderBy('position');
    }

    protected function casts(): array
    {
        return [
            'kind' => RemarkKind::class,
            'body' => 'encrypted',
            'status' => RemarkStatus::class,
            'answer' => RemarkAnswer::class,
            'answer_body' => 'encrypted',
            'answered_at' => 'datetime',
        ];
    }
}
