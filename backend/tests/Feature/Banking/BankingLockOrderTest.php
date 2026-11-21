<?php

declare(strict_types=1);

use App\Modules\Banking\Actions\MatchLines;
use App\Modules\Banking\Actions\SettleLine;
use App\Modules\Banking\Enums\SuggestionAction;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\Grammars\SQLiteGrammar;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesQueryTrace as Q;
use Tests\Feature\Rent\RentContext as C;

function bkRang(array $ordre, string $motif, bool $verrouillee = false): int|false
{
    foreach ($ordre as $i => [$genre, $sql]) {
        if (str_contains($sql, $motif) && (! $verrouillee || $genre === Q::LOCKED_READ)) {
            return $i;
        }
    }

    return false;
}

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

it('règlement d\'une ligne : verrou des lignes de relevé avant toute écriture comptable ou locative', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(SettleLine::class)->handle($ligne['id'], SuggestionAction::SettleLease, [['id' => $this->bail->id, 'amount' => 70000]], $ligne['lock_version'], (string) Str::uuid(), 'cle-verrou-1')));

    $verrou = bkRang($ordre, 'from "bank_statement_lines"', true);
    $paiement = bkRang($ordre, 'insert into "rent_payments"');
    $ecriture = bkRang($ordre, 'insert into "journal_entries"');

    expect($verrou)->not->toBeFalse()->and($paiement)->not->toBeFalse()->and($ecriture)->not->toBeFalse()
        ->and($verrou)->toBeLessThan($paiement)->and($verrou)->toBeLessThan($ecriture);
});

it('pointage : verrou des lignes de relevé avant l\'insertion du pointage', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR A', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR A'];
    $ecritures = B::ecritures($this, $this->org, $this->compte);

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(MatchLines::class)->handle($ligne['id'], [], $ecritures, $ligne['lock_version'], (string) Str::uuid(), 'cle-verrou-2')));

    $verrou = bkRang($ordre, 'from "bank_statement_lines"', true);
    $insertion = bkRang($ordre, 'insert into "bank_matches"');

    expect($verrou)->not->toBeFalse()->and($insertion)->not->toBeFalse()->and($verrou)->toBeLessThan($insertion);
});

it('verrouille plusieurs lignes dans l\'ordre de leurs identifiants', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR A', '300,00'], ['16/11/2026', 'VIR B', '400,00']]))->assertCreated();
    $lignes = B::lignes($this, $this->org);
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    $ids = [$lignes['VIR A']['id'], $lignes['VIR B']['id']];

    $ordre = Q::run(fn () => L::dans($this->org, fn () => app(MatchLines::class)->handle($ids[1], [$ids[0]], $ecritures, null, (string) Str::uuid(), 'cle-verrou-3')));
    $verrou = collect($ordre)->first(fn ($e) => $e[0] === Q::LOCKED_READ && str_contains($e[1], 'from "bank_statement_lines"'));

    expect($verrou)->not->toBeNull()->and($verrou[1])->toContain('order by "id"');
    expect(DB::table('bank_matches')->count())->toBe(1);
});

it('verrouille le relevé (partagé) avant ses lignes, dans l\'ordre de VoidStatement', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR A', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR A'];
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    $connexion = DB::connection();
    $ancienne = $connexion->getQueryGrammar();
    $connexion->setQueryGrammar(new class($connexion) extends SQLiteGrammar
    {
        protected function compileLock(Builder $query, $value)
        {
            return $value === true ? ' /* for update */' : ($value === false ? ' /* share */' : '');
        }
    });
    $requetes = [];
    $connexion->listen(function ($requete) use (&$requetes): void {
        $requetes[] = $requete->sql;
    });

    try {
        L::dans($this->org, fn () => app(MatchLines::class)->handle($ligne['id'], [], $ecritures, $ligne['lock_version'], (string) Str::uuid(), 'cle-verrou-4'));
    } finally {
        $connexion->setQueryGrammar($ancienne);
    }

    $releve = collect($requetes)->search(fn (string $sql): bool => str_contains($sql, 'from "bank_statements"') && str_contains($sql, '/* share */'));
    $lignes = collect($requetes)->search(fn (string $sql): bool => str_contains($sql, 'from "bank_statement_lines"') && str_contains($sql, '/* for update */'));

    expect($releve)->not->toBeFalse()->and($lignes)->not->toBeFalse()->and($releve)->toBeLessThan($lignes);
});

it('refuse de pointer une ligne dont l\'import est annulé', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    $import = B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR A', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR A'];
    DB::table('bank_statements')->where('id', $import->json('data.id'))->update(['voided_at' => now()]);

    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $this->org, $this->compte), 'lock_version' => $ligne['lock_version']])
        ->assertStatus(409)->assertJsonPath('code', 'bank_line_not_matchable');
});
