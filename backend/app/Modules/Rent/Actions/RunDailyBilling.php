<?php

declare(strict_types=1);

namespace App\Modules\Rent\Actions;

use App\Modules\Leases\PublicApi\LeaseSchedule;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Throwable;

final readonly class RunDailyBilling
{
    private const int PAGE = 200;

    public function __construct(
        private CurrentOrganization $contexte,
        private LeaseSchedule $baux,
        private GenerateInstallments $generation,
        private FlagOverdueInstallments $retards,
    ) {}

    /**
     * Tâche quotidienne (ADR 0007) : rattrapage de `BailSigné ⇢ Rent` et génération des échéances manquantes de tous les
     * baux signés en cours, une organisation après l'autre sous son contexte, puis signalement des impayés. Un bail en
     * échec est rapporté et n'arrête pas les autres. Rejouable : rien n'est créé deux fois.
     *
     * @return array{leases: int, created: int, overdue: int, failures: list<string>}
     */
    public function handle(CarbonImmutable $today): array
    {
        $bilan = ['leases' => 0, 'created' => 0, 'overdue' => 0, 'failures' => []];

        foreach ($this->baux->organizationsWithActiveLeases($today, $today->addMonth()) as $organisation) {
            $this->contexte->run($organisation, function () use ($organisation, $today, &$bilan): void {
                $apres = null;

                do {
                    $page = $this->baux->activeBetween($today, $today->addMonth(), $apres, self::PAGE);

                    foreach ($page as $bail) {
                        $apres = $bail->leaseId;
                        $bilan['leases']++;

                        try {
                            $bilan['created'] += $this->generation->handle($bail, $today)['created'];
                        } catch (Throwable $erreur) {
                            report($erreur);
                            $bilan['failures'][] = "{$organisation} / {$bail->leaseId} : {$erreur->getMessage()}";
                        }
                    }
                } while (count($page) === self::PAGE);

                $bilan['overdue'] += $this->retards->handle($today);
            });
        }

        return $bilan;
    }
}
