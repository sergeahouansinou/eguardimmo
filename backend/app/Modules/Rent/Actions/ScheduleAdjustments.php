<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\Data\ScheduledAdjustmentData;
use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Modules\Rent\Enums\ErrorCode;
use App\Modules\Rent\Models\RentAdjustment;
use App\Modules\Rent\Support\AdjustmentInstallments;
use App\Modules\Rent\Support\Schedules;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class ScheduleAdjustments
{
    public const string SOURCE_STATEMENT = 'charge_statement';

    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private AdjustmentInstallments $ponctuelles,
    ) {}

    /**
     * Programme les lignes d'un décompte sur le bail : en attente de la première échéance générée dont la période commence au
     * plus tôt à la date de la ligne, ou échéance ponctuelle quand le bail n'en aura plus. Rejouable : même contenu, mêmes
     * lignes ; contenu différent, 409. À appeler dans la transaction de l'appelant, après le verrou du décompte.
     *
     * @param  list<AdjustmentLineData>  $lignes
     * @return list<ScheduledAdjustmentData>
     */
    public function handle(string $leaseId, string $sourceId, array $lignes, ?string $mandateId, ?string $mandantPartyId, CarbonImmutable $today): array
    {
        $bail = $this->baux->billing($leaseId);
        $this->echeanciers->assertBillable($bail);

        return DB::transaction(function () use ($bail, $sourceId, $lignes, $mandateId, $mandantPartyId, $today): array {
            $this->echeanciers->locked($bail, $today);
            $existantes = RentAdjustment::query()->where('source_type', self::SOURCE_STATEMENT)->where('source_id', $sourceId)->orderBy('position')->get();

            if ($existantes->isNotEmpty()) {
                return $this->replay(array_values($existantes->all()), $lignes);
            }

            $resultat = [];

            foreach ($lignes as $ligne) {
                if (! $ligne->amount->isPositive()) {
                    throw ErrorCode::AdjustmentConflict->problem('Une ligne de régularisation est strictement positive.');
                }

                $ajustement = new RentAdjustment;
                $ajustement->forceFill([
                    'lease_id' => $bail->leaseId,
                    'source_type' => self::SOURCE_STATEMENT,
                    'source_id' => $sourceId,
                    'position' => $ligne->position,
                    'label' => mb_substr($ligne->label, 0, 255),
                    'amount' => $ligne->amount,
                    'currency' => $bail->currency,
                    'not_before' => $ligne->notBefore->toDateString(),
                    'status' => AdjustmentStatus::Pending,
                ]);

                if ($this->ponctuelles->isStandalone($bail, $ligne->notBefore)) {
                    $echeance = $this->ponctuelles->create($bail, $ligne, $mandateId, $mandantPartyId);
                    $ajustement->status = AdjustmentStatus::Billed;
                    $ajustement->installment_id = $echeance->id;
                }

                $ajustement->save();
                $resultat[] = $this->describe($ajustement);
            }

            return $resultat;
        });
    }

    /**
     * @param  list<RentAdjustment>  $existantes
     * @param  list<AdjustmentLineData>  $lignes
     * @return list<ScheduledAdjustmentData>
     */
    private function replay(array $existantes, array $lignes): array
    {
        if (count($existantes) !== count($lignes)) {
            throw ErrorCode::AdjustmentConflict->problem();
        }

        $resultat = [];

        foreach ($existantes as $i => $ajustement) {
            $ligne = $lignes[$i];

            if ($ajustement->position !== $ligne->position || ! $ajustement->amount->equals($ligne->amount) || $ajustement->not_before->toDateString() !== $ligne->notBefore->toDateString()) {
                throw ErrorCode::AdjustmentConflict->problem();
            }

            $resultat[] = $this->describe($ajustement);
        }

        return $resultat;
    }

    private function describe(RentAdjustment $ajustement): ScheduledAdjustmentData
    {
        return new ScheduledAdjustmentData($ajustement->position, $ajustement->installment_id === null ? 'pending' : 'installment', $ajustement->installment_id);
    }
}
