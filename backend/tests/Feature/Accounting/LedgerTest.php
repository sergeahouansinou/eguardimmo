<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\ItemType;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\Accounting\Models\Account;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Accounting\Support\ChartOfAccounts;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Currency;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
});

function comptaCode(Closure $action): string
{
    try {
        $action();
    } catch (ApiProblem $probleme) {
        return $probleme->problemCode;
    }

    return 'aucune erreur';
}

it('accepte une écriture équilibrée et provisionne le plan de comptes', function (): void {
    $ecriture = comptaPoster($this->org, comptaLoyer('rent:1', Money::EUR(120000)));

    expect($ecriture->number)->toBe(1)
        ->and($ecriture->reference())->toBe('2026-000001')
        ->and($ecriture->replayed)->toBeFalse()
        ->and($ecriture->lines)->toHaveCount(2)
        ->and($ecriture->lines[0]->account)->toBe(AccountRole::TenantReceivable)
        ->and($ecriture->lines[0]->debit->equals(Money::EUR(120000)))->toBeTrue()
        ->and($ecriture->lines[1]->credit->equals(Money::EUR(120000)))->toBeTrue()
        ->and(DB::table('accounts')->where('organization_id', $this->org->id)->pluck('role')->sort()->values()->all())->toBe(['rent_revenue', 'tenant_receivable'])
        ->and(DB::table('audit_logs')->where('action', 'journal_entry.created')->count())->toBe(1);
});

it('refuse une écriture déséquilibrée sans rien écrire', function (): void {
    $source = (string) Str::uuid7();
    $desequilibree = new EntryData(Journal::Adjustments, CarbonImmutable::parse('2026-11-01'), 'Erreur', SourceType::Adjustment, $source, 'k:desequilibre', [
        LineData::debit(AccountRole::Bank, Money::EUR(10000)),
        LineData::credit(AccountRole::RentRevenue, Money::EUR(9000)),
    ]);

    expect(comptaCode(fn () => comptaPoster($this->org, $desequilibree)))->toBe('entry_unbalanced')
        ->and(DB::table('journal_entries')->count())->toBe(0)
        ->and(DB::table('journal_lines')->count())->toBe(0)
        ->and(DB::table('journal_entry_counters')->count())->toBe(0)
        ->and(DB::table('accounts')->count())->toBe(0);
});

it('équilibre devise par devise', function (): void {
    $melange = new EntryData(Journal::Adjustments, CarbonImmutable::parse('2026-11-01'), 'Mélange', SourceType::Adjustment, (string) Str::uuid7(), 'k:melange', [
        LineData::debit(AccountRole::Bank, Money::EUR(10000)),
        LineData::credit(AccountRole::RentRevenue, Money::XOF(10000)),
    ]);

    expect(comptaCode(fn () => comptaPoster($this->org, $melange)))->toBe('entry_unbalanced')
        ->and(DB::table('journal_entries')->count())->toBe(0);
});

it('refuse les écritures mal formées', function (callable $fabrique): void {
    expect(comptaCode(fn () => comptaPoster($this->org, $fabrique())))->toBe('entry_invalid')
        ->and(DB::table('journal_entries')->count())->toBe(0);
})->with([
    'une seule ligne' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), 'x', SourceType::Adjustment, (string) Str::uuid7(), 'k:1', [LineData::debit(AccountRole::Bank, Money::EUR(100))])],
    'montant nul' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), 'x', SourceType::Adjustment, (string) Str::uuid7(), 'k:2', [LineData::debit(AccountRole::Bank, Money::EUR(0)), LineData::credit(AccountRole::RentRevenue, Money::EUR(0))])],
    'libellé vide' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), '  ', SourceType::Adjustment, (string) Str::uuid7(), 'k:3', [LineData::debit(AccountRole::Bank, Money::EUR(100)), LineData::credit(AccountRole::RentRevenue, Money::EUR(100))])],
    'source non UUID' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), 'x', SourceType::Adjustment, 'pas-un-uuid', 'k:4', [LineData::debit(AccountRole::Bank, Money::EUR(100)), LineData::credit(AccountRole::RentRevenue, Money::EUR(100))])],
    'devise inconnue' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), 'x', SourceType::Adjustment, (string) Str::uuid7(), 'k:5', [LineData::debit(AccountRole::Bank, new Money(100, new Currency('ZZZ'))), LineData::credit(AccountRole::RentRevenue, new Money(100, new Currency('ZZZ')))])],
    'créance sans identifiant' => [fn (): EntryData => new EntryData(Journal::Rent, CarbonImmutable::parse('2026-11-01'), 'x', SourceType::Adjustment, (string) Str::uuid7(), 'k:6', [LineData::debit(AccountRole::TenantReceivable, Money::EUR(100), itemType: ItemType::Invoice), LineData::credit(AccountRole::RentRevenue, Money::EUR(100))])],
]);

