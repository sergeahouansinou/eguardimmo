<?php

declare(strict_types=1);

namespace App\Modules\Operations\Models;

use App\Modules\Operations\Enums\BackupKind;
use App\Modules\Operations\Enums\RestoreResult;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Preuve d'une sauvegarde ou d'un test de restauration, déposée par le script de l'hébergement : jamais modifiée.
 *
 * @property string $id
 * @property BackupKind $kind
 * @property Carbon $started_at
 * @property int $duration_seconds
 * @property int|null $size_bytes
 * @property bool $succeeded
 * @property string|null $manifest_sha256
 * @property string|null $restore_test_target
 * @property RestoreResult|null $restore_test_result
 * @property Carbon $created_at
 */
final class BackupReport extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    /** @var array<string, mixed> */
    protected $attributes = [
        'size_bytes' => null,
        'manifest_sha256' => null,
        'restore_test_target' => null,
        'restore_test_result' => null,
    ];

    protected function casts(): array
    {
        return [
            'kind' => BackupKind::class,
            'started_at' => 'datetime',
            'duration_seconds' => 'integer',
            'size_bytes' => 'integer',
            'succeeded' => 'boolean',
            'restore_test_result' => RestoreResult::class,
        ];
    }
}
