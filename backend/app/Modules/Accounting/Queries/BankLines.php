<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Queries;

use App\Modules\Accounting\Data\BankBookLineData;
use App\Modules\Accounting\Data\BankBookPageData;
use App\Modules\Accounting\Data\BankPositionData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\Side;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalLine;
use App\Modules\Accounting\Support\MoneyColumns;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Money\Currency;
use stdClass;

/**
 * Lignes des comptes de banque (`Bank`, `TrustBank`) de l'organisation courante, pour le rapprochement bancaire (ADR 0035).
 */
final class BankLines
{
    public const int PAGE_MAX = 5000;

    private const int LOT = 500;

    /**
     * @return BankBookPageData tri par date d'écriture puis identifiant de ligne
     */
    public function page(AccountRole $role, Currency $currency, ?CarbonImmutable $from, ?CarbonImmutable $to, ?int $amount, ?Side $side, ?string $cursor, int $limit): BankBookPageData
    {
        $limite = max(1, min($limit, self::PAGE_MAX));
        $requete = $this->detailed($this->base($role, $currency))->orderBy('journal_entries.entry_date')->orderBy('journal_lines.id');

        if ($from !== null) {
            $requete->where('journal_entries.entry_date', '>=', $from->format('Y-m-d'));
        }

        if ($to !== null) {
            $requete->where('journal_entries.entry_date', '<', $to->addDay()->format('Y-m-d'));
        }

        if ($amount !== null) {
            $side === null
                ? $requete->where(fn ($q) => $q->where('journal_lines.debit', $amount)->orWhere('journal_lines.credit', $amount))
                : $requete->where('journal_lines.'.$side->value, $amount);
        } elseif ($side !== null) {
            $requete->where('journal_lines.'.$side->value, '>', 0);
        }

        if ($cursor !== null) {
            [$date, $id] = $this->decode($cursor);
            $requete->where(fn ($q) => $q->where('journal_entries.entry_date', '>', $date)
                ->orWhere(fn ($egal) => $egal->where('journal_entries.entry_date', $date)->where('journal_lines.id', '>', $id)));
        }

        $lignes = $requete->limit($limite + 1)->toBase()->get();
        $suite = $lignes->count() > $limite;
        $donnees = array_values($lignes->take($limite)->map(fn (stdClass $ligne): BankBookLineData => $this->data($ligne, $currency))->all());
        $derniere = $donnees === [] ? null : $donnees[array_key_last($donnees)];

        return new BankBookPageData($donnees, $suite && $derniere !== null ? $this->encode($derniere) : null);
    }

    /**
     * @param  list<string>  $lineIds
     * @return array<string, BankBookLineData> par identifiant de ligne ; une ligne inconnue ou d'un autre rôle est absente
     */
    public function byIds(AccountRole $role, Currency $currency, array $lineIds): array
    {
        $resultat = [];

        foreach (array_chunk(array_values(array_unique($lineIds)), self::LOT) as $lot) {
            foreach ($this->detailed($this->base($role, $currency))->whereIn('journal_lines.id', $lot)->toBase()->get() as $ligne) {
                $resultat[(string) $ligne->line_id] = $this->data($ligne, $currency);
            }
        }

        return $resultat;
    }

    /**
     * @param  list<string>  $entryIds
     * @return list<BankBookLineData>
     */
    public function ofEntries(AccountRole $role, Currency $currency, array $entryIds): array
    {
        $resultat = [];

        foreach (array_chunk(array_values(array_unique($entryIds)), self::LOT) as $lot) {
            foreach ($this->detailed($this->base($role, $currency))->whereIn('journal_entries.id', $lot)->orderBy('journal_lines.position')->toBase()->get() as $ligne) {
                $resultat[] = $this->data($ligne, $currency);
            }
        }

        return $resultat;
    }

