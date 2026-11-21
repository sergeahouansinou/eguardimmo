<?php

declare(strict_types=1);

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Banking\Models\BankSuggestion;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

it('banking:suggest recalcule les propositions de toutes les organisations', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    DB::table('bank_suggestions')->delete();

    $this->artisan('banking:suggest')->assertExitCode(0)->expectsOutputToContain('1 proposition');

    expect(L::dans($this->org, fn () => BankSuggestion::query()->count()))->toBe(1);
});

it('banking:verify passe sur une banque cohérente', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();

    $this->artisan('banking:verify')->assertExitCode(0)->expectsOutputToContain('Banque cohérente');
    expect(DB::table('audit_logs')->where('action', 'banking.verify.anomaly')->count())->toBe(0);
});

it('banking:verify signale un trou de continuité et un virement interne orphelin', function (): void {
    B::importer($this, $this->org, $this->compte, B::camt([['2026-11-02', 'CRDT', '10.00', 'A']], ref: 'S1', ouverture: 0, cloture: 1000), 'camt053', nom: 'a.xml')->assertCreated();
    B::importer($this, $this->org, $this->compte, B::camt([['2026-12-02', 'CRDT', '10.00', 'B']], ref: 'S2', ouverture: 5000, cloture: 6000, de: '2026-12-01', a: '2026-12-31'), 'camt053', nom: 'b.xml')->assertCreated();
    $tiers = B::compte($this, $this->org, 'trust_bank', B::AUTRE_IBAN);
    B::importer($this, $this->org, $tiers, B::csv([['16/11/2026', 'SORTIE', '-50,00']], 'T'))->assertCreated();
    $sortie = B::lignes($this, $this->org)['SORTIE'];
    DB::table('bank_statement_lines')->where('id', $sortie['id'])->update(['state' => 'ignored', 'ignore_reason' => 'internal_transfer']);

    $this->artisan('banking:verify')->assertExitCode(1)->expectsOutputToContain('statement_gap')->expectsOutputToContain('trust_ignored_line_unpaired');

    expect(DB::table('audit_logs')->where('action', 'banking.verify.anomaly')->count())->toBe(2);
});

it('planifie les deux commandes', function (): void {
    $commandes = collect(app(Schedule::class)->events())->map(fn ($e) => $e->command)->implode(' ');

    expect($commandes)->toContain('banking:suggest')->toContain('banking:verify');
});

it('banking:verify signale une écriture pointée puis contrepassée', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $ecritures = B::ecritures($this, $this->org, $this->compte);
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => $ecritures, 'lock_version' => $ligne['lock_version']])->assertCreated();
    $entree = DB::table('journal_entries')->where('source_type', 'payment')->value('id');
    L::dans($this->org, fn () => app(Ledger::class)->reverse($entree, CarbonImmutable::parse('2026-11-16')));

    $this->artisan('banking:verify')->assertExitCode(1)->expectsOutputToContain('matched_entry_reversed');
});

it('banking:verify n\'écrit pas chaque jour l\'audit d\'une anomalie persistante, mais la signale chaque jour', function (): void {
    $tiers = B::compte($this, $this->org, 'trust_bank', B::AUTRE_IBAN);
    B::importer($this, $this->org, $tiers, B::csv([['16/11/2026', 'SORTIE', '-50,00']], 'T'))->assertCreated();
    DB::table('bank_statement_lines')->where('label', 'SORTIE')->update(['state' => 'ignored', 'ignore_reason' => 'internal_transfer']);
    $anomalies = fn () => DB::table('audit_logs')->where('action', 'banking.verify.anomaly')->count();

    $this->artisan('banking:verify')->assertExitCode(1);
    $this->artisan('banking:verify')->assertExitCode(1)->expectsOutputToContain('trust_ignored_line_unpaired');

    expect($anomalies())->toBe(1);

    $this->travel(8)->days();
    $this->artisan('banking:verify')->assertExitCode(1);

    expect($anomalies())->toBe(2);
});

it('banking:suggest isole les organisations : une en échec n\'arrête pas les autres, le code de sortie le dit', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);
    $compteAutre = B::compte($this, $autre, 'bank', B::AUTRE_IBAN);
    B::importer($this, $autre, $compteAutre, B::csv([['16/11/2026', 'VIR AUTRE', '5,00']]))->assertCreated();
    DB::table('bank_suggestions')->delete();

    DB::listen(function ($requete) use ($autre): void {
        if (str_contains($requete->sql, 'bank_statement_lines') && in_array($autre->id, $requete->bindings, true)) {
            throw new RuntimeException('panne simulée');
        }
    });
    $journaux = [];
    Event::listen(MessageLogged::class, function (MessageLogged $m) use (&$journaux): void {
        $journaux[] = $m->message.json_encode($m->context);
    });

    $this->artisan('banking:suggest')->assertExitCode(1)->expectsOutputToContain('1 organisation(s) en échec');

    expect(DB::table('bank_suggestions')->where('organization_id', $this->org->id)->count())->toBe(1)
        ->and(implode('', $journaux))->toContain('Calcul des propositions bancaires en échec')->not->toContain('VIR AUTRE');
});
