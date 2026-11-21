<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Reporting\Data\NewReportsData;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use App\Modules\Reporting\Support\Own\MandantLock;
use App\Modules\Reporting\Support\PeriodRules;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreateReports
{
    public function __construct(
        private PeriodRules $regles,
        private OrganizationDirectory $organisations,
        private PartyDirectory $parties,
        private MandantLock $verrou,
        private GenerateReport $generation,
    ) {}

    /**
     * Un compte rendu par mandant, chacun dans sa transaction : l'échec d'un mandant n'empêche pas les autres. Rejouable par
     * mandant (clé d'idempotence dérivée de l'en-tête et du mandant).
     *
     * @return list<array{mandant_id: string, outcome: 'created'|'replayed'|'failed', report: ManagementReport|null, error: ApiProblem|null}>
     */
    public function handle(NewReportsData $donnees, string $cle, ?string $userId, CarbonImmutable $today): array
    {
        $periode = $this->regles->resolve($donnees->kind, $donnees->from, $donnees->to, $today);
        $devise = $this->organisations->currency()->getCode();
        $resultats = [];

        foreach (array_values(array_unique($donnees->mandantIds)) as $mandantId) {
            try {
                $this->assertMandant($mandantId);
                [$rapport, $rejoue] = $this->creerPour($mandantId, $donnees, $periode->from, $periode->endExclusive(), $devise, $cle, $userId);
                $resultats[] = ['mandant_id' => $mandantId, 'outcome' => $rejoue ? 'replayed' : 'created', 'report' => $rapport, 'error' => null];
            } catch (ApiProblem $erreur) {
                $resultats[] = ['mandant_id' => $mandantId, 'outcome' => 'failed', 'report' => null, 'error' => $erreur];
            }
        }

        return $resultats;
    }

    private function assertMandant(string $mandantId): void
    {
        try {
            $this->parties->find($mandantId);
        } catch (ApiProblem $erreur) {
            throw $erreur->status === 404 ? ErrorCode::MandantNotFound->problem() : $erreur;
        }
    }

    /**
     * @return array{ManagementReport, bool}
     */
    private function creerPour(string $mandantId, NewReportsData $donnees, CarbonImmutable $debut, CarbonImmutable $finExclue, string $devise, string $cle, ?string $userId): array
    {
        $empreinte = hash('sha256', (string) json_encode([$mandantId, $donnees->kind->value, $donnees->from, $donnees->to, $donnees->sections, $donnees->options, $donnees->generate, $donnees->notify], JSON_THROW_ON_ERROR));
        $cleMandant = hash('sha256', $cle.'|'.$mandantId);

        try {
            return DB::transaction(function () use ($mandantId, $donnees, $debut, $finExclue, $devise, $empreinte, $cleMandant, $userId): array {
                $this->verrou->acquire($mandantId);
                $existant = ManagementReport::query()->where('idempotency_key', $cleMandant)->first();

                if ($existant !== null) {
                    return [$this->rejouer($existant, $empreinte), true];
                }

                $chevauche = ManagementReport::query()
                    ->where('mandant_party_id', $mandantId)
                    ->whereIn('status', [ReportStatus::Draft->value, ReportStatus::Generated->value, ReportStatus::Published->value])
                    ->where('period_start', '<', $finExclue->toDateString())
                    ->where('period_end', '>', $debut->toDateString())
                    ->exists();

                if ($chevauche) {
                    throw ErrorCode::PeriodOverlap->problem();
                }

                $rapport = ManagementReport::query()->create([
                    'mandant_party_id' => $mandantId,
                    'period_kind' => $donnees->kind,
                    'period_start' => $debut->toDateString(),
                    'period_end' => $finExclue->toDateString(),
                    'status' => ReportStatus::Draft,
                    'currency' => $devise,
                    'content' => ['sections' => $donnees->sections],
                    'options' => $donnees->options,
                    'notify' => $donnees->notify,
                    'idempotency_key' => $cleMandant,
                    'request_hash' => $empreinte,
                    'created_by_user_id' => $userId,
                ]);

                return [$donnees->generate ? $this->generation->handle($rapport) : $rapport, false];
            });
        } catch (UniqueConstraintViolationException) {
            $existant = ManagementReport::query()->where('idempotency_key', $cleMandant)->first();

            if ($existant !== null) {
                return [$this->rejouer($existant, $empreinte), true];
            }

            throw ErrorCode::PeriodOverlap->problem();
        }
    }

    private function rejouer(ManagementReport $existant, string $empreinte): ManagementReport
    {
        if (! hash_equals($existant->request_hash, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existant;
    }
}
