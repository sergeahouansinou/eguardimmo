<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\LeaseAnomalyData;
use App\Modules\Leases\Enums\LeaseAnomalyKind;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

/**
 * Lecture seule de toutes les organisations, une à la fois sous son contexte : contrôle de plateforme.
 */
final readonly class LeaseAnomalies
{
    public function __construct(
        private CurrentOrganization $contexte,
        private UnitOccupations $occupations,
        private UnitDirectory $lots,
        private TermDirectory $termes,
    ) {}

    /**
     * @return list<LeaseAnomalyData>
     */
    public function find(): array
    {
        $anomalies = [];

        /** @var list<string> $organisations */
        $organisations = DB::table('leases')->distinct()->orderBy('organization_id')->pluck('organization_id')->all();

        foreach ($organisations as $organisation) {
            array_push($anomalies, ...$this->contexte->run($organisation, fn (): array => $this->inOrganization($organisation)));
        }

        return $anomalies;
    }

    /**
     * @return list<LeaseAnomalyData>
     */
    private function inOrganization(string $organisation): array
    {
        $anomalies = [];
        $ajouter = function (LeaseAnomalyKind $genre, string $bailId, string $detail) use (&$anomalies, $organisation): void {
            $anomalies[] = new LeaseAnomalyData($genre, $organisation, $bailId, $detail);
        };

        $baux = Lease::query()
            ->whereIn('status', [LeaseStatus::Signed->value, LeaseStatus::Terminated->value])
            ->with(['units', 'parties', 'terms'])
            ->orderBy('id')
            ->get();

        $loyers = [];
        $lotsConnus = [];

        foreach ($baux as $bail) {
            if ($bail->status === LeaseStatus::Signed) {
                $this->completeness($bail, $loyers, $ajouter);
                $this->units($bail, $lotsConnus, $ajouter);
            }

            $this->terms($bail, $ajouter);
        }

        $this->overlaps($ajouter);

        return $anomalies;
    }

    /**
     * @param  array<string, bool>  $loyers
     * @param  callable(LeaseAnomalyKind, string, string): void  $ajouter
     */
    private function completeness(Lease $bail, array &$loyers, callable $ajouter): void
    {
        if ($bail->units->filter(fn (LeaseUnit $l): bool => $l->is_main && $l->valid_to === null)->isEmpty()) {
            $ajouter(LeaseAnomalyKind::NoMainUnit, $bail->id, "Bail {$bail->reference} signé sans lot principal ouvert.");
        }

        if ($bail->parties->filter(fn (LeaseParty $p): bool => $p->role === LeasePartyRole::Tenant && $p->valid_to === null)->isEmpty()) {
            $ajouter(LeaseAnomalyKind::NoTenant, $bail->id, "Bail {$bail->reference} signé sans locataire ouvert.");
        }

        $depart = $bail->starts_on->toDateString();
        $loyer = $bail->terms->contains(function (LeaseTerm $t) use ($depart, &$loyers): bool {
            if ($t->valid_from->toDateString() > $depart || ($t->valid_to !== null && $t->valid_to->toDateString() <= $depart)) {
                return false;
            }

            return $loyers[$t->component_term_id] ??= $this->termes->find($t->component_term_id, VocabularyKey::LeaseComponent)->semanticKey === LeaseComponentSemantic::Rent->value;
        });

        if (! $loyer) {
            $ajouter(LeaseAnomalyKind::NoRent, $bail->id, "Bail {$bail->reference} signé sans ligne de loyer en vigueur à son début ({$depart}).");
        }
    }

    /**
     * @param  array<string, bool>  $lotsConnus  identifiant du lot => archivé
     * @param  callable(LeaseAnomalyKind, string, string): void  $ajouter
     */
    private function units(Lease $bail, array &$lotsConnus, callable $ajouter): void
    {
        foreach ($bail->units->filter(fn (LeaseUnit $l): bool => $l->valid_to === null) as $ligne) {
            if (! array_key_exists($ligne->unit_id, $lotsConnus)) {
                try {
                    $lotsConnus[$ligne->unit_id] = $this->lots->find($ligne->unit_id)->isArchived;
                } catch (ApiProblem $probleme) {
                    if ($probleme->problemCode !== 'unit_not_found') {
                        throw $probleme;
                    }

                    $ajouter(LeaseAnomalyKind::UnitMissing, $bail->id, "Bail {$bail->reference} : le lot {$ligne->unit_id} est introuvable dans Properties.");
                    $lotsConnus[$ligne->unit_id] = false;

                    continue;
                }
            }

            if ($lotsConnus[$ligne->unit_id]) {
                $ajouter(LeaseAnomalyKind::UnitArchived, $bail->id, "Bail {$bail->reference} signé sur le lot archivé {$ligne->unit_id}.");
            }
        }
    }

    /**
     * @param  callable(LeaseAnomalyKind, string, string): void  $ajouter
     */
    private function terms(Lease $bail, callable $ajouter): void
    {
        $parComposante = [];

        foreach ($bail->terms as $ligne) {
            if ($ligne->currency !== $bail->currency) {
                $ajouter(LeaseAnomalyKind::CurrencyMismatch, $bail->id, "Bail {$bail->reference} en {$bail->currency} : une ligne de composante est en {$ligne->currency}.");
            }

            $parComposante[$ligne->component_term_id][] = $ligne;
        }

        foreach ($parComposante as $composante => $lignes) {
            usort($lignes, fn (LeaseTerm $a, LeaseTerm $b): int => $a->valid_from->toDateString() <=> $b->valid_from->toDateString());

            for ($i = 1; $i < count($lignes); $i++) {
                $precedente = $lignes[$i - 1];
                $courante = $lignes[$i];

                if ($precedente->valid_to === null || $precedente->valid_to->toDateString() > $courante->valid_from->toDateString()) {
                    $ajouter(LeaseAnomalyKind::TermOverlap, $bail->id, "Bail {$bail->reference} : la composante {$composante} se recoupe à partir du {$courante->valid_from->toDateString()}.");
                }
            }
        }
    }

    /**
     * @param  callable(LeaseAnomalyKind, string, string): void  $ajouter
     */
    private function overlaps(callable $ajouter): void
    {
        $courant = null;
        $vues = [];

        foreach ($this->occupations->of() as $occupation) {
            if ($courant !== $occupation['unit_id']) {
                $courant = $occupation['unit_id'];
                $vues = [];
            }

            foreach ($vues as $vue) {
                if ($vue['lease_id'] !== $occupation['lease_id'] && $this->occupations->overlap($vue['from'], $vue['to'], $occupation['from'], $occupation['to'])) {
                    $ajouter(LeaseAnomalyKind::UnitOverlap, $occupation['lease_id'], "Le lot {$occupation['unit_id']} est occupé en même temps par les baux {$vue['lease_id']} et {$occupation['lease_id']}.");
                }
            }

            $vues[] = $occupation;
        }
    }
}
