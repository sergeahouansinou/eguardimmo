<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Data\NewInspectionData;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class RecordInspection
{
    public function __construct(
        private LeaseDirectory $baux,
        private DocumentStore $fichiers,
        private RecordAudit $audit,
        private Entitlements $droits,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * Enregistre un état des lieux réalisé hors application ; il reste invisible du locataire jusqu'à sa publication. Rejouable par `client_id`.
     *
     * @return array{inspection: Inspection, replayed: bool}
     */
    public function handle(User $user, string $leaseId, NewInspectionData $donnees, FileSource $source, string $nomFichier): array
    {
        $this->baux->find($leaseId);

        $existant = Inspection::query()->where('client_id', $donnees->clientId)->first();

        if ($existant !== null) {
            return $this->rejouer($existant, $leaseId, $donnees);
        }

        try {
            $etat = DB::transaction(function () use ($user, $leaseId, $donnees, $source, $nomFichier): Inspection {
                $this->droits->assertWithin($this->organisation->id(), Feature::Inspections, fn (): int => Inspection::query()->count());
                $fichier = $this->fichiers->store($source, $nomFichier, FileCategory::Supporting, DocumentSubject::tenantSpace($leaseId));

                $etat = Inspection::query()->create([
                    'lease_id' => $leaseId,
                    'kind' => $donnees->kind,
                    'performed_on' => $donnees->performedOn,
                    'performed_by' => $donnees->performedBy,
                    'stored_file_id' => $fichier->id,
                    'signatories' => $donnees->signatories,
                    'exit_matches_entry' => $donnees->exitMatchesEntry,
                    'created_by_user_id' => $user->id,
                    'client_id' => $donnees->clientId,
                ]);
                $this->audit->handle('inspections.inspection.recorded', $user->id, ['kind' => $donnees->kind->value], $etat);

                return $etat;
            });
        } catch (UniqueConstraintViolationException $erreur) {
            return $this->rejouer(Inspection::query()->where('client_id', $donnees->clientId)->firstOr(fn () => throw $erreur), $leaseId, $donnees);
        }

        return ['inspection' => $etat, 'replayed' => false];
    }

    /**
     * @return array{inspection: Inspection, replayed: bool}
     */
    private function rejouer(Inspection $existant, string $leaseId, NewInspectionData $donnees): array
    {
        $memes = $existant->lease_id === $leaseId && $existant->kind === $donnees->kind && $existant->performed_by === $donnees->performedBy
            && $existant->performed_on->toDateString() === $donnees->performedOn->toDateString()
            && $existant->signatories === $donnees->signatories && $existant->exit_matches_entry === $donnees->exitMatchesEntry;

        if (! $memes) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['inspection' => $existant, 'replayed' => true];
    }
}
