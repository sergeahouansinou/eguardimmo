<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\AcrossOrganizations;

final readonly class PartiesOfUser
{
    /**
     * Parties non anonymisées liées au compte, toutes organisations confondues (effacement RGPD).
     *
     * @return list<array{organization_id: string, party_id: string}>
     */
    public function pending(string $userId): array
    {
        $parties = AcrossOrganizations::query(Party::class)
            ->where('user_id', $userId)
            ->whereNull('anonymized_at')
            ->get(['id', 'organization_id']);

        return array_values($parties
            ->map(fn (Party $partie): array => ['organization_id' => $partie->organization_id, 'party_id' => $partie->id])
            ->all());
    }
}
