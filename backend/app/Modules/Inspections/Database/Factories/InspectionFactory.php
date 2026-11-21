<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Database\Factories;

use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Modules\Inspections\Models\Inspection;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * `lease_id` et `stored_file_id` désignent des lignes d'autres modules : l'appelant fournit des valeurs réelles quand le test les lit.
 *
 * @extends Factory<Inspection>
 */
final class InspectionFactory extends Factory
{
    protected $model = Inspection::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lease_id' => Str::uuid7()->toString(),
            'kind' => InspectionKind::Entry,
            'performed_on' => '2026-11-16',
            'performed_by' => InspectionPerformer::Agent,
            'stored_file_id' => Str::uuid7()->toString(),
            'signatories' => [],
            'created_by_user_id' => Str::uuid7()->toString(),
            'client_id' => Str::uuid7()->toString(),
        ];
    }

    public function published(): self
    {
        return $this->state(fn (): array => ['published_at' => now(), 'published_by_user_id' => Str::uuid7()->toString()]);
    }
}
