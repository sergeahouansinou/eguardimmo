<?php

declare(strict_types=1);

namespace App\Modules\Banking\Queries;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\PublicApi\BankBook;
use App\Modules\Banking\Enums\MatchSide;
use App\Modules\Banking\Models\BankMatchItem;
use App\Modules\Banking\Models\OrganizationBankAccount;
use Carbon\CarbonImmutable;
use Money\Currency;

/**
 * Lignes d'écriture `Bank` ou `TrustBank` du compte qui ne sont dans aucun pointage vivant (`book-lines`). Une page complète les
 * pages du grand livre jusqu'à réunir `$limit` lignes : elle peut en rendre un peu plus, jamais en sauter.
 */
final readonly class UnmatchedBookLines
{
    public function __construct(private BankBook $banque) {}

    /**
     * @return array{lines: list<BankBookLineData>, next_cursor: string|null}
     */
    public function page(OrganizationBankAccount $compte, ?CarbonImmutable $from, ?CarbonImmutable $to, ?int $amount, ?Side $side, ?string $cursor, int $limit): array
    {
        $role = $compte->ledger_role->accountRole();
        $devise = new Currency($compte->currency);
        $gardees = [];
        $curseur = $cursor;

        for ($page = 0; $page < 20; $page++) {
            $lot = $this->banque->lines($role, $devise, $from, $to, $amount, $side, $curseur, 200);
            $pointees = $lot->lines === [] ? [] : array_flip(BankMatchItem::query()->where('side', MatchSide::JournalLine)->whereNull('undone_at')
                ->whereIn('ref_id', array_map(static fn (BankBookLineData $l): string => $l->lineId, $lot->lines))->pluck('ref_id')->all());

            foreach ($lot->lines as $ligne) {
                if (! isset($pointees[$ligne->lineId])) {
                    $gardees[] = $ligne;
                }
            }

            $curseur = $lot->nextCursor;

            if ($curseur === null || count($gardees) >= $limit) {
                break;
            }
        }

        return ['lines' => $gardees, 'next_cursor' => $curseur];
    }
}
