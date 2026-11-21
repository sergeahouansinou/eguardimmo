<?php

declare(strict_types=1);

namespace App\Modules\Tax\Actions;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Tax\Data\ComputedIncome;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Jurisdictions\RentalIncomeRules;
use App\Modules\Tax\Jurisdictions\RentalIncomeRulesRegistry;
use App\Modules\Tax\Support\Facts\LeaseUniverse;
use App\Modules\Tax\Support\Facts\YearWindow;
use App\Modules\Tax\Support\MandantFactsReader;
use App\Modules\Tax\Support\RentalIncomeCalculator;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Calcul du relevé d'un mandant pour une année terminée : rien n'est écrit. Un mandant société  ou sans mandat sur l'année, des fonds
 * de mandants activés en cours d'année, une juridiction sans formulaire sont refusés, jamais remplacés par un repli.
 */
final readonly class ComputeMandantStatement
{
    public function __construct(
        private RentalIncomeRulesRegistry $registre,
        private OrganizationDirectory $organisations,
        private MandantFactsReader $lecteur,
        private LedgerAggregates $grandLivre,
        private LedgerReader $livre,
        private PartyDirectory $parties,
        private LeaseUniverse $baux,
    ) {}

    public function universe(int $annee): LeaseUniverse
    {
        return (clone $this->baux)->load(YearWindow::of($annee), $this->regles(), []);
    }

    public function handle(string $mandantId, int $annee, ?LeaseUniverse $univers = null): ComputedIncome
    {
        $regles = $this->regles();
        $formulaire = ($regles->form($annee) ?? throw ErrorCode::YearUnsupported->problem())->withToComplete(['250']);
        $devise = $this->organisations->currency();

        if ($devise->getCode() !== $regles->currency()) {
            throw ErrorCode::JurisdictionUnsupported->problem('La devise de l\'organisation n\'est pas celle du formulaire.');
        }

        $fenetre = YearWindow::of($annee);
        $bascule = $this->livre->ownerFundsCutoverAt();

        if ($bascule === null || $bascule->greaterThan($fenetre->from)) {
            throw ErrorCode::OwnerFundsNotReady->problem();
        }

        $version = $this->grandLivre->version();
        $faits = $this->lecteur->read($mandantId, $fenetre, new Currency($devise->getCode()), $formulaire, $univers ?? $this->universe($annee));

        if ($faits === null) {
            throw ErrorCode::MandantNotFound->problem();
        }

        $mandant = $this->parties->find($mandantId);

        if (in_array($mandant->kind->value, $regles->unsupportedTaxpayerKinds(), true)) {
            throw ErrorCode::TaxpayerUnsupported->problem('Ce mandant ne relève pas de ce relevé : sa déclaration n\'est pas celle d\'un particulier.');
        }

        $revenus = (new RentalIncomeCalculator((int) config('tax.sources_max_per_line')))->compute($formulaire, $faits, false, false);

        return new ComputedIncome($revenus, [], $version, $mandant->displayName);
    }

    public function assertYearOver(int $annee, ?CarbonImmutable $maintenant = null): void
    {
        $aujourdhui = ($maintenant ?? CarbonImmutable::now($this->organisations->timezone()))->startOfDay();

        if ($aujourdhui->lessThan(CarbonImmutable::createFromDate($annee + 1, 1, 1)->startOfDay())) {
            throw ErrorCode::PeriodNotClosed->problem('L\'année de revenus n\'est pas terminée.');
        }
    }

    private function regles(): RentalIncomeRules
    {
        return $this->registre->for($this->organisations->country());
    }
}
