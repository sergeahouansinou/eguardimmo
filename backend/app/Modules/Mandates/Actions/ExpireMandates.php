<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Actions;

use App\Modules\Mandates\Data\RenewMandateData;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Queries\Mandates;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ExpireMandates
{
    public function __construct(
        private CurrentOrganization $contexte,
        private Mandates $mandats,
        private RenewMandate $renouvellement,
    ) {}

    /**
     * Tâche planifiée de toutes les organisations, chacune sous son contexte : un mandat échu à reconduction tacite est
     * prolongé de sa durée de reconduction, les autres passent à `expired`. Une reconduction qui chevauche un autre
     * mandat du lot devient une expiration. Rejouable : un mandat déjà traité n'est plus échu.
     *
     * @return array{renewed: int, expired: int}
     */
    public function handle(CarbonImmutable $today): array
    {
        $bilan = ['renewed' => 0, 'expired' => 0];

        $echus = DB::table('mandates')
            ->whereIn('status', [MandateStatus::Active->value, MandateStatus::Suspended->value])
            ->where('ends_on', '<=', $today->toDateString())
            ->orderBy('organization_id')->orderBy('id')
            ->get(['organization_id', 'id']);

        foreach ($echus as $ligne) {
            $resultat = $this->contexte->run((string) $ligne->organization_id, fn (): ?string => $this->process((string) $ligne->id, $today));

            if ($resultat !== null) {
                $bilan[$resultat]++;
            }
        }

        return $bilan;
    }

    /**
     * @return 'renewed'|'expired'|null
     */
    private function process(string $id, CarbonImmutable $today): ?string
    {
        return DB::transaction(function () use ($id, $today): ?string {
            $mandat = $this->mandats->locked($id);

            if (! in_array($mandat->status, [MandateStatus::Active, MandateStatus::Suspended], true) || $mandat->ends_on->toDateString() > $today->toDateString()) {
                return null;
            }

            if ($mandat->tacit_renewal && $this->renewTacitly($mandat, $today)) {
                return 'renewed';
            }

            $courant = $this->mandats->locked($id);
            $courant->status = MandateStatus::Expired;
            $courant->lock_version = $courant->lock_version + 1;
            $courant->save();

            return 'expired';
        });
    }

    private function renewTacitly(Mandate $mandat, CarbonImmutable $today): bool
    {
        while ($mandat->ends_on->toDateString() <= $today->toDateString()) {
            try {
                $mandat = $this->renouvellement->handle($mandat, new RenewMandateData($mandat->lock_version, $mandat->renewal_months));
            } catch (ApiProblem $probleme) {
                if ($probleme->problemCode !== ErrorCode::MandateOverlap->value) {
                    throw $probleme;
                }

                return false;
            }
        }

        return true;
    }
}
