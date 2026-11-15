<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Modules\Documents\Enums\FileCategory;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $disk
 * @property string $path
 * @property string $display_name
 * @property string $mime_type
 * @property int $size_bytes
 * @property string $sha256
 * @property FileCategory $category
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property Carbon|null $retention_until
 * @property string|null $uploaded_by_user_id
 * @property Carbon $created_at
 */
final class StoredFile extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    private const FIGES = ['disk', 'path', 'mime_type', 'size_bytes', 'sha256', 'category', 'subject_type', 'subject_id'];

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected static function booted(): void
    {
        self::updating(function (self $fichier): void {
            if ($fichier->isDirty(self::FIGES)) {
                throw new LogicException('Le contenu et l\'empreinte d\'un fichier stocké ne changent jamais.');
            }

            $ancienne = $fichier->getOriginal('retention_until');

            if ($ancienne !== null && $fichier->isDirty('retention_until')
                && ($fichier->retention_until === null || $fichier->retention_until->lt(Carbon::parse((string) $ancienne)))) {
                throw new LogicException('La durée de conservation ne se raccourcit pas.');
            }
        });

        self::deleting(function (self $fichier): void {
            if ($fichier->retention_until === null || $fichier->retention_until->isFuture()) {
                throw new LogicException('Aucune suppression avant la fin de la durée de conservation.');
            }
        });
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['display_name'];
    }

    protected function casts(): array
    {
        return [
            'category' => FileCategory::class,
            'size_bytes' => 'integer',
            'retention_until' => 'datetime',
        ];
    }
}