    public function position(AccountRole $role, Currency $currency, CarbonImmutable $asOf, ?CarbonImmutable $from): BankPositionData
    {
        $requete = $this->base($role, $currency)->where('journal_entries.entry_date', '<', $asOf->addDay()->format('Y-m-d'));

        if ($from !== null) {
            $requete->where('journal_entries.entry_date', '>=', $from->format('Y-m-d'));
        }

        $somme = $requete->selectRaw('coalesce(sum(journal_lines.debit), 0) as debit, coalesce(sum(journal_lines.credit), 0) as credit, count(*) as total')->toBase()->first();

        return new BankPositionData(
            MoneyColumns::money($somme->debit ?? 0, $currency)->subtract(MoneyColumns::money($somme->credit ?? 0, $currency)),
            (int) ($somme->total ?? 0),
        );
    }

    /**
     * @return Builder<JournalLine>
     */
    private function base(AccountRole $role, Currency $currency): Builder
    {
        if (! in_array($role, [AccountRole::Bank, AccountRole::TrustBank], true)) {
            throw new InvalidArgumentException('BankBook ne lit que les comptes de banque.');
        }

        return JournalLine::query()
            ->join('journal_entries', function ($jointure): void {
                $jointure->on('journal_entries.id', '=', 'journal_lines.journal_entry_id')
                    ->on('journal_entries.organization_id', '=', 'journal_lines.organization_id');
            })
            ->whereIn('journal_lines.account_id', Account::query()->where('role', $role->value)->select('id'))
            ->where('journal_lines.currency', $currency->getCode());
    }

    /**
     * @param  Builder<JournalLine>  $requete
     * @return Builder<JournalLine>
     */
    private function detailed(Builder $requete): Builder
    {
        return $requete->select([
            'journal_lines.id as line_id', 'journal_lines.debit', 'journal_lines.credit',
            'journal_entries.id as entry_id', 'journal_entries.fiscal_year', 'journal_entries.number', 'journal_entries.entry_date',
            'journal_entries.label', 'journal_entries.journal', 'journal_entries.source_type', 'journal_entries.source_id', 'journal_entries.reversal_of_id',
            DB::raw('exists (select 1 from journal_entries as reversals where reversals.reversal_of_id = journal_entries.id and reversals.organization_id = journal_entries.organization_id) as reversed'),
        ]);
    }

    private function data(stdClass $ligne, Currency $currency): BankBookLineData
    {
        $debit = MoneyColumns::money($ligne->debit, $currency);
        $credit = MoneyColumns::money($ligne->credit, $currency);
        $aDebite = $debit->isPositive();

        return new BankBookLineData(
            lineId: (string) $ligne->line_id,
            entryId: (string) $ligne->entry_id,
            entryReference: sprintf('%d-%06d', $ligne->fiscal_year, $ligne->number),
            entryDate: substr((string) $ligne->entry_date, 0, 10),
            entryLabel: (string) $ligne->label,
            journal: Journal::from((string) $ligne->journal),
            side: $aDebite ? Side::Debit : Side::Credit,
            amount: $aDebite ? $debit : $credit,
            sourceType: SourceType::from((string) $ligne->source_type),
            sourceId: (string) $ligne->source_id,
            isReversal: $ligne->reversal_of_id !== null,
            isReversed: (bool) $ligne->reversed,
        );
    }

    private function encode(BankBookLineData $ligne): string
    {
        return rtrim(strtr(base64_encode($ligne->entryDate.'|'.$ligne->lineId), '+/', '-_'), '=');
    }

    public function isValidCursor(string $curseur): bool
    {
        try {
            $this->decode($curseur);
        } catch (InvalidArgumentException) {
            return false;
        }

        return true;
    }

    /**
     * @return array{string, string}
     */
    private function decode(string $curseur): array
    {
        $brut = base64_decode(strtr($curseur, '-_', '+/'), true);

        if (! is_string($brut) || preg_match('/^(\d{4}-\d{2}-\d{2})\|([0-9a-f-]{36})$/D', $brut, $m) !== 1) {
            throw new InvalidArgumentException('Curseur invalide.');
        }

        return [$m[1], $m[2]];
    }
}
