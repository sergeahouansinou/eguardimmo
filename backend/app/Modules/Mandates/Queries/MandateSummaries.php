<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandateData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Str;

final readonly class MandateSummaries
{
    public function __construct(
        private CurrentOrganization $organisation,
        private Mandates $mandats,
    ) {}

    public function one(string $id): MandateData
    {
        $this->organisation->id();
        $mandat = $this->mandats->get($id);
        $mandat->load('units');

        return $this->toData($mandat);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, MandateData> par identifiant
     */
    public function many(array $ids): array
    {
        $this->organisation->id();
        $ids = array_values(array_unique($ids));

        if ($ids === []) {
            return [];
        }

        if (array_filter($ids, fn (string $id): bool => ! Str::isUuid($id)) !== []) {
            throw ErrorCode::MandateNotFound->problem();
        }

        $mandats = Mandate::query()->with('units')->whereIn('id', $ids)->get()->keyBy('id');
        $resultat = [];

        foreach ($ids as $id) {
            $resultat[$id] = $this->toData($mandats->get($id) ?? throw ErrorCode::MandateNotFound->problem());
        }

        return $resultat;
    }

    private function toData(Mandate $mandat): MandateData
    {
        return new MandateData(
            id: $mandat->id,
            reference: $mandat->reference,
            mandantPartyId: $mandat->mandant_party_id,
            status: $mandat->status,
            startsOn: $mandat->starts_on->toDateString(),
            endDate: $mandat->ends_on->toImmutable()->subDay()->toDateString(),
            isArchived: $mandat->archived_at !== null,
            unitIds: array_values(array_unique($mandat->units->filter(fn (MandateUnit $l): bool => $l->valid_to === null)->map(fn (MandateUnit $l): string => $l->unit_id)->all())),
        );
    }
}
