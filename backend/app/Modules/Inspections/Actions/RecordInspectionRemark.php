<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Data\NewRemarkPhotoData;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Events\InspectionRemarkReceived;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Inspections\Models\InspectionRemarkFile;
use App\Modules\Inspections\Support\RemarkWindows;
use App\Modules\Leases\Data\TenantStandingData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class RecordInspectionRemark
{
    public function __construct(
        private LeaseDirectory $baux,
        private DocumentStore $fichiers,
        private CurrentOrganization $contexte,
        private RecordAudit $audit,
    ) {}

    /**
     * La remarque est une trace : elle ne modifie ni l'état des lieux ni le bail. Rejouable par `client_id` pour une même fiche.
     *
     * @param  list<NewRemarkPhotoData>  $photos
     * @return array{remark: InspectionRemark, replayed: bool}
     */
    public function handle(TenantStandingData $position, User $user, Inspection $etat, RemarkKind $kind, string $body, array $photos, string $clientId, CarbonImmutable $today): array
    {
        return $this->contexte->run($position->organizationId, function () use ($position, $user, $etat, $kind, $body, $photos, $clientId, $today): array {
            $existante = $this->existante($etat, $position, $clientId);

            if ($existante !== null) {
                return $this->rejouer($existante, $kind, $body);
            }

            $debutBail = CarbonImmutable::parse($this->baux->find($position->leaseId)->startsOn);

            if (! in_array($kind, RemarkWindows::open($etat, $position->active, $debutBail, $today), true)) {
                throw ErrorCode::InspectionRemarkWindowClosed->problem();
            }

            try {
                $remarque = DB::transaction(function () use ($position, $user, $etat, $kind, $body, $photos, $clientId): InspectionRemark {
                    $remarque = InspectionRemark::query()->create([
                        'inspection_id' => $etat->id,
                        'party_id' => $position->partyId,
                        'author_user_id' => $user->id,
                        'kind' => $kind,
                        'body' => $body,
                        'client_id' => $clientId,
                    ]);

                    foreach ($photos as $rang => $photo) {
                        InspectionRemarkFile::query()->create([
                            'remark_id' => $remarque->id,
                            'stored_file_id' => $this->fichiers->store($photo->source, $photo->name, FileCategory::Supporting, DocumentSubject::tenantSpace($position->leaseId))->id,
                            'position' => $rang + 1,
                        ]);
                    }

                    $this->audit->handle('inspections.remark.created', $user->id, ['kind' => $kind->value, 'photos' => count($photos)], $remarque);

                    return $remarque;
                });
            } catch (UniqueConstraintViolationException $erreur) {
                return $this->rejouer($this->existante($etat, $position, $clientId) ?? throw $erreur, $kind, $body);
            }

            InspectionRemarkReceived::dispatch($remarque->id, $etat->id, $etat->lease_id, $position->organizationId, $position->partyId);

            return ['remark' => $remarque->load('files'), 'replayed' => false];
        });
    }

    private function existante(Inspection $etat, TenantStandingData $position, string $clientId): ?InspectionRemark
    {
        return InspectionRemark::query()->with('files')->where('inspection_id', $etat->id)->where('party_id', $position->partyId)->where('client_id', $clientId)->first();
    }

    /**
     * @return array{remark: InspectionRemark, replayed: bool}
     */
    private function rejouer(InspectionRemark $existante, RemarkKind $kind, string $body): array
    {
        if ($existante->kind !== $kind || $existante->body !== $body) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['remark' => $existante, 'replayed' => true];
    }
}
