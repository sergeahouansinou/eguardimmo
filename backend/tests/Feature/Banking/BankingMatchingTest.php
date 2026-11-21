<?php

declare(strict_types=1);

use App\Modules\Banking\Models\BankMatchItem;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

function bkPointer(object $test, array $ligne, array $ecritures, array $autresLignes = []): TestResponse
{
    return B::envoyer($test, 'POST', B::url($test->org, "/lines/{$ligne['id']}/match"), [
        'line_ids' => array_column($autresLignes, 'id'), 'journal_line_ids' => $ecritures, 'lock_version' => $ligne['lock_version'],
    ]);
}

it('pointe 1:1 une ligne de relevé et une écriture de banque sans écrire au grand livre', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $avant = DB::table('journal_entries')->count();

    $r = bkPointer($this, $ligne, $ecritures)->assertCreated();

    expect($r->json('data.kind'))->not->toBeNull()->and(DB::table('journal_entries')->count())->toBe($avant);
    $apres = B::lignes($this, $this->org)['VIR LOYER'];
    expect($apres['state'])->toBe('matched')->and($apres['lock_version'])->toBeGreaterThan($ligne['lock_version'])->and($apres['match_id'])->toBe($r->json('data.id'));
    $this->getJson(B::url($this->org, '/matches/'.$r->json('data.id')))->assertOk();
});

it('pointe N:1 puis 1:N', function (): void {
    C::payer($this, $this->org, $this->bail, 30000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 40000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR A', '300,00'], ['16/11/2026', 'VIR B', '400,00'], ['17/11/2026', 'REMISE', '123,00']]))->assertCreated();
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    $lignes = B::lignes($this, $this->org);

    bkPointer($this, $lignes['VIR A'], $ecritures, [$lignes['VIR B']])->assertCreated();
    expect(B::lignes($this, $this->org)['VIR B']['state'])->toBe('matched');

    C::payer($this, $this->org, $this->bail, 12300)->assertCreated();
    $nouvelles = array_values(array_diff(B::ecritures($this, $this->org, $this->compte), $ecritures));
    bkPointer($this, $lignes['REMISE'], $nouvelles)->assertCreated();
});

it('refuse un pointage déséquilibré', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '650,00']]))->assertCreated();

    bkPointer($this, B::lignes($this, $this->org)['VIR LOYER'], B::ecritures($this, $this->org, $this->compte))->assertStatus(422)->assertJsonPath('code', 'bank_match_unbalanced');
    expect(DB::table('bank_matches')->count())->toBe(0);
});

it('refuse une ligne déjà pointée, une écriture déjà prise et une version périmée', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR 1', '700,00'], ['16/11/2026', 'VIR 2', '700,00']]))->assertCreated();
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    $lignes = B::lignes($this, $this->org);

    bkPointer($this, [...$lignes['VIR 1'], 'lock_version' => 99], $ecritures)->assertStatus(409)->assertJsonPath('code', 'bank_line_stale');
    bkPointer($this, $lignes['VIR 1'], $ecritures)->assertCreated();
    bkPointer($this, $lignes['VIR 1'], $ecritures)->assertStatus(409);
    bkPointer($this, $lignes['VIR 2'], $ecritures)->assertStatus(409)->assertJsonPath('code', 'bank_line_not_matchable');
    expect(DB::table('bank_match_items')->where('side', 'journal_line')->whereNull('undone_at')->count())->toBe(1);
});

it('la contrainte unique interdit deux pointages actifs de la même écriture', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR 1', '700,00']]))->assertCreated();
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    bkPointer($this, B::lignes($this, $this->org)['VIR 1'], $ecritures)->assertCreated();
    $item = (array) DB::table('bank_match_items')->where('side', 'journal_line')->first();
    $autre = (array) DB::table('bank_matches')->first();
    $copie = [...$item, 'id' => (string) Str::uuid7()];
    unset($copie['active_key']);

    expect(fn () => DB::table('bank_match_items')->insert($copie))->toThrow(QueryException::class);
    expect($autre)->not->toBeEmpty();
});

