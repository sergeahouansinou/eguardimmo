<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Leases\Data\LeaseBillingData;
use App\Modules\Leases\Data\LeaseData;
use App\Modules\Leases\Data\LeaseUnitData;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Leases\PublicApi\LeaseParticipants;
use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Modules\Rent\Enums\AdjustmentStatus;
use App\Modules\Rent\Enums\InstallmentKind;
use App\Modules\Rent\Enums\InstallmentStatus;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\InstallmentLine;
use App\Modules\Rent\Support\AdjustmentLines;
use App\Modules\Rent\Support\BillingCalendar;
use App\Modules\Rent\Support\DraftBuilder;
use App\Modules\Rent\Support\DraftLine;
use App\Modules\Rent\Support\InstallmentDraft;
use App\Modules\Rent\Support\Schedules;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class GenerateInstallments
{
    private const int PERIODES_MAX = 600;

    public function __construct(
        private Schedules $echeanciers,
        private LeaseSchedule $baux,
        private LeaseDirectory $annuaire,
        private LeaseParticipants $participants,
        private DraftBuilder $constructeur,
        private AdjustmentLines $ajustements,
    ) {}

    /**
     * Génère les échéances dont l'avis est émissible à $today (échéance moins le délai d'avis) et qui manquent. Idempotent :
     * le verrou du bail sérialise les générations, `(lease_id, period_start)` est unique, et une période déjà générée
     * (même annulée) n'est jamais refaite. Les lignes déjà générées ne bougent pas : une révision de loyer ne les touche pas.
     *
     * @return array{created: int, existing: int}
     */
    public function handle(LeaseBillingData $bail, CarbonImmutable $today): array
    {
        $this->echeanciers->assertBillable($bail);

        return DB::transaction(function () use ($bail, $today): array {
            $echeancier = $this->echeanciers->locked($bail, $today);
            $mois = BillingCalendar::months($bail->periodicity);
            $ancre = CarbonImmutable::parse($echeancier->billing_from->toDateString())->startOfDay();
            $fin = $bail->effectiveEndsOn === null ? null : CarbonImmutable::parse($bail->effectiveEndsOn)->startOfDay();
            $existantes = array_flip(Installment::query()->where('lease_id', $bail->leaseId)->where('kind', InstallmentKind::Periodic->value)->pluck('period_start')->map(fn (mixed $d): string => substr((string) $d, 0, 10))->all());
            $bilan = ['created' => 0, 'existing' => 0];
            $donneesBail = null;

            for ($rang = 0; $rang < self::PERIODES_MAX; $rang++) {
                $debut = BillingCalendar::periodStart($ancre, $rang, $mois);
                $echeance = BillingCalendar::dueDate($bail->billingTiming, $debut, $mois, $bail->dueDay);

                if (($fin !== null && $debut->greaterThanOrEqualTo($fin)) || BillingCalendar::noticeDate($echeance)->greaterThan($today)) {
                    break;
                }

                if (isset($existantes[$debut->toDateString()])) {
                    $bilan['existing']++;

                    continue;
                }

                $finExclue = BillingCalendar::periodEndExclusive($debut, $mois);
                $brouillon = $this->constructeur->build($bail, $debut, $finExclue, $this->baux->linesBetween($bail->leaseId, $debut, $finExclue->subDay()));

                if ($brouillon === null) {
                    continue;
                }

                $reprises = $this->ajustements->eligible($bail->leaseId, $brouillon);
                $donneesBail ??= $this->annuaire->find($bail->leaseId);
                $creee = $this->create($bail, $donneesBail, $this->ajustements->attach($brouillon, $reprises), $echeance);

                foreach ($reprises as $reprise) {
                    $reprise->status = AdjustmentStatus::Billed;
                    $reprise->installment_id = $creee->id;
                    $reprise->save();
                }

                $bilan['created']++;
            }

            return $bilan;
        });
    }

    private function create(LeaseBillingData $bail, LeaseData $donnees, InstallmentDraft $brouillon, CarbonImmutable $echeance): Installment
    {
        $locataires = $this->participants->tenantsAt($bail->leaseId, $brouillon->occupiedFrom);

        $echeanceCreee = Installment::query()->create([
            'lease_id' => $bail->leaseId,
            'party_id' => $locataires[0]->partyId ?? null,
            'unit_id' => $this->unitAt($donnees, $brouillon->occupiedFrom),
            'period_start' => $brouillon->periodStart->toDateString(),
            'period_end' => $brouillon->periodEnd->toDateString(),
            'due_date' => $echeance->toDateString(),
            'status' => InstallmentStatus::Upcoming,
            'currency' => $bail->currency,
            'rent_amount' => $brouillon->rent,
            'charges_amount' => $brouillon->charges,
            'vat_amount' => $brouillon->vat,
            'total_amount' => $brouillon->total,
        ]);

        foreach ($brouillon->lines as $position => $ligne) {
            InstallmentLine::query()->create($this->lineAttributes($echeanceCreee->id, $position + 1, $bail->currency, $ligne));
        }

        return $echeanceCreee;
    }

    /**
     * @return array<string, mixed>
     */
    private function lineAttributes(string $installmentId, int $position, string $devise, DraftLine $ligne): array
    {
        return [
            'installment_id' => $installmentId,
            'position' => $position,
            'component_key' => $ligne->componentKey,
            'semantic' => $ligne->semantic->value,
            'label' => $ligne->label,
            'from_date' => $ligne->from->toDateString(),
            'to_date' => $ligne->to->toDateString(),
            'days' => $ligne->days,
            'month_days' => $ligne->monthDays,
            'currency' => $devise,
            'monthly_amount' => $ligne->monthly,
            'amount' => $ligne->amount,
            'vat_bp' => $ligne->vatBp,
            'vat_amount' => $ligne->vat,
        ];
    }

    private function unitAt(LeaseData $donnees, CarbonImmutable $date): ?string
    {
        $jour = $date->toDateString();
        $lots = array_values(array_filter($donnees->units, fn (LeaseUnitData $lot): bool => $lot->validFrom <= $jour && ($lot->validTo === null || $lot->validTo > $jour)));
        usort($lots, fn (LeaseUnitData $a, LeaseUnitData $b): int => [$b->isMain, $a->validFrom] <=> [$a->isMain, $b->validFrom]);

        return $lots[0]->unitId ?? null;
    }
}
