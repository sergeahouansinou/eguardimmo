<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\CertificateState;
use App\Modules\Documents\Events\CertificateDeadlineReached;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Queries\CertificateOrganizations;
use App\Modules\Documents\Support\CertificateTypes;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

final readonly class FlagCertificateDeadlines
{
    public const int FENETRE_JOURS = 7;

    private const int LOT = 200;

    public function __construct(
        private CurrentOrganization $contexte,
        private CertificateOrganizations $organisations,
        private CertificateTypes $types,
    ) {}

    /**
     * Émet l'événement des pièces dont le rappel s'est ouvert, ou dont l'échéance est passée, depuis moins de
     * FENETRE_JOURS jours : un balayage manqué est rattrapé, une pièce ancienne ne revient pas chaque jour. Une pièce
     * remplacée n'est plus suivie. Rejouable : le consommateur dédoublonne.
     */
    public function handle(CarbonImmutable $today): int
    {
        $emis = 0;

        foreach ($this->organisations->withDeadlines() as $organisation) {
            $this->contexte->run($organisation, function () use ($today, &$emis): void {
                Certificate::query()
                    ->whereNotNull('expires_on')
                    ->whereDoesntHave('replacement')
                    ->where('expires_on', '>=', $today->subDays(self::FENETRE_JOURS + 1)->toDateString())
                    ->orderBy('id')
                    ->chunkById(self::LOT, function ($pieces) use ($today, &$emis): void {
                        foreach ($pieces as $piece) {
                            $emis += $this->flag($piece, $today) ? 1 : 0;
                        }
                    });
            });
        }

        return $emis;
    }

    private function flag(Certificate $piece, CarbonImmutable $today): bool
    {
        $echeance = $piece->expires_on;

        if ($echeance === null) {
            return false;
        }

        $type = $this->types->find($piece->certificate_type_term_id);
        $rappel = $this->types->reminderDays($type);
        $etat = CertificateState::at($today, $echeance, $rappel);

        $ouverture = match ($etat) {
            CertificateState::ToRenew => $echeance->subDays($rappel),
            CertificateState::Expired => $echeance->addDay(),
            CertificateState::Valid => null,
        };

        if ($ouverture === null || $ouverture->toDateString() < $today->subDays(self::FENETRE_JOURS)->toDateString()) {
            return false;
        }

        CertificateDeadlineReached::dispatch($piece->id, $piece->organization_id, $etat, $echeance->toDateString(), $type->label(), $piece->subject_type, $piece->subject_id);

        return true;
    }
}