it('défait un pointage avec un motif et libère les lignes', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $match = bkPointer($this, B::lignes($this, $this->org)['VIR LOYER'], B::ecritures($this, $this->org, $this->compte))->assertCreated()->json('data.id');

    B::envoyer($this, 'POST', B::url($this->org, "/matches/{$match}/undo"), ['reason' => 'Erreur de saisie'])->assertOk();

    expect(B::lignes($this, $this->org)['VIR LOYER']['state'])->toBe('unmatched');
    expect(DB::table('bank_match_items')->whereNull('undone_at')->count())->toBe(0);
    bkPointer($this, B::lignes($this, $this->org)['VIR LOYER'], B::ecritures($this, $this->org, $this->compte))->assertCreated();
});

it('ignore puis restaure une ligne', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'FRAIS', '-5,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['FRAIS'];

    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/ignore"), ['reason' => 'out_of_scope', 'lock_version' => $ligne['lock_version']])->assertOk();
    $ignoree = B::lignes($this, $this->org)['FRAIS'];
    expect($ignoree['state'])->toBe('ignored')->and($ignoree['ignore_reason'])->toBe('out_of_scope');

    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/restore"), ['lock_version' => $ignoree['lock_version']])->assertOk();
    expect(B::lignes($this, $this->org)['FRAIS']['state'])->toBe('unmatched');
});

it('sur le compte de tiers, n\'ignore qu\'une paire de montant net nul', function (): void {
    $tiers = B::compte($this, $this->org, 'trust_bank', B::AUTRE_IBAN);
    B::importer($this, $this->org, $tiers, B::csv([['16/11/2026', 'SORTIE', '-50,00'], ['16/11/2026', 'ENTREE', '50,00']]))->assertCreated();
    $lignes = B::lignes($this, $this->org);

    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$lignes['SORTIE']['id']}/ignore"), ['reason' => 'internal_transfer', 'lock_version' => 1])->assertStatus(409)->assertJsonPath('code', 'bank_ignore_forbidden');
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$lignes['SORTIE']['id']}/ignore"), ['reason' => 'internal_transfer', 'lock_version' => 1, 'pair_line_id' => $lignes['ENTREE']['id']])->assertOk();
    expect(B::lignes($this, $this->org)['ENTREE']['state'])->toBe('ignored');
});

it('propose et accepte une suggestion forte, puis refuse une suggestion périmée', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];

    expect($ligne['suggestion']['confidence'])->toBe('strong')->and($ligne['suggestion']['explanation']['codes'])->toContain('amount_equals_entry');

    $suggestion = $ligne['suggestion']['id'];
    $r = B::envoyer($this, 'POST', B::url($this->org, '/suggestions/accept'), ['suggestion_ids' => [$suggestion]])->assertOk();

    expect($r->json('data.accepted'))->toHaveCount(1);
    expect(B::lignes($this, $this->org)['VIR LOYER']['state'])->toBe('matched');
    $r2 = B::envoyer($this, 'POST', B::url($this->org, '/suggestions/accept'), ['suggestion_ids' => [$suggestion]])->assertOk();
    expect($r2->json('data.accepted'))->toBe([])->and($r2->json('data.skipped'))->toHaveCount(1);
});

it('ne valide jamais seul : sans action, aucun pointage n\'existe', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();

    expect(DB::table('bank_matches')->count())->toBe(0)->and(DB::table('bank_suggestions')->count())->toBe(1);
});

it('crée une règle d\'organisation qui propose sans écrire', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'PRLV ASSURANCE', '-80,00']]))->assertCreated();

    $r = B::envoyer($this, 'POST', B::url($this->org, '/rules'), ['name' => 'Assurance', 'label_contains' => 'ASSURANCE', 'action' => 'suggest_ignore', 'ignore_reason' => 'out_of_scope', 'confidence' => 'weak'])->assertCreated();
    $this->getJson(B::url($this->org, '/rules'))->assertOk()->assertJsonCount(1, 'data');
    B::envoyer($this, 'PUT', B::url($this->org, '/rules/'.$r->json('data.id')), ['name' => 'Assurance 2', 'label_contains' => 'ASSURANCE', 'action' => 'suggest_ignore', 'ignore_reason' => 'out_of_scope', 'confidence' => 'weak', 'active' => false, 'lock_version' => 1])->assertOk();
    expect(DB::table('bank_matches')->count())->toBe(0);
    expect(L::dans($this->org, fn () => BankMatchItem::query()->count()))->toBe(0);
});
