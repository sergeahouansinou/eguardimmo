<?php

declare(strict_types=1);

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $this->org, $this->compte), 'lock_version' => $ligne['lock_version']])->assertCreated();
});

it('refuse toute modification des champs figés et toute suppression', function (string $table, array $maj): void {
    $id = DB::table($table)->value('id');

    expect(fn () => DB::table($table)->where('id', $id)->update($maj))->toThrow(QueryException::class)
        ->and(fn () => DB::table($table)->where('id', $id)->delete())->toThrow(QueryException::class);
})->with([
    'relevé' => ['bank_statements', ['file_sha256' => str_repeat('a', 64)]],
    'ligne de relevé (montant)' => ['bank_statement_lines', ['amount' => 1]],
    'ligne de relevé (libellé)' => ['bank_statement_lines', ['label' => 'AUTRE']],
    'pointage' => ['bank_matches', ['confidence' => 'strong']],
    'élément de pointage' => ['bank_match_items', ['amount' => 1]],
    'compte (empreinte)' => ['organization_bank_accounts', ['identifier_last4' => '9999']],
]);

it('laisse passer les seuls changements d\'état prévus', function (): void {
    $compte = DB::table('organization_bank_accounts')->value('id');
    DB::table('organization_bank_accounts')->where('id', $compte)->update(['label' => 'Renommé']);
    DB::table('bank_statements')->update(['voided_at' => now(), 'void_reason' => 'Test']);

    expect(DB::table('organization_bank_accounts')->value('label'))->toBe('Renommé')->and(DB::table('bank_statements')->value('void_reason'))->toBe('Test');
    expect(fn () => DB::table('bank_statements')->update(['voided_at' => null]))->toThrow(QueryException::class);
});

it('un compte fermé ne se rouvre pas', function (): void {
    $id = DB::table('organization_bank_accounts')->value('id');
    DB::table('organization_bank_accounts')->where('id', $id)->update(['status' => 'closed', 'closed_at' => now()]);

    expect(fn () => DB::table('organization_bank_accounts')->where('id', $id)->update(['status' => 'active']))->toThrow(QueryException::class);
});

it('un pointage défait ne se refait pas', function (): void {
    $match = DB::table('bank_matches')->value('id');
    DB::table('bank_match_items')->where('match_id', $match)->update(['undone_at' => now()]);
    DB::table('bank_matches')->where('id', $match)->update(['undone_at' => now()]);

    expect(fn () => DB::table('bank_matches')->where('id', $match)->update(['undone_at' => null]))->toThrow(QueryException::class);
});
