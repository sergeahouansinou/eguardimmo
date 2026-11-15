<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Models;

use App\Modules\Catalog\Database\Factories\TermFactory;
use App\Shared\Audit\Auditable;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Hors BelongsToOrganization : organization_id nul = valeur de la plateforme. Chaque lecture filtre explicitement (Queries/VisibleTerms).
 *
 * @property string $id
 * @property string|null $organization_id
 * @property string $vocabulary
 * @property string $key
 * @property array<string, string> $labels
 * @property string|null $semantic_key
 * @property string|null $parent_id
 * @property int $position
 * @property array<string, mixed>|null $metadata
 * @property bool $is_system
 * @property Carbon|null $archived_at
 */
#[UseFactory(TermFactory::class)]
final class Term extends Model
{
    use Auditable;

    /** @use HasFactory<TermFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id'];

    public function isPlatform(): bool
    {
        return $this->organization_id === null;
    }

    protected function casts(): array
    {
        return [
            'labels' => 'array',
            'metadata' => 'array',
            'position' => 'integer',
            'is_system' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }
}
