<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Maintenance\Data\OwnerDecisionData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ApprovalDecision;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\DecidedVia;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Events\ApprovalDecided;
use App\Modules\Maintenance\Models\ApprovalEvidence;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Support\ApprovalDigest;
use App\Modules\Maintenance\Support\ApprovalEffects;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\QuoteLookup;
use App\Modules\Maintenance\Support\Settings;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class DecideApproval
{
    public function __construct(
        private Locks $verrous,
        private QuoteLookup $devis,
        private ApprovalEffects $effets,
        private Timeline $chronologie,
        private RecordAudit $audit,
        private ExpireApprovals $expiration,
        private MandateDirectory $mandats,
    ) {}

    /**
     * Décision du mandant dans son espace. Suppose le contexte de l'organisation de l'intervention. Le mandant décide ce qu'il a
     * vu : version de la demande, empreinte du devis et version du texte de mention doivent être celles du serveur (409
     * `approval_stale`, rien n'est écrit). Même clé d'idempotence ou même décision rejouée : 200 sans écriture ; décision contraire
     * sur une demande tranchée : 409. La preuve s'écrit dans la même transaction.
     *
     * @return array{approval: InterventionApproval, replayed: bool}
     */
    public function handle(string $interventionId, string $approvalId, OwnerDecisionData $donnees): array
    {
        $resultat = DB::transaction(function () use ($interventionId, $approvalId, $donnees): array|false {
            $intervention = $this->verrous->intervention($interventionId);
            $this->assertStillAllowed($intervention, $donnees);
            $demande = $this->devis->approval($approvalId, $interventionId);
            $cible = $this->target($donnees->decision);

            $rejeu = ApprovalEvidence::query()->where('user_id', $donnees->userId)->where('idempotency_key', $donnees->idempotencyKey)->first();

            if ($rejeu !== null) {
                if ($rejeu->approval_id !== $demande->id || $rejeu->decision !== $donnees->decision || $this->commentaireDeLaPreuve($rejeu) !== $donnees->comment) {
                    throw ErrorCode::IdempotencyKeyReused->problem();
                }

                return ['approval' => $demande, 'replayed' => true];
            }

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

            $devis = $demande->quote_id === null ? null : $this->devis->quote($demande->quote_id, $intervention->id);
            $empreinte = ApprovalDigest::of($demande, $devis);

            if ($donnees->lockVersion !== $demande->lock_version
                || ! hash_equals($empreinte, $donnees->quoteFingerprint)
                || $donnees->statementVersion !== Settings::ownerStatementVersion()) {
                throw ErrorCode::ApprovalStale->problem();
            }

            $instant = CarbonImmutable::now();
            $demande->forceFill([
                'status' => $cible,
                'decided_at' => $cible === ApprovalStatus::Question ? null : $instant,
                'decided_via' => DecidedVia::OwnerSpace,
                'decider_party_id' => $intervention->mandant_party_id,
                'decided_by_user_id' => $donnees->userId,
                'comment' => $donnees->comment,
                'lock_version' => $demande->lock_version + 1,
            ])->save();

            $preuve = $this->prove($intervention, $demande, $devis?->supplier_party_id, $empreinte, $donnees, $instant);
            $this->effets->apply($intervention, $demande, $cible);

            $this->chronologie->add($intervention, EventKind::ApprovalDecided, ActorKind::Owner, 'Décision du mandant : '.$this->label($cible).'.', metadata: ['approval_id' => $demande->id], proprietaire: true);
            $this->audit->handle('maintenance.approval.decided', $donnees->userId, ['intervention_id' => $intervention->id, 'status' => $cible->value, 'decided_via' => DecidedVia::OwnerSpace->value, 'evidence_id' => $preuve->id], $demande);
            ApprovalDecided::dispatch($intervention->id, $demande->id, $cible->value, $intervention->organization_id, $intervention->reference, DecidedVia::OwnerSpace->value, $intervention->mandant_party_id);

            return ['approval' => $demande, 'replayed' => false];
        });

        if ($resultat === false) {
            throw ErrorCode::ApprovalAlreadyDecided->problem('La demande a expiré avant la décision.');
        }

        return $resultat;
    }

    private function commentaireDeLaPreuve(ApprovalEvidence $preuve): ?string
    {
        $contenu = json_decode($preuve->payload, true, 512, JSON_THROW_ON_ERROR);

        return is_array($contenu) && is_string($contenu['comment'] ?? null) ? $contenu['comment'] : null;
    }

    private function assertStillAllowed(Intervention $intervention, OwnerDecisionData $donnees): void
    {
        $visible = null;

        foreach ($this->mandats->visibleToOwner($donnees->userId, $intervention->organization_id) as $candidat) {
            if ($candidat->accessId === $donnees->accessId && $candidat->mandantPartyId === $intervention->mandant_party_id) {
                $visible = $candidat;
            }
        }

        if (! $visible instanceof OwnerVisibleData) {
            throw ErrorCode::OwnerInterventionNotFound->problem();
        }

        $this->mandats->assertOwnerWritable($visible);
    }

    private function prove(Intervention $intervention, InterventionApproval $demande, ?string $prestataire, string $empreinteDevis, OwnerDecisionData $donnees, CarbonImmutable $instant): ApprovalEvidence
    {
        $mandantId = (string) $intervention->mandant_party_id;
        $contenu = ApprovalDigest::canonical([
            'intervention' => $intervention->id,
            'reference' => $intervention->reference,
            'approval' => $demande->id,
            'quote' => $demande->quote_id,
            'quote_fingerprint' => $empreinteDevis,
            'amount' => (int) $demande->amount->getAmount(),
            'currency' => $demande->currency,
            'supplier' => $prestataire ?? $intervention->supplier_party_id,
            'decision' => $donnees->decision->value,
            'comment' => $donnees->comment,
            'statement_version' => $donnees->statementVersion,
            'decided_at' => $instant->format('Y-m-d\TH:i:s.uP'),
            'user' => $donnees->userId,
            'access' => $donnees->accessId,
            'mandant' => $mandantId,
            'proof_method' => $donnees->proof->method,
            'proof_at' => $donnees->proof->at->format('Y-m-d\TH:i:sP'),
        ]);

        return ApprovalEvidence::query()->create([
            'intervention_id' => $intervention->id,
            'approval_id' => $demande->id,
            'quote_id' => $demande->quote_id,
            'mandant_party_id' => $mandantId,
            'access_id' => $donnees->accessId,
            'user_id' => $donnees->userId,
            'decision' => $donnees->decision,
            'amount' => (int) $demande->amount->getAmount(),
            'currency' => $demande->currency,
            'fingerprint' => hash('sha256', $contenu),
            'quote_fingerprint' => $empreinteDevis,
            'statement_version' => $donnees->statementVersion,
            'payload' => $contenu,
            'proof_method' => $donnees->proof->method,
            'proof_at' => $donnees->proof->at,
            'ip' => $donnees->ip,
            'user_agent' => $donnees->userAgent === null ? null : mb_substr($donnees->userAgent, 0, 255),
            'idempotency_key' => $donnees->idempotencyKey,
            'decided_at' => $instant,
        ]);
    }

    private function target(ApprovalDecision $decision): ApprovalStatus
    {
        return match ($decision) {
            ApprovalDecision::Accept => ApprovalStatus::Accepted,
            ApprovalDecision::Refuse => ApprovalStatus::Refused,
            ApprovalDecision::Question => ApprovalStatus::Question,
        };
    }

    private function label(ApprovalStatus $cible): string
    {
        return match ($cible) {
            ApprovalStatus::Accepted => 'devis accepté',
            ApprovalStatus::Refused => 'devis refusé',
            default => 'précision demandée',
        };
    }
}
