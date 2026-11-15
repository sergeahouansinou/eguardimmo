<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Models;

use App\Modules\Catalog\Database\Factories\CustomFieldDefinitionFactory;
use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Enums\CustomFieldType;
use App\Shared\Audit\Auditable;
use App\Shared\Tenancy\BelongsToOrganization;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $organization_id
 * @property CustomFieldEntity $entity
 * @property string $key
 * @property array<string, string> $labels
 * @property CustomFieldType $type
 * @property string|null $vocabulary
 * @property list<array{key: string, labels: array<string, string>}>|null $options
 * @property bool $required
 * @property int $position
 * @property Carbon|null $values_recorded_at
 * @property Carbon|null $archived_at
 */
#[UseFactory(CustomFieldDefinitionFactory::class)]
final class CustomFieldDefinition extends Model
{
    use Auditable;
    use BelongsToOrganization;

    /** @use HasFactory<CustomFieldDefinitionFactory> */
    use HasFactory;

    use HasUuids;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = ['id', 'organization_id'];

    /**
     * @return list<string>
     */
    public function optionKeys(): array
    {
        return array_map(fn (array $option): string => $option['key'], $this->options ?? []);
    }

    protected function casts(): array
    {
        return [
            'entity' => CustomFieldEntity::class,
            'type' => CustomFieldType::class,
            'labels' => 'array',
            'options' => 'array',
            'required' => 'boolean',
            'position' => 'integer',
            'values_recorded_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
}
