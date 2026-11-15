<?php

declare(strict_types=1);

namespace App\Modules\Documents\Models;

use App\Modules\Documents\Enums\IssuedDocumentType;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * @property string $id
 * @property string $organization_id
 * @property IssuedDocumentType $type
 * @property int $sequence
 * @property string $number
 * @property array<string, mixed> $snapshot
 * @property string $template_version
 * @property string $stored_file_id
 * @property string $fingerprint
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property Carbon $issued_at
 * @property StoredFile $file
 */
final class IssuedDocument extends Model
{
    use Auditable;
    use BelongsToOrganization;
    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    protected static function booted(): void
    {
        self::updating(function (): never {
            throw new LogicException('Une pièce émise ne se modifie jamais.');
        });

        self::deleting(function (): never {
            throw new LogicException('Une pièce émise ne se supprime jamais.');
        });
    }

    /**
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['snapshot'];
    }

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
            'type' => IssuedDocumentType::class,
            'sequence' => 'integer',
            'snapshot' => 'array',
            'issued_at' => 'datetime',
        ];
    }
}
