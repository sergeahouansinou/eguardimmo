<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Messaging\Models\Conversation;
use App\Shared\Audit\PreciseTimestamp;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final class PurgeCandidates
{
    /**
     * Fils dont le dernier message est antérieur à la limite et dont le contenu n'est pas encore effacé, tous organisations confondues,
     * par identifiant croissant. La fin du bail ou du mandat se vérifie ensuite sous le contexte de l'organisation.
     *
     * @return list<array{id: string, organization_id: string, kind: string, lease_id: ?string, mandate_id: ?string, last_message_at: CarbonImmutable}>
     */
    public function threads(CarbonImmutable $dernierMessageAvant, ?string $apres, int $limite): array
    {
        return array_values(AcrossOrganizations::query(Conversation::class)
            ->whereNull('content_purged_at')
            ->where('last_message_at', '<', $dernierMessageAvant->format(PreciseTimestamp::FORMAT))
            ->when($apres !== null, fn ($q) => $q->where('id', '>', $apres))
            ->orderBy('id')
            ->limit($limite)
            ->get()
            ->map(fn (Conversation $fil): array => [
                'id' => $fil->id,
                'organization_id' => $fil->organization_id,
                'kind' => $fil->kind->value,
                'lease_id' => $fil->lease_id,
                'mandate_id' => $fil->mandate_id,
                'last_message_at' => $fil->last_message_at,
            ])
            ->all());
    }
}
