<?php

declare(strict_types=1);

require_once __DIR__.'/helpers.php';

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Money\Money;

beforeEach(function (): void {
    $this->org = comptaOrganisation();
    $this->ecriture = comptaPoster($this->org, comptaLoyer('c:1', Money::EUR(10000)));
});

it('signale un grand livre cohérent', function (): void {
    $this->artisan('accounting:verify-ledger')->expectsOutput('Grand livre cohérent.')->assertSuccessful();

    expect(DB::table('audit_logs')->where('action', 'accounting.ledger.anomaly_detected')->count())->toBe(0);
});

it('détecte une ligne corrompue insérée en base : log critique et audit', function (): void {
    Log::spy();
    $modele = (array) DB::table('journal_lines')->where('journal_entry_id', $this->ecriture->id)->where('position', 1)->first();
    DB::table('journal_lines')->insert([...$modele, 'id' => (string) Str::uuid7(), 'position' => 3, 'debit' => 777]);

    $this->artisan('accounting:verify-ledger')->assertFailed();

    Log::shouldHaveReceived('critical')->withArgs(fn (string $message, array $contexte): bool => $contexte['kind'] === 'unbalanced' && $contexte['entry_id'] === $this->ecriture->id)->once();

    $audit = DB::table('audit_logs')->where('action', 'accounting.ledger.anomaly_detected')->get();

    expect($audit)->toHaveCount(1)
        ->and($audit[0]->organization_id)->toBe($this->org->id)
        ->and($audit[0]->subject_type)->toBe('journal_entry')
        ->and($audit[0]->subject_id)->toBe($this->ecriture->id);
});

it('détecte une écriture sans ligne et un trou de numérotation', function (): void {
    $entree = (array) DB::table('journal_entries')->where('id', $this->ecriture->id)->first();
    DB::table('journal_entries')->insert([...$entree, 'id' => (string) Str::uuid7(), 'number' => 5, 'idempotency_key' => 'c:vide']);

    $this->artisan('accounting:verify-ledger')->assertFailed();

    $genres = DB::table('audit_logs')->where('action', 'accounting.ledger.anomaly_detected')->pluck('metadata')
        ->map(fn (string $json): string => json_decode($json, true)['kind'])->sort()->values()->all();

    expect($genres)->toBe(['numbering_gap', 'too_few_lines']);
});

it('détecte une ligne ni débit ni crédit, que la contrainte CHECK de MySQL interdit d\'écrire', function (): void {
    $ligne = (array) DB::table('journal_lines')->where('journal_entry_id', $this->ecriture->id)->where('position', 1)->first();
    $insertion = fn () => DB::table('journal_lines')->insert([...$ligne, 'id' => (string) Str::uuid7(), 'position' => 3, 'debit' => 0, 'credit' => 0]);

    if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
        expect($insertion)->toThrow(QueryException::class);

        return;
    }

    $insertion();
    $this->artisan('accounting:verify-ledger')->assertFailed();

    expect(DB::table('audit_logs')->where('action', 'accounting.ledger.anomaly_detected')->pluck('metadata')->map(fn (string $json): string => json_decode($json, true)['kind'])->all())->toContain('invalid_line');
});

it('est planifié chaque jour', function (): void {
    $evenements = collect(app(Schedule::class)->events())->filter(fn ($evenement): bool => str_contains((string) $evenement->command, 'accounting:verify-ledger'));

    expect($evenements)->toHaveCount(1)->and($evenements->first()->expression)->toBe('30 3 * * *');
});
