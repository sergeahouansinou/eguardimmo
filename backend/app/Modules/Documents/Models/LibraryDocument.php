<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Modules\Documents\Enums\LibraryKind;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Entrée de la bibliothèque : un dépôt volontaire de l'équipe. Archiver ne supprime ni l'entrée ni le fichier.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $stored_file_id
 * @property LibraryKind $kind
 * @property Carbon|null $archived_at
 * @property string|null $filed_by_user_id
 * @property int $lock_version
 * @property Carbon $created_at
 * @property-read StoredFile $file
 */
final class LibraryDocument extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return BelongsTo<StoredFile, $this>
     */
    public function file(): BelongsTo
    {
        return $this->belongsTo(StoredFile::class, 'stored_file_id');
    }

    protected function casts(): array
    {
        return [
            'kind' => LibraryKind::class,
            'archived_at' => 'datetime',
            'lock_version' => 'integer',
        ];
    }
}
