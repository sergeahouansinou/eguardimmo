<?php

declare(strict_types=1);

namespace App\Modules\Mandates\PublicApi;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\ActiveMandantData;
use App\Modules\Mandates\Data\MandantData;
use App\Modules\Mandates\Data\MandateCoverageData;
use App\Modules\Mandates\Data\MandateData;
use App\Modules\Mandates\Data\MandateFeeScheduleData;
use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Queries\ActiveMandants;
use App\Modules\Mandates\Queries\CoverageAt;
use App\Modules\Mandates\Queries\CoverageDuring;
use App\Modules\Mandates\Queries\FeeSchedules;
use App\Modules\Mandates\Queries\Mandants;
use App\Modules\Mandates\Queries\MandateSummaries;
use App\Modules\Mandates\Queries\OwnerCoverage;
use App\Modules\Mandates\Queries\OwnerVisibility;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Support\Str;

/**
 * Lecture des mandats pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class MandateDirectory
{
    public function __construct(
        private MandateSummaries $resumes,
        private CoverageAt $couvertures,
        private Mandants $mandants,
        private FeeSchedules $baremes,
        private CoverageDuring $periodes,
        private OwnerVisibility $proprietaires,
        private OwnerCoverage $couverturesProprietaire,
        private ActiveMandants $mandantsActifs,
    ) {}

    /**
     * Lève mandate_not_found hors de l'organisation courante.
     */
    public function find(string $id): MandateData
    {
        return $this->resumes->one($id);
    }

    /**
     * Lève mandate_not_found si un identifiant est inconnu ou hors de l'organisation courante.
     *
     * @param  list<string>  $ids
     * @return array<string, MandateData> par identifiant
     */
    public function findMany(array $ids): array
    {
        return $this->resumes->many($ids);
    }

    /**
     * Mandat qui couvre ce lot ce jour-là, conditions du jour comprises ; null si aucun. Un brouillon ne couvre rien ;
     * un mandat suspendu, résilié avec préavis ou expiré couvre le lot sur sa période.
     */
    public function coveringUnit(string $unitId, DateTimeInterface $date): ?MandateCoverageData
    {
        return $this->coveringUnits([$unitId], $date)[$unitId] ?? null;
    }

    /**
     * Comme coveringUnit(), pour plusieurs lots en deux requêtes ; les lots sans mandat sont absents du résultat.
     *
     * @param  list<string>  $unitIds
     * @return array<string, MandateCoverageData> par identifiant de lot
     */
    public function coveringUnits(array $unitIds, DateTimeInterface $date): array
    {
        return $this->couvertures->of($unitIds, CarbonImmutable::instance($date));
    }

    /**
     * Mandants de l'organisation, par identifiant de partie croissant ; `$afterPartyId` reprend après la dernière partie reçue.
     *
     * @return list<MandantData>
     */
    public function mandants(?string $afterPartyId = null, int $limit = 100): array
    {
        return $this->mandants->list($afterPartyId, $limit, CarbonImmutable::today());
    }

    /**
     * Mandants d'un mandat `active` en cours aujourd'hui, un mandat par mandant, par identifiant de partie croissant ; `$afterPartyId`
     * reprend après le dernier mandant reçu. Ce n'est pas `mandants()` : ni suspendu ni résilié avec préavis.
     *
     * @return list<ActiveMandantData>
     */
    public function activeMandants(?string $afterPartyId = null, int $limit = 200): array
    {
        return $this->mandantsActifs->list($afterPartyId, $limit, CarbonImmutable::today());
    }

    /**
     * Mandats non brouillon commencés au plus tard le `$until` (Y-m-d), avec lots et barèmes successifs, pour calculer les honoraires de gestion.
     *
     * @param  string|null  $mandateId  restreint à ce mandat
     * @return list<MandateFeeScheduleData>
     */
    public function feeSchedules(string $until, ?string $mandateId = null): array
    {
        return $this->baremes->until($until, $mandateId);
    }

    /**
     * Mandats sortis du brouillon qui couvrent au moins un jour de la période (bornes incluses), une ligne par mandat et par lot,
     * avec les conditions du dernier jour couvert ; `$mandantPartyIds` null : tous les mandants.
     *
     * @param  list<string>|null  $mandantPartyIds
     * @return list<MandateSpanData>
     */
    public function coverageDuring(DateTimeInterface $from, DateTimeInterface $to, ?array $mandantPartyIds = null): array
    {
        return $this->periodes->of(CarbonImmutable::instance($from), CarbonImmutable::instance($to), $mandantPartyIds);
    }

    /**
     * Clé de lecture de l'espace propriétaire (ADR 0032) : les couples (organisation, mandant) du compte qu'un accès vivant et
     * la fenêtre d'accès (mandat actif ou suspendu, puis 12 mois) rendent lisibles. Sans contexte d'organisation, une résolution
     * par requête ; `$organizationId` restreint seulement. Un couple absent ou échu est une ressource inconnue (404).
     *
     * @return list<OwnerVisibleData>
     */
    public function visibleToOwner(string $userId, ?string $organizationId = null, ?DateTimeInterface $at = null): array
    {
        return $this->proprietaires->of($userId, $organizationId, CarbonImmutable::instance($at ?? CarbonImmutable::today()));
    }

    /**
     * Clé de lecture et lots couverts du compte, en trois requêtes quel que soit le nombre de mandants : les modules de
     * l'espace propriétaire filtrent leurs lectures sur ce périmètre. `$agency` restreint seulement : un identifiant mal formé
     * ou hors clé lève owner_agency_not_found (404), comme une agence inconnue.
     */
    public function ownerScope(string $userId, ?string $agency = null, ?DateTimeInterface $at = null): OwnerScopeData
    {
        if ($agency !== null && ! Str::isUuid($agency)) {
            throw ErrorCode::OwnerAgencyNotFound->problem();
        }

        $visibles = $this->visibleToOwner($userId, $agency, $at);

        if ($agency !== null && $visibles === []) {
            throw ErrorCode::OwnerAgencyNotFound->problem();
        }

        return new OwnerScopeData($visibles, $this->couverturesProprietaire->of($visibles));
    }

    /**
     * Garde d'écriture de l'espace propriétaire : `co_owner` n'écrit jamais, et la grâce est en lecture seule.
     * Lève owner_role_forbidden puis owner_access_read_only.
     */
    public function assertOwnerWritable(OwnerVisibleData $visible): void
    {
        if ($visible->role === OwnerAccessRole::CoOwner) {
            throw ErrorCode::OwnerRoleForbidden->problem();
        }

        if ($visible->inGrace) {
            throw ErrorCode::OwnerAccessReadOnly->problem();
        }
    }
}
