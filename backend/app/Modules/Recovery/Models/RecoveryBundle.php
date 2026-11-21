<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Models;

use App\Shared\Money\MoneyCast;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Money\Money;

/**
 * Envoi de pièces figé (ADR 0022 et 0023) : ZIP stocké par Documents, liste des pièces et décompte en JSON.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $case_id
 * @property string $number
 * @property string $stored_file_id
 * @property string $sha256
 * @property int $size_bytes
 * @property list<array<string, mixed>> $pieces
 * @property array<string, mixed> $statement
 * @property string $currency
 * @property Money $total_due
 * @property Carbon $generated_on
 * @property string|null $generated_by_user_id
 */
final class RecoveryBundle extends Model
{
    use BelongsToOrganization;
    use HasUuids;

    protected $table = 'recovery_bundles';

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'case_id', 'number', 'stored_file_id', 'sha256', 'size_bytes', 'pieces', 'statement', 'currency', 'total_due', 'generated_on',
        'generated_by_user_id',
    ];

    /**
     * @return HasMany<RecoveryTransmission, $this>
     */
    public function transmissions(): HasMany
    {
        return $this->hasMany(RecoveryTransmission::class, 'bundle_id')->orderByDesc('id');
    }

    protected function casts(): array
    {
        return [
            'pieces' => 'array',
            'statement' => 'array',
            'size_bytes' => 'integer',
            'total_due' => MoneyCast::class.':currency',
            'generated_on' => 'date:Y-m-d',
        ];
    }
}
