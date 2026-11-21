<?php

declare(strict_types=1);

namespace App\Modules\Charges\Actions;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\StatementSettlement;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Jurisdictions\ChargeRulesRegistry;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementPlan;
use App\Modules\Charges\Support\Currencies;
use App\Modules\Charges\Support\Idempotency;
use App\Modules\Charges\Support\Locks;
use App\Modules\Charges\Support\Operators;
use App\Modules\Charges\Support\ShareCalculator;
use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\PublicApi\RentAdjustments;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Money\Money;

final readonly class RecordInstallmentPlan
{
    private const string SCOPE = 'statement.plan';

    public function __construct(
        private Locks $verrous,
        private Idempotency $idempotence,
        private ChargeRulesRegistry $juridictions,
        private ShareCalculator $calcul,
        private RentAdjustments $rent,
        private Operators $operateurs,
        private RecordAudit $audit,
    ) {}

    /**
     * Douze mensualités à la place de la ligne unique, tant qu'elle n'est pas facturée (ADR 0034 § 6) : de droit si le décompte est tardif, sinon par accord.
     *
     * @param  string  $base  `late_statement` ou `agreement`
     */
    public function handle(string $statementId, string $motif, string $base, string $cle): ChargeStatementPlan
    {
        $exerciceId = ChargeStatement::query()->whereKey($statementId)->value('exercise_id');

        if (! is_string($exerciceId)) {
            throw ErrorCode::StatementNotFound->problem();
        }

        return DB::transaction(function () use ($statementId, $exerciceId, $motif, $base, $cle): ChargeStatementPlan {
            $exercice = $this->verrous->exerciseOfProperty($exerciceId);
            $decompte = $this->verrous->statement($statementId);
            $empreinte = Idempotency::fingerprint([$statementId, $motif, $base]);
            $rejeu = $this->idempotence->replayed(self::SCOPE, $cle, $empreinte);

            if ($rejeu !== null) {
                return ChargeStatementPlan::query()->whereKey($rejeu)->firstOrFail();
            }

            $this->assertEligible($decompte, $base, $exercice->period_end);
            $retirees = $this->rent->cancelPending($decompte->lease_id, $decompte->id);

            if ($retirees === 0) {
                throw ErrorCode::PlanInvalid->problem('Ce solde n\'est plus en attente de facturation : il ne peut plus être étalé.');
            }

            $plan = ChargeStatementPlan::query()->create(['statement_id' => $decompte->id, 'reason' => $motif, 'idempotency_key' => $cle, 'fingerprint' => $empreinte, 'created_by_user_id' => $this->operateurs->userId()]);
            $this->schedule($decompte, $plan);
            $this->idempotence->remember(self::SCOPE, $cle, $empreinte, $plan->id);
            $this->audit->handle('charges.statement.plan_recorded', subject: $decompte, metadata: ['plan_id' => $plan->id, 'basis' => $base]);

            return $plan;
        });
    }

    private function assertEligible(ChargeStatement $decompte, string $base, Carbon $finExercice): void
    {
        if ($decompte->status !== StatementStatus::Issued || ! $decompte->balance->isPositive() || $decompte->settlement !== StatementSettlement::NextInstallments) {
            throw ErrorCode::PlanInvalid->problem('Seul le solde positif d\'un décompte émis, en attente de facturation, peut être étalé.');
        }

        if (ChargeStatementPlan::query()->where('statement_id', $decompte->id)->exists()) {
            throw ErrorCode::StatementStateInvalid->problem('Un étalement est déjà enregistré pour ce décompte.');
        }

        $regles = $this->juridictions->for((string) $decompte->snapshot['lease']['jurisdiction']);
        $emisLe = CarbonImmutable::parse($decompte->issued_at);

        if ($base === 'late_statement' && ! $regles->isLate(CarbonImmutable::parse($finExercice), $emisLe)) {
            throw ErrorCode::PlanInvalid->problem('Ce décompte n\'est pas tardif : l\'étalement ne peut se faire que par accord avec le locataire.');
        }
    }

    private function schedule(ChargeStatement $decompte, ChargeStatementPlan $plan): void
    {
        $depart = CarbonImmutable::parse((string) $decompte->not_before);
        $lignes = [];

        foreach ($this->calcul->twelfths(new Money((int) $decompte->balance->getAmount(), Currencies::of($decompte->currency))) as $rang => $montant) {
            $lignes[] = new AdjustmentLineData($rang + 1, $montant, sprintf('Régularisation des charges, mensualité %d/12', $rang + 1), $depart->addMonths($rang));
        }

        $this->rent->schedule($decompte->lease_id, $plan->id, $lignes, $decompte->mandate_id, $decompte->mandant_party_id, CarbonImmutable::today());
    }
}
