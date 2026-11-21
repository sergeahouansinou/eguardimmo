<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\ActiveMandantData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Mandants qui portent au moins un mandat `active` en cours ce jour (période semi-ouverte), une ligne par mandant : son mandat
 * de plus petite référence, qui remplit le champ de fusion « Mandat » d'une diffusion.
 */
final readonly class ActiveMandants
{
    public const int MAX_PAGE = 500;

    /**
     * @return list<ActiveMandantData>
     */
    public function list(?string $afterPartyId, int $limit, CarbonImmutable $today): array
    {
        $jour = $today->toDateString();

        $enCours = fn () => Mandate::query()
            ->where('status', MandateStatus::Active->value)
            ->whereNull('archived_at')
            ->where('starts_on', '<=', $jour)
            ->where('ends_on', '>', $jour);

        $mandants = $enCours()
            ->when($afterPartyId !== null && Str::isUuid($afterPartyId), fn ($q) => $q->where('mandant_party_id', '>', (string) $afterPartyId))
            ->select('mandant_party_id')
            ->distinct()
            ->orderBy('mandant_party_id')
            ->limit(max(1, min($limit, self::MAX_PAGE)))
            ->pluck('mandant_party_id')
            ->all();

        $mandats = $mandants === [] ? [] : $enCours()
            ->whereIn('mandant_party_id', $mandants)
            ->orderBy('mandant_party_id')
            ->orderBy('reference')
            ->orderBy('id')
            ->get();

        $lignes = [];

        foreach ($mandats as $mandat) {
            $lignes[$mandat->mandant_party_id] ??= new ActiveMandantData($mandat->mandant_party_id, $mandat->id, $mandat->reference);
        }

        return array_values($lignes);
    }
}
