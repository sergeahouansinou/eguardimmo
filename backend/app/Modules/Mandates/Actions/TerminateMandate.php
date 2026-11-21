<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\TerminateMandateData;
use App\Modules\Mandates\Enums\EndRequestStatus;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Events\MandateEndRequestDecided;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\MandateEndRequests;
use App\Modules\Mandates\Queries\Mandates;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class TerminateMandate
{
    public function __construct(
        private Mandates $mandats,
        private MandateEndRequests $demandes,
        private RecordAudit $audit,
    ) {}

    /**
     * Le mandat reste en vigueur jusqu'au dernier jour de préavis : sa fin recule, jamais elle n'avance. Il ne libère
     * donc le lot qu'à cette date, sans verrou de lots.
     */
    public function handle(Mandate $mandate, TerminateMandateData $donnees, string $userId): Mandate
    {
        return DB::transaction(function () use ($mandate, $donnees, $userId): Mandate {
            $mandat = $this->mandats->locked($mandate->id);

            if ($mandat->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::MandateStaleVersion->problem();
            }

            if ($mandat->archived_at !== null) {
                throw ErrorCode::MandateArchived->problem();
            }

            if (! in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true)) {
                throw ErrorCode::MandateNotRunning->problem();
            }

            $nouvelleFin = CarbonImmutable::parse($donnees->effectiveOn)->addDay();
            $ancienneFin = $mandat->ends_on->toDateString();
            $this->assertDates($mandat, $donnees, $nouvelleFin);

            $mandat->status = MandateStatus::Terminated;
            $mandat->setAttribute('ends_on', $nouvelleFin->toDateString());
            $mandat->setAttribute('notice_given_on', $donnees->noticeGivenOn);
            $mandat->termination_reason = $donnees->reason;
            $mandat->termination_note = $donnees->note;
            $mandat->lock_version = $mandat->lock_version + 1;
            $mandat->save();

            $this->audit->handle('mandates.mandate.terminated', subject: $mandat, metadata: [
                'notice_given_on' => $donnees->noticeGivenOn,
                'effective_on' => $donnees->effectiveOn,
                'previous_ends_on' => $ancienneFin,
                'amicable' => $donnees->amicable,
            ]);

            $this->fulfilEndRequest($mandat, $userId);

            return $mandat;
        });
    }

    private function fulfilEndRequest(Mandate $mandat, string $userId): void
    {
        $demande = $this->demandes->lockedPendingOf($mandat->id);

        if ($demande === null) {
            return;
        }

        $demande->status = EndRequestStatus::Fulfilled;
        $demande->decided_at = now();
        $demande->decided_by_user_id = $userId;
        $demande->save();

        $this->audit->handle('mandates.end_request.fulfilled', $userId, ['reference' => $mandat->reference], $demande);

        MandateEndRequestDecided::dispatch($mandat->organization_id, $mandat->id, $mandat->mandant_party_id, $demande->id, $mandat->reference, EndRequestStatus::Fulfilled);
    }

    private function assertDates(Mandate $mandat, TerminateMandateData $donnees, CarbonImmutable $nouvelleFin): void
    {
        if ($donnees->noticeGivenOn > CarbonImmutable::today()->toDateString()) {
            throw ErrorCode::MandateTerminationInvalid->problem('Le préavis ne peut pas être donné dans le futur.');
        }

        if ($donnees->effectiveOn < $donnees->noticeGivenOn || $donnees->effectiveOn < $mandat->starts_on->toDateString()) {
            throw ErrorCode::MandateTerminationInvalid->problem('La fin du mandat ne peut précéder le préavis ni le début du mandat.');
        }

        if ($nouvelleFin->toDateString() > $mandat->ends_on->toDateString()) {
            throw ErrorCode::MandateTerminationInvalid->problem('La résiliation ne peut pas prolonger le mandat : utilisez le renouvellement.');
        }

        $finDePreavis = CarbonImmutable::parse($donnees->noticeGivenOn)->addMonthsNoOverflow($mandat->notice_months)->subDay()->toDateString();

        if (! $donnees->amicable && $donnees->effectiveOn < $finDePreavis) {
            throw ErrorCode::MandateTerminationInvalid->problem("Le préavis de {$mandat->notice_months} mois n'est pas respecté : au plus tôt le {$finDePreavis}, ou résiliation amiable.");
        }
    }
}
