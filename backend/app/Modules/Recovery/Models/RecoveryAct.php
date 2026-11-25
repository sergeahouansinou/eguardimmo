<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Modules\Recovery\Enums\ActType;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Diligence du carnet : écrite une fois, jamais modifiée ni supprimée (verrou en base).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $case_id
 * @property ActType $type
 * @property Carbon $performed_on
 * @property string|null $author_user_id
 * @property string|null $reference
 * @property string|null $note
 * @property string|null $idempotency_key
 * @property array<string, mixed>|null $data
 * @property Carbon $created_at
 */
final class RecoveryAct extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'recovery_acts';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = ['case_id', 'type', 'performed_on', 'author_user_id', 'reference', 'note', 'idempotency_key', 'data'];

    protected function casts(): array
    {
        return ['type' => ActType::class, 'performed_on' => 'date:Y-m-d', 'data' => 'array'];
    }
}
