<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Enums\ErrorCode;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Models\AccountingPeriod;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Verrou des mois clos (ADR 0031) : la lecture du dernier mois clos se fait sous verrou partagé, la clôture le prend
 * exclusif, donc une écriture concurrente d'une clôture est sérialisée et jamais perdue.
 */
final readonly class Periods
{
    public function __construct(private CurrentOrganization $contexte) {}

    public function lock(bool $exclusive): void
    {
        $organisation = $this->contexte->id();
        DB::table('accounting_period_locks')->insertOrIgnore(['organization_id' => $organisation, 'last_value' => 0]);
        $requete = DB::table('accounting_period_locks')->where('organization_id', $organisation);
        $exclusive ? $requete->lockForUpdate()->first() : $requete->sharedLock()->first();
    }

    public function firstOpenDay(): ?CarbonImmutable
    {
        $fin = AccountingPeriod::query()->max('period_end');

        return is_string($fin) ? CarbonImmutable::parse($fin)->startOfDay() : null;
    }

    /**
     * Date et libellé retenus pour l'écriture : une date dans un mois clos est refusée, ou reportée au premier jour
     * ouvert quand l'appelant l'a demandé (encaissement antidaté, libellé « encaissé le … »).
     *
     * @return array{CarbonImmutable, string}
     */
    public function resolve(EntryData $donnees): array
    {
        $this->lock(false);
        $ouvert = $this->firstOpenDay();
        $libelle = trim($donnees->label);

        if ($ouvert === null || $donnees->date->startOfDay()->greaterThanOrEqualTo($ouvert)) {
            return [$donnees->date, $libelle];
        }

        if ($donnees->onClosedPeriod !== OnClosedPeriod::RollForward) {
            throw ErrorCode::PeriodClosed->problem();
        }

        return [$ouvert, mb_substr($libelle, 0, 230).' (encaissé le '.$donnees->date->format('d/m/Y').')'];
    }
}
