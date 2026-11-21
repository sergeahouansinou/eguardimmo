<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Data\ItemBasis;
use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\KeyKind;
use App\Modules\Charges\Models\ChargeConsumption;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeKeyShare;
use App\Modules\Charges\Models\ChargeKeyVersion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Base de répartition de chaque poste (ADR 0034 § 4) : la version de clé en vigueur sur toute la période, sinon le calcul s'arrête.
 */
final class ItemBases
{
    /**
     * @param  Collection<int, ChargeItem>  $postes
     * @param  list<string>  $occupes  lots occupés par un bail concerné
     * @return array<string, ItemBasis> par identifiant de poste
     */
    public function resolve(Collection $postes, ChargeExercise $exercice, array $occupes): array
    {
        $cleIds = array_values(array_unique(array_map(strval(...), $postes->pluck('key_id')->filter()->all())));
        $cles = $cleIds === [] ? collect() : ChargeKey::query()->where('property_id', $exercice->property_id)->whereIn('id', $cleIds)->get()->keyBy('id');
        $debut = $exercice->period_start->toDateString();
        $fin = $exercice->period_end->toDateString();
        $versions = $cleIds === [] ? collect() : ChargeKeyVersion::query()->whereIn('key_id', $cleIds)
            ->where('valid_from', '<', $fin)
            ->where(fn (Builder $q) => $q->whereNull('valid_to')->orWhere('valid_to', '>', $debut))
            ->get()->groupBy('key_id');
        $parts = $versions->isEmpty() ? collect() : ChargeKeyShare::query()->whereIn('version_id', $versions->flatten()->pluck('id')->all())->get()->groupBy('version_id');
        $consommations = ChargeConsumption::query()->whereIn('item_id', $postes->pluck('id')->all())->get()->groupBy('item_id');
        $resultat = [];

        foreach ($postes as $poste) {
            $base = match (true) {
                $poste->unit_id !== null => new ItemBasis('unit', [$poste->unit_id => 1], 1),
                default => $this->ofKey($poste, $cles->get($poste->key_id), $versions->get($poste->key_id, collect()), $parts, $consommations->get($poste->id, collect()), $debut, $fin),
            };

            foreach ($occupes as $lot) {
                if ($poste->unit_id === null && ! isset($base->weights[$lot])) {
                    throw ErrorCode::KeyIncomplete->problem(sprintf('La clé du poste « %s » ne couvre pas tous les lots occupés.', $poste->label));
                }
            }

            $resultat[$poste->id] = $base;
        }

        return $resultat;
    }

    /**
     * @param  Collection<int, ChargeKeyVersion>  $versions
     * @param  Collection<string, Collection<int, ChargeKeyShare>>  $parts
     * @param  Collection<int, ChargeConsumption>  $consommations
     */
    private function ofKey(ChargeItem $poste, ?ChargeKey $cle, Collection $versions, Collection $parts, Collection $consommations, string $debut, string $fin): ItemBasis
    {
        if ($cle === null) {
            throw ErrorCode::KeyNotFound->problem();
        }

        if ($cle->kind === KeyKind::Consumption) {
            $poids = [];
            foreach ($consommations as $c) {
                $poids[$c->unit_id] = $c->quantity_milli;
            }

            return $this->basis($poste, $cle->kind->value, $poids);
        }

        if ($versions->count() > 1) {
            throw ErrorCode::KeyChangedDuringPeriod->problem(sprintf('La clé « %s » a changé pendant la période : scindez l\'exercice à la date d\'effet.', $cle->label));
        }

        $version = $versions->first();

        if ($version === null || $version->valid_from->toDateString() > $debut || ($version->valid_to !== null && $version->valid_to->toDateString() < $fin)) {
            throw ErrorCode::KeyIncomplete->problem(sprintf('La clé « %s » ne couvre pas toute la période.', $cle->label));
        }

        $poids = [];
        foreach ($parts->get($version->id, collect()) as $part) {
            $poids[$part->unit_id] = $part->weight;
        }

        return $this->basis($poste, $cle->kind->value, $poids);
    }

    /**
     * @param  array<string, int>  $poids
     */
    private function basis(ChargeItem $poste, string $genre, array $poids): ItemBasis
    {
        $denominateur = array_sum($poids);

        return $denominateur > 0 ? new ItemBasis($genre, $poids, $denominateur) : throw ErrorCode::KeyIncomplete->problem(sprintf('Le poste « %s » n\'a aucune base de répartition.', $poste->label));
    }
}