it('rejoue une clé d\'idempotence sans rien créer de plus', function (): void {
    $donnees = comptaLoyer('rent:idem', Money::EUR(50000));

    $premiere = comptaPoster($this->org, $donnees);
    $seconde = comptaPoster($this->org, $donnees);

    expect($seconde->id)->toBe($premiere->id)
        ->and($seconde->replayed)->toBeTrue()
        ->and($seconde->number)->toBe(1)
        ->and(DB::table('journal_entries')->count())->toBe(1)
        ->and(DB::table('journal_lines')->count())->toBe(2)
        ->and(DB::table('journal_entry_counters')->value('last_value'))->toBe(1);
});

it('refuse une clé d\'idempotence réutilisée avec un autre contenu', function (): void {
    comptaPoster($this->org, comptaLoyer('rent:idem', Money::EUR(50000)));

    expect(comptaCode(fn () => comptaPoster($this->org, comptaLoyer('rent:idem', Money::EUR(60000)))))->toBe('idempotency_key_reused')
        ->and(DB::table('journal_entries')->count())->toBe(1);
});

it('numérote sans trou par organisation et par exercice', function (): void {
    $autre = comptaOrganisation();
    $numeros = [];

    foreach (range(1, 4) as $i) {
        $numeros[] = comptaPoster($this->org, comptaLoyer("a:{$i}", Money::EUR(100 * $i)))->number;
        $numeros[] = comptaPoster($autre, comptaLoyer("b:{$i}", Money::EUR(100 * $i)))->number;
    }

    $ancien = comptaPoster($this->org, comptaLoyer('a:2025', Money::EUR(100), '2025-12-31'));

    expect($numeros)->toBe([1, 1, 2, 2, 3, 3, 4, 4])
        ->and($ancien->number)->toBe(1)
        ->and($ancien->fiscalYear)->toBe(2025)
        ->and(comptaPoster($this->org, comptaLoyer('a:5', Money::EUR(100)))->number)->toBe(5);
});

it('libère le numéro quand la transaction de l\'appelant est annulée', function (): void {
    comptaPoster($this->org, comptaLoyer('n:1', Money::EUR(100)));

    try {
        DB::transaction(function (): void {
            comptaPoster($this->org, comptaLoyer('n:2', Money::EUR(100)));

            throw new RuntimeException('échec de l\'appelant');
        });
    } catch (RuntimeException) {
    }

    expect(comptaPoster($this->org, comptaLoyer('n:3', Money::EUR(100)))->number)->toBe(2)
        ->and(DB::table('journal_entries')->orderBy('number')->pluck('number')->all())->toBe([1, 2]);
});

it('interdit en base deux écritures de même numéro', function (): void {
    $premiere = comptaPoster($this->org, comptaLoyer('u:1', Money::EUR(100)));
    $ligne = (array) DB::table('journal_entries')->where('id', $premiere->id)->first();

    DB::table('journal_entries')->insert([...$ligne, 'id' => (string) Str::uuid7(), 'idempotency_key' => 'u:autre']);
})->throws(QueryException::class);

it('contre-passe une écriture : lignes inversées, solde remis à zéro, rejouable', function (): void {
    $lease = (string) Str::uuid7();
    $originale = comptaPoster($this->org, comptaLoyer('r:1', Money::EUR(80000), refs: ['lease' => $lease]));

    $contre = comptaDans($this->org, fn () => app(Ledger::class)->reverse($originale->id, CarbonImmutable::parse('2026-11-05')));

    expect($contre->reversalOfId)->toBe($originale->id)
        ->and($contre->number)->toBe(2)
        ->and($contre->sourceType)->toBe(SourceType::JournalEntry)
        ->and($contre->lines[0]->credit->equals(Money::EUR(80000)))->toBeTrue()
        ->and($contre->lines[0]->leaseId)->toBe($lease)
        ->and($contre->lines[1]->debit->equals(Money::EUR(80000)))->toBeTrue();

    $rejeu = comptaDans($this->org, fn () => app(Ledger::class)->reverse($originale->id, CarbonImmutable::parse('2026-11-05')));
    $autreDate = fn () => comptaDans($this->org, fn () => app(Ledger::class)->reverse($originale->id, CarbonImmutable::parse('2026-11-06')));
    $surContre = fn () => comptaDans($this->org, fn () => app(Ledger::class)->reverse($contre->id, CarbonImmutable::parse('2026-11-06')));

    expect($rejeu->id)->toBe($contre->id)->and($rejeu->replayed)->toBeTrue()
        ->and(comptaCode($autreDate))->toBe('entry_already_reversed')
        ->and(comptaCode($surContre))->toBe('entry_is_reversal')
        ->and(DB::table('journal_entries')->count())->toBe(2);
});

