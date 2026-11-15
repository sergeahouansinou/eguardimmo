<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Database\Factories;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Valeur de la plateforme par défaut ; `organization_id` la rattache à une organisation.
 *
 * @extends Factory<Term>
 */
final class TermFactory extends Factory
{
    protected $model = Term::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'organization_id' => null,
            'vocabulary' => VocabularyKey::UnitType->value,
            'key' => 'valeur_'.fake()->unique()->bothify('????##'),
            'labels' => ['fr' => fake()->word()],
            'position' => 0,
            'is_system' => false,
        ];
    }
}
