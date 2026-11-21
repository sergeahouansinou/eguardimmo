<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Mandates\Data\ActivateMandateData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\Mandates;
use App\Modules\Mandates\Support\CoverageGuard;
use App\Modules\Mandates\Support\DraftMandateStructure;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ActivateMandate
{
    public function __construct(
        private Mandates $mandats,
        private CoverageGuard $garde,
        private DraftMandateStructure $structure,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Aucune lecture non verrouillante avant le verrou des lots : sous REPEATABLE READ elle figerait l'instantané et le
     * second de deux mandats qui visent le même lot ne verrait pas le premier. Mandat et lignes se lisent donc
     * `FOR UPDATE` ; tout le reste (mandant, lots) se lit après.
     */
    public function handle(Mandate $mandate, ActivateMandateData $donnees): Mandate
    {
        if ($donnees->signedOn > CarbonImmutable::today()->toDateString()) {
            throw ErrorCode::MandateSignatureInvalid->problem('La date de signature ne peut pas être dans le futur.');
        }

        if ($donnees->signedFileId !== null && ! $this->documents->exists($donnees->signedFileId)) {
            throw ErrorCode::MandateSignatureInvalid->problem('Le fichier signé est introuvable dans votre organisation.');
        }

        return DB::transaction(function () use ($mandate, $donnees): Mandate {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->status !== MandateStatus::Draft) {
                throw ErrorCode::MandateNotDraft->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            $lignes = array_values($mandat->units()->orderBy('valid_from')->orderBy('id')->lockForUpdate()->get()->all());

            if ($lignes === []) {
                throw ErrorCode::MandateNoUnit->problem();
            }

            if ($mandat->ends_on->toDateString() <= CarbonImmutable::today()->toDateString()) {
                throw ErrorCode::MandatePeriodInvalid->problem('Le mandat est déjà échu : modifiez ses dates avant de l\'activer.');
            }

            $this->garde->assertFree($mandat, $lignes);
            $this->structure->assertMandant($mandat->mandant_party_id);
            $this->structure->assertUnitsAvailable(array_map(fn (MandateUnit $l): string => $l->unit_id, $lignes));

            $mandat->status = MandateStatus::Active;
            $mandat->setAttribute('signed_on', $donnees->signedOn);
            $mandat->signed_file_id = $donnees->signedFileId;
            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            $this->audit->handle('mandates.mandate.activated', subject: $mandat, metadata: [
                'signed_on' => $donnees->signedOn,
                'signed_file_id' => $donnees->signedFileId,
                'unit_ids' => array_map(fn (MandateUnit $l): string => $l->unit_id, $lignes),
            ]);

            return $mandat;
        });
    }
}