it('refuse de contre-passer une écriture inconnue', function (): void {
    expect(comptaCode(fn () => comptaDans($this->org, fn () => app(Ledger::class)->reverse((string) Str::uuid7(), CarbonImmutable::parse('2026-11-05')))))->toBe('entry_not_found');
});

it('rend une écriture validée immuable, au niveau du modèle et de la base', function (): void {
    $ecriture = comptaPoster($this->org, comptaLoyer('i:1', Money::EUR(100)));
    $modele = comptaDans($this->org, fn () => JournalEntry::query()->findOrFail($ecriture->id));

    expect(fn () => comptaDans($this->org, fn () => $modele->update(['label' => 'Falsifié'])))->toThrow(LogicException::class)
        ->and(fn () => comptaDans($this->org, fn () => $modele->delete()))->toThrow(LogicException::class)
        ->and(fn () => DB::table('journal_entries')->update(['label' => 'Falsifié']))->toThrow(QueryException::class)
        ->and(fn () => DB::table('journal_lines')->delete())->toThrow(QueryException::class)
        ->and(DB::table('journal_entries')->value('label'))->toBe('Loyer novembre');
});

it('interdit en base une ligne qui pointe vers le compte d\'une autre organisation', function (): void {
    $autre = comptaOrganisation();
    $ecriture = comptaPoster($this->org, comptaLoyer('x:1', Money::EUR(100)));
    comptaPoster($autre, comptaLoyer('x:2', Money::EUR(100)));
    $compteEtranger = (string) DB::table('accounts')->where('organization_id', $autre->id)->value('id');
    $ligne = (array) DB::table('journal_lines')->where('journal_entry_id', $ecriture->id)->first();

    DB::table('journal_lines')->insert([...$ligne, 'id' => (string) Str::uuid7(), 'position' => 9, 'account_id' => $compteEtranger]);
})->throws(QueryException::class);

it('rejoue l\'écriture d\'un concurrent avec ses lignes et ses comptes quand la clé est prise pendant l\'écriture', function (): void {
    $donnees = comptaLoyer('race:1', Money::EUR(70000));
    $premiere = comptaPoster($this->org, $donnees);
    $masquer = true;

    JournalEntry::addGlobalScope('invisible-au-snapshot', function (Builder $requete) use (&$masquer): void {
        if ($masquer) {
            $requete->where('idempotency_key', '!=', 'race:1');
        }
    });
    JournalEntry::creating(function () use (&$masquer): never {
        $masquer = false;

        throw new UniqueConstraintViolationException('sqlite', 'insert into "journal_entries"', [], new PDOException('UNIQUE constraint failed'));
    });

    $rejouee = comptaPoster($this->org, $donnees);

    expect($rejouee->replayed)->toBeTrue()
        ->and($rejouee->id)->toBe($premiere->id)
        ->and($rejouee->lines)->toHaveCount(2)
        ->and($rejouee->lines[0]->accountCode)->toBe(AccountRole::TenantReceivable->defaultCode());
});

it('relit par verrou le compte créé en parallèle au lieu d\'échouer sur la contrainte d\'unicité', function (): void {
    $creer = true;
    $concurrent = (string) Str::uuid7();

    Account::creating(function () use (&$creer, $concurrent): void {
        if ($creer) {
            $creer = false;
            DB::table('accounts')->insert([
                'id' => $concurrent, 'organization_id' => $this->org->id, 'code' => AccountRole::Bank->defaultCode(),
                'label' => 'Banque', 'role' => AccountRole::Bank->value, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    });

    $ids = comptaDans($this->org, fn (): array => app(ChartOfAccounts::class)->idsFor([AccountRole::Bank]));

    expect($ids)->toBe([AccountRole::Bank->value => $concurrent])
        ->and(DB::table('accounts')->where('organization_id', $this->org->id)->count())->toBe(1);
});
