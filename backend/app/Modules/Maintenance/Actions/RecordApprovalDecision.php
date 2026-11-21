<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\ApprovalDecisionData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalDecision;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\DecidedVia;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Events\ApprovalDecided;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Support\ApprovalEffects;
use App\Modules\Maintenance\Support\Attachments;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteLookup;
use App\Modules\Maintenance\Support\Timeline;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class RecordApprovalDecision
{
    public function __construct(
        private Locks $verrous,
        private QuoteLookup $devis,
        private Attachments $pieces,
        private ApprovalEffects $effets,
        private Timeline $chronologie,
        private RecordAudit $audit,
        private ExpireApprovals $expiration,
    ) {}

    /**
     * Décision du mandant reçue par l'agence, avec sa pièce écrite en preuve. Le rejeu de la même décision répond 200 sans rien
     * changer ; la décision contraire sur une demande tranchée est refusée (409).
     *
     * @return array{approval: InterventionApproval, replayed: bool}
     */
    public function handle(string $interventionId, string $approvalId, ApprovalDecisionData $donnees): array
    {
        $resultat = DB::transaction(function () use ($interventionId, $approvalId, $donnees): array|false {
            $intervention = $this->verrous->intervention($interventionId);
            $demande = $this->devis->approval($approvalId, $interventionId);
            $cible = match ($donnees->decision) {
                ApprovalDecision::Accept => ApprovalStatus::Accepted,
                ApprovalDecision::Refuse => ApprovalStatus::Refused,
                ApprovalDecision::Question => ApprovalStatus::Question,
            };

            if ($demande->status === $cible) {
                return ['approval' => $demande, 'replayed' => true];
            }

            if (! $demande->status->isOpen()) {
                throw ErrorCode::ApprovalAlreadyDecided->problem();
            }

            if ($demande->decide_before->lessThanOrEqualTo(now())) {
                $this->expiration->expireLocked($demande, $intervention, CarbonImmutable::now());

                return false;
            }

            if ($donnees->proofFileId === null) {
                throw ErrorCode::ApprovalProofRequired->problem();
            }

            $preuve = $this->pieces->resolve($donnees->proofFileId, $intervention->id, FileKind::Proof);

            if (InterventionApproval::query()->where('proof_file_id', $preuve->id)->whereKeyNot($demande->id)->exists()) {
                throw ErrorCode::FileInvalid->problem('Cette pièce justifie déjà une autre décision.');
            }

            $final = $cible !== ApprovalStatus::Question;

            $demande->forceFill([
                'status' => $cible,
                'decided_at' => $final ? now() : null,
                'decided_via' => DecidedVia::AgencyRecorded,
                'decider_party_id' => $intervention->mandant_party_id,
                'decided_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
                'comment' => $donnees->comment,
                'proof_file_id' => $preuve->id,
                'lock_version' => $demande->lock_version + 1,
            ])->save();

            $this->effets->apply($intervention, $demande, $cible);

            $this->chronologie->add($intervention, EventKind::ApprovalDecided, ActorKind::Owner, 'Décision du mandant enregistrée : '.$cible->value.'.', metadata: ['approval_id' => $demande->id], proprietaire: true);
            $this->audit->handle('maintenance.approval.recorded_for_owner', subject: $demande, metadata: ['intervention_id' => $intervention->id, 'status' => $cible->value]);
            ApprovalDecided::dispatch($intervention->id, $demande->id, $cible->value, $intervention->organization_id, $intervention->reference, DecidedVia::AgencyRecorded->value, $intervention->mandant_party_id);

            return ['approval' => $demande, 'replayed' => false];
        });

        if ($resultat === false) {
            throw ErrorCode::ApprovalAlreadyDecided->problem('La demande a expiré avant la décision.');
        }

        return $resultat;
    }
}
