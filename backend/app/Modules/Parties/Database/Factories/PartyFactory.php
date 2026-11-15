<?php

declare(strict_types=1);

namespace App\Modules\Parties\Database\Factories;

use App\Modules\Parties\Enums\PartyKind;
use App\Modules\Parties\Models\Party;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Party>
 */
final class PartyFactory extends Factory
{
    protected $model = Party::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $prenom = fake()->firstName();
        $nom = fake()->lastName();

        return [
            'kind' => PartyKind::Person,
            'display_name' => "{$prenom} {$nom}",
            'first_name' => $prenom,
            'last_name' => $nom,
            'language' => 'fr',
            'custom_fields' => [],
            'lock_version' => 1,
        ];
    }

    public function company(string $raisonSociale = 'Ramonage du Port SARL'): self
    {
        return $this->state([
            'kind' => PartyKind::Company,
            'display_name' => $raisonSociale,
            'company_name' => $raisonSociale,
            'first_name' => null,
            'last_name' => null,
        ]);
    }
}
