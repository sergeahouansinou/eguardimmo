<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Tax\Data\ComputedIncome;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Jurisdictions\RentalIncomeRulesRegistry;
use App\Modules\Tax\Support\LandlordFactsReader;
use App\Modules\Tax\Support\RentalIncomeCalculator;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Calcul à la volée des revenus fonciers d'un bailleur autonome pour une année : rien n'est écrit. Jurisdiction, devise et année sans
 * formulaire sont refusées (422), jamais remplacées par un repli.
 */
final readonly class ComputeRentalIncome
{
    public function __construct(
        private RentalIncomeRulesRegistry $registre,
        private OrganizationDirectory $organisations,
        private LandlordFactsReader $lecteur,
        private LedgerAggregates $grandLivre,
    ) {}

    public function handle(int $annee, bool $foyerComplet): ComputedIncome
    {
        $regles = $this->registre->for($this->organisations->country());
        $formulaire = $regles->form($annee) ?? throw ErrorCode::YearUnsupported->problem();
        $devise = $this->organisations->currency();

        if ($devise->getCode() !== $regles->currency()) {
            throw ErrorCode::JurisdictionUnsupported->problem('La devise de l\'organisation n\'est pas celle du formulaire.');
        }

        $version = $this->grandLivre->version();
        ['facts' => $faits, 'loanIds' => $prets] = $this->lecteur->read($annee, new Currency($devise->getCode()), $formulaire, $regles);
        $aujourdhui = CarbonImmutable::now($this->organisations->timezone())->startOfDay();
        $provisoire = (int) $aujourdhui->format('Y') <= $annee;

        return new ComputedIncome(
            (new RentalIncomeCalculator((int) config('tax.sources_max_per_line')))->compute($formulaire, $faits, $provisoire, $foyerComplet),
            $prets,
            $version,
        );
    }
}
