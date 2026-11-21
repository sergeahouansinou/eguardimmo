<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Support\MandateView;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Illuminate\Support\Str;

final readonly class MandateViews
{
    public function __construct(
        private PartyDirectory $parties,
        private UnitDirectory $lots,
        private TermDirectory $termes,
        private MandateEndRequests $demandesFin,
    ) {}

    /**
     * @param  iterable<Mandate>  $mandats
     * @return list<MandateView> dans l'ordre reçu
     */
    public function of(iterable $mandats): array
    {
        $mandats = collect($mandats)->values();
        $mandats->each(fn (Mandate $m) => $m->loadMissing(['units', 'terms']));

        $parties = $this->parties->findMany(array_values($mandats->map(fn (Mandate $m): string => $m->mandant_party_id)->all()));
        $types = $this->termes->findMany(array_values($mandats->map(fn (Mandate $m): string => $m->mandate_type_term_id)->all()), VocabularyKey::MandateType);
        $lots = $this->lots->findMany(array_values($mandats->flatMap(fn (Mandate $m) => $m->units->map(fn (MandateUnit $l): string => $l->unit_id))->all()));

        $enAttente = array_flip($this->demandesFin->pendingMandateIds(array_values($mandats->map(fn (Mandate $m): string => $m->id)->all())));

        return array_values($mandats->map(fn (Mandate $m): MandateView => new MandateView(
            mandate: $m,
            units: array_values($m->units->sortBy([['valid_from', 'asc'], ['id', 'asc']])->all()),
            terms: array_values($m->terms->sortBy([['valid_from', 'asc'], ['id', 'asc']])->all()),
            mandant: $parties[$m->mandant_party_id],
            type: $types[$m->mandate_type_term_id],
            unitData: array_intersect_key($lots, array_flip($m->units->map(fn (MandateUnit $l): string => $l->unit_id)->all())),
            hasEndRequest: isset($enAttente[$m->id]),
        ))->all());
    }

    public function one(Mandate $mandat): MandateView
    {
        return $this->of([$mandat])[0];
    }

    public function find(string $id): MandateView
    {
        $mandat = (Str::isUuid($id) ? Mandate::query()->with(['units', 'terms'])->find($id) : null)
            ?? throw ErrorCode::MandateNotFound->problem();

        return $this->one($mandat);
    }
}
