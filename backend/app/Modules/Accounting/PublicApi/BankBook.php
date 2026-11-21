<?php

declare(strict_types=1);

namespace App\Modules\Accounting\PublicApi;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Accounting\Data\BankBookPageData;
use App\Modules\Accounting\Data\BankPositionData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Queries\BankLines;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Lecture seule des lignes des comptes de banque (`Bank`, `TrustBank`) de l'organisation courante, pour le rapprochement bancaire
 * (ADR 0035). Un autre rôle de compte lève une exception : ce n'est pas une donnée du client mais une erreur de l'appelant.
 */
final readonly class BankBook
{
    public function __construct(private BankLines $lignes) {}

    /**
     * Lignes d'un compte de banque entre deux dates d'écriture incluses, triées par date puis identifiant ; `$cursor` vient de la page précédente.
     * `$amount` est en unités mineures, au sens `$side` si fourni.
     */
    public function lines(AccountRole $role, Currency $currency, ?CarbonImmutable $from = null, ?CarbonImmutable $to = null, ?int $amount = null, ?Side $side = null, ?string $cursor = null, int $limit = 100): BankBookPageData
    {
        return $this->lignes->page($role, $currency, $from, $to, $amount, $side, $cursor, $limit);
    }

    /**
     * Vrai si le curseur est de ceux que `lines` a émis ; un curseur forgé est une erreur du client à refuser avant la lecture.
     */
    public function isValidCursor(string $cursor): bool
    {
        return $this->lignes->isValidCursor($cursor);
    }

    /**
     * @param  list<string>  $lineIds
     * @return array<string, BankBookLineData> par identifiant ; une ligne inconnue, d'une autre organisation ou d'un autre rôle est absente
     */
    public function find(AccountRole $role, Currency $currency, array $lineIds): array
    {
        return $this->lignes->byIds($role, $currency, $lineIds);
    }

    /**
     * Lignes du compte de banque portées par ces écritures.
     *
     * @param  list<string>  $entryIds
     * @return list<BankBookLineData>
     */
    public function ofEntries(AccountRole $role, Currency $currency, array $entryIds): array
    {
        return $this->lignes->ofEntries($role, $currency, $entryIds);
    }

    /**
     * Solde (débit moins crédit) et nombre de lignes entre `$from` (null = origine) et `$asOf` inclus.
     */
    public function position(AccountRole $role, Currency $currency, CarbonImmutable $asOf, ?CarbonImmutable $from = null): BankPositionData
    {
        return $this->lignes->position($role, $currency, $asOf, $from);
    }
}
