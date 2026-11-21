<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Maintenance\Data\NewInterventionData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\Responsibility;
use App\Modules\Maintenance\Events\ServiceRequestReported;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Support\References;
use App\Modules\Maintenance\Support\Settings;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateIntervention
{
    public function __construct(
        private LeaseDirectory $baux,
        private UnitDirectory $lots,
        private MandateDirectory $mandats,
        private TermDirectory $termes,
        private OrganizationDirectory $organisation,
        private References $references,
        private Timeline $chronologie,
    ) {}

    /**
     * Crée la demande (premier état `reported`) sous le contexte de l'organisation courante. Le client ne fournit ni statut, ni
     * référence, ni organisation, ni mandat (locataire), ni devise. Rejouable par clé d'idempotence : même contenu, même résultat.
     *
     * @return array{intervention: Intervention, replayed: bool}
     */
    public function handle(NewInterventionData $donnees, InterventionOrigin $origine, ?string $reporterPartyId, string $actorKey, CarbonImmutable $today): array
    {
        $cle = $actorKey.':'.$donnees->idempotencyKey;
        $empreinte = hash('sha256', (string) json_encode([$donnees->leaseId, $donnees->unitId, $donnees->commonArea, $donnees->mandateId, $donnees->natureTermId,
            $donnees->title, $donnees->description, $donnees->room, $donnees->reportedUrgency?->value, $donnees->priority?->value, $donnees->availability], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($donnees, $origine, $reporterPartyId, $cle, $empreinte, $today): array {
                $existante = Intervention::query()->where('idempotency_key', $cle)->first();

                if ($existante !== null) {
                    return ['intervention' => $this->replay($existante, $empreinte), 'replayed' => true];
                }

                return ['intervention' => $this->create($donnees, $origine, $reporterPartyId, $cle, $empreinte, $today), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $existante = Intervention::query()->where('idempotency_key', $cle)->first() ?? throw $erreur;

            return ['intervention' => $this->replay($existante, $empreinte), 'replayed' => true];
        }
    }

    private function create(NewInterventionData $d, InterventionOrigin $origine, ?string $reporter, string $cle, string $empreinte, CarbonImmutable $today): Intervention
    {
        $bail = $d->leaseId === null ? null : $this->lease($d->leaseId, $origine, $today);
        [$unitId, $propertyId] = $this->place($d, $bail);
        $nature = $this->termes->findAssignable($d->natureTermId, VocabularyKey::InterventionNature);

        if ($bail !== null && $origine === InterventionOrigin::Tenant
            && Intervention::query()->where('lease_id', $bail->id)->whereIn('status', array_map(fn (InterventionStatus $s): string => $s->value, InterventionStatus::open()))->count() >= Settings::maxOpenPerLease()) {
            throw ErrorCode::TooManyOpen->problem();
        }

        $intervention = Intervention::query()->create([
            'reference' => $this->references->next($today),
            'origin' => $origine,
            'status' => InterventionStatus::Reported,
            'priority' => $origine === InterventionOrigin::Team ? ($d->priority ?? Priority::Normal) : Priority::Normal,
            'reported_urgency' => $d->reportedUrgency,
            'nature_term_id' => $nature->id,
            'title' => $d->title,
            'description' => $d->description,
            'room' => $d->room,
            'availability' => $d->availability,
            'property_id' => $propertyId,
            'unit_id' => $unitId,
            'lease_id' => $bail?->id,
            'reporter_party_id' => $reporter,
            'responsibility' => Responsibility::Undetermined,
            'reported_on' => $today->toDateString(),
            'currency' => $bail === null ? $this->organisation->currency()->getCode() : $bail->currency,
            'idempotency_key' => $cle,
            'request_hash' => $empreinte,
            'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            'lock_version' => 1,
        ]);

        $this->chronologie->add($intervention, EventKind::Reported, $origine === InterventionOrigin::Tenant ? ActorKind::Tenant : ActorKind::Team, 'Demande signalée.', locataire: true);

        if ($origine === InterventionOrigin::Tenant) {
            ServiceRequestReported::dispatch($intervention->id, $intervention->organization_id, $intervention->lease_id, $intervention->reference);
        }

        return $intervention;
    }

    private function lease(string $leaseId, InterventionOrigin $origine, CarbonImmutable $today): LeaseData
    {
        $bail = $this->baux->find($leaseId);

        if ($origine === InterventionOrigin::Tenant && ($bail->status !== LeaseStatus::Signed || ($bail->endsOn !== null && $bail->endsOn <= $today->toDateString()))) {
            throw ErrorCode::LeaseNotActive->problem();
        }

        return $bail;
    }

    /**
     * @return array{0: string|null, 1: string|null} lot et bien ; un lot absent désigne les parties communes du site
     */
    private function place(NewInterventionData $d, ?LeaseData $bail): array
    {
        if ($d->unitId !== null) {
            if ($bail !== null && ! in_array($d->unitId, array_map(fn ($ligne): string => $ligne->unitId, $bail->units), true)) {
                throw ErrorCode::UnitInvalid->problem();
            }

            return [$d->unitId, $this->lots->find($d->unitId)->propertyId];
        }

        if ($bail !== null && $d->commonArea) {
            $principal = array_values(array_filter($bail->units, fn ($ligne): bool => $ligne->isMain))[0] ?? $bail->units[0] ?? throw ErrorCode::UnitInvalid->problem();

            return [null, $this->lots->find($principal->unitId)->propertyId];
        }

        if ($d->mandateId !== null && $d->commonArea) {
            $mandat = $this->mandats->find($d->mandateId);
            $lots = array_values($this->lots->findMany($mandat->unitIds));

            return [null, ($lots[0] ?? throw ErrorCode::UnitInvalid->problem())->propertyId];
        }

        throw ErrorCode::UnitInvalid->problem('Un lot ou les parties communes du site doivent être désignés.');
    }

    private function replay(Intervention $existante, string $empreinte): Intervention
    {
        if ($existante->request_hash === null || ! hash_equals($existante->request_hash, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante;
    }
}
