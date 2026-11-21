<?php

declare(strict_types=1);

use App\Modules\Investments\Enums\LoanStatus;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Investments\InvestmentsContext as I;

beforeEach(function (): void {
    I::preparer($this);
    $this->b = I::bailleur();
    I::comme($this, $this->b['owner']);
});

function envoyerPret(object $test, array $corps): TestResponse
{
    return $test->post(I::url($test->b['org'], '/loans'), [
        'property_id' => $test->b['property'], 'lender_label' => 'Banque du Nord', 'purpose' => 'acquisition', 'principal' => 1200000,
        'nominal_rate' => '12', 'first_due_on' => '2026-01-05', 'term_months' => 12, ...$corps,
    ], ['Accept' => 'application/json', 'Idempotency-Key' => 'pret-'.bin2hex(random_bytes(6))]);
}

function figerAnnee(object $test, string $pret, int $annee): void
{
    DB::table('loan_usages')->insert(['id' => (string) Str::uuid7(), 'organization_id' => $test->b['org']->id, 'loan_id' => $pret, 'income_year' => $annee, 'created_at' => now(), 'updated_at' => now()]);
}

function importer(object $test, string $pret, string $csv, int $version): TestResponse
{
    return $test->post(I::url($test->b['org'], "/loans/{$pret}/schedule/import"), ['lock_version' => $version, 'file' => UploadedFile::fake()->createWithContent('banque.csv', $csv)], ['Accept' => 'application/json']);
}

function csvDe(array $lignes, array $assurances = []): string
{
    $euros = fn (int $minor): string => number_format($minor / 100, 2, ',', '');

    return implode("\n", array_map(fn (array $l, int $i): string => implode(';', [$l['due_on'], $euros($l['payment']['amount']), $euros($l['interest']['amount']), $euros($l['principal']['amount']), $euros($assurances[$i] ?? $l['insurance']['amount']), $euros($l['outstanding_after']['amount'])]), $lignes, array_keys($lignes)))."\n";
}

it('M1 : crée un prêt avec sa pièce jointe, et la pièce ne peut plus être remplacée', function (): void {
    $r = envoyerPret($this, ['document' => I::pdf('offre.pdf')])->assertCreated();
    $id = $r->json('data.id');
    $piece = DB::table('loans')->where('id', $id)->value('stored_file_id');

    expect($piece)->not->toBeNull()->and(DB::table('stored_files')->where('id', $piece)->count())->toBe(1);

    $autre = envoyerPret($this, ['document' => I::pdf('autre.pdf')])->assertCreated()->json('data.id');
    $pieceAutre = DB::table('loans')->where('id', $autre)->value('stored_file_id');

    expect(fn () => DB::table('loans')->where('id', $id)->update(['stored_file_id' => $pieceAutre]))->toThrow(QueryException::class)
        ->and(DB::table('loans')->where('id', $id)->value('stored_file_id'))->toBe($piece);
});

it('M1 : ajoute des frais avec leur pièce jointe, et la pièce ne peut plus être remplacée', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');
    $url = I::url($this->b['org'], "/loans/{$id}/fees");

    $this->post($url, ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 15000, 'document' => I::pdf('frais.pdf')], ['Accept' => 'application/json'])->assertCreated();
    $this->post($url, ['kind' => 'guarantee', 'paid_on' => '2026-01-02', 'amount' => 7000, 'document' => I::pdf('garantie.pdf')], ['Accept' => 'application/json'])->assertCreated();
    $pieces = DB::table('loan_fees')->where('loan_id', $id)->orderBy('amount')->pluck('stored_file_id')->all();

    expect($pieces)->toHaveCount(2)->and($pieces[0])->not->toBeNull()->and($pieces[1])->not->toBeNull()
        ->and(fn () => DB::table('loan_fees')->where('stored_file_id', $pieces[0])->update(['stored_file_id' => $pieces[1]]))->toThrow(QueryException::class);
});

it('M3 : un remboursement anticipé ne touche pas une année déjà figée (loan_in_use 409)', function (): void {
    $id = I::pret($this, $this->b, ['term_months' => 24])->assertCreated()->json('data.id');
    figerAnnee($this, $id, 2026);
    $url = I::url($this->b['org'], "/loans/{$id}/prepayments");

    $this->postJson($url, ['date' => '2026-12-05', 'amount' => 100000, 'option' => 'reduce_term', 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'loan_in_use');
    expect(DB::table('loan_schedules')->where('loan_id', $id)->count())->toBe(1);

    $this->postJson($url, ['date' => '2027-03-05', 'amount' => 100000, 'option' => 'reduce_term', 'lock_version' => 1])->assertOk()->assertJsonPath('data.lock_version', 2);
});

it('M3 : un import ne remplace pas les échéances d\'une année figée mais peut corriger la suite', function (): void {
    $id = I::pret($this, $this->b, ['term_months' => 24])->assertCreated()->json('data.id');
    figerAnnee($this, $id, 2026);
    $lignes = $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertOk()->json('data.lines');

    importer($this, $id, csvDe($lignes, [5 => 10000]), 1)->assertConflict()->assertJsonPath('code', 'loan_in_use');
    expect(DB::table('loan_schedules')->where('loan_id', $id)->count())->toBe(1);

    importer($this, $id, csvDe($lignes, [15 => 10000]), 1)->assertOk()->assertJsonPath('data.schedule_source', 'imported');
    expect(DB::table('loan_schedules')->where('loan_id', $id)->count())->toBe(2);
});

it('M9 : frais et attestation refusés sur un prêt annulé, frais refusés sur un prêt soldé', function (): void {
    $annule = I::pret($this, $this->b)->assertCreated()->json('data.id');
    $this->postJson(I::url($this->b['org'], "/loans/{$annule}/void"), ['reason' => 'Erreur', 'lock_version' => 1])->assertOk();

    $this->post(I::url($this->b['org'], "/loans/{$annule}/fees"), ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 100], ['Accept' => 'application/json'])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');
    $this->post(I::url($this->b['org'], "/loans/{$annule}/attestations"), ['income_year' => 2026, 'interest' => 1, 'document' => I::pdf()], ['Accept' => 'application/json'])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');

    $solde = I::pret($this, $this->b, ['principal' => 300000, 'nominal_rate' => '0', 'term_months' => 3])->assertCreated()->json('data.id');
    DB::table('loans')->where('id', $solde)->update(['status' => LoanStatus::Repaid->value]);

    $this->post(I::url($this->b['org'], "/loans/{$solde}/fees"), ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 100], ['Accept' => 'application/json'])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');
    expect(DB::table('loan_fees')->count())->toBe(0);
});
