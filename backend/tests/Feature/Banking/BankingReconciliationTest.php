<?php

declare(strict_types=1);

use App\Modules\Banking\PublicApi\BankReconciliationStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
});

function bkReleve(object $test, int $cloture = 70000, string $ref = 'S1', int $ouverture = 0, string $de = '2026-11-01', string $a = '2026-11-30', string $date = '2026-11-16', string $montant = '700.00', string $libelle = 'VIR LOYER'): void
{
    B::importer($test, $test->org, $test->compte, B::camt([[$date, 'CRDT', $montant, $libelle]], ref: $ref, ouverture: $ouverture, cloture: $cloture, de: $de, a: $a, sequence: $ref), 'camt053', nom: "{$ref}.xml")->assertCreated();
}

function bkPointerLoyer(object $test): string
{
    $ligne = B::lignes($test, $test->org)['VIR LOYER'];

    return B::envoyer($test, 'POST', B::url($test->org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($test, $test->org, $test->compte), 'lock_version' => $ligne['lock_version']])->assertCreated()->json('data.id');
}

function bkEtat(object $test, string $mois = '2026-11', ?int $solde = null): TestResponse
{
    return B::envoyer($test, 'POST', B::url($test->org, '/reconciliations'), ['bank_account_id' => $test->compte, 'month' => $mois, ...($solde === null ? [] : ['bank_balance' => $solde])]);
}

function bkEtatAvecPreuve(object $test, int $solde, string $mois = '2026-11'): TestResponse
{
    return $test->post(B::url($test->org, '/reconciliations'), [
        'bank_account_id' => $test->compte, 'month' => $mois, 'bank_balance' => $solde, 'proof' => UploadedFile::fake()->createWithContent('solde.pdf', DocumentsContext::PDF),
    ], ['Accept' => 'application/json', 'Idempotency-Key' => 'cle-'.bin2hex(random_bytes(8))]);
}

it('construit puis valide l\'état d\'un mois dont l\'écart inexpliqué est nul', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    bkPointerLoyer($this);

    $etat = bkEtat($this)->assertCreated();

    expect($etat->json('data.unexplained_difference.amount'))->toBe(0)->and($etat->json('data.validatable'))->toBeTrue()->and($etat->json('data.status'))->toBe('draft');

    $id = $etat->json('data.id');
    $valide = B::envoyer($this, 'POST', B::url($this->org, "/reconciliations/{$id}/validate"))->assertOk();

    expect($valide->json('data.status'))->toBe('validated')->and($valide->json('data.validated_at'))->not->toBeNull();
    $this->getJson(B::url($this->org, '/reconciliations'))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(B::url($this->org, "/reconciliations/{$id}"))->assertOk();
});

it('refuse de valider un écart inexpliqué', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this, cloture: 80000);
    bkPointerLoyer($this);
    $etat = bkEtat($this)->assertCreated();

    expect($etat->json('data.unexplained_difference.amount'))->not->toBe(0)->and($etat->json('data.validatable'))->toBeFalse();
    B::envoyer($this, 'POST', B::url($this->org, '/reconciliations/'.$etat->json('data.id').'/validate'))->assertStatus(409)->assertJsonPath('code', 'bank_reconciliation_unexplained_difference');
    expect(DB::table('bank_reconciliations')->where('status', 'validated')->count())->toBe(0);
});

it('refuse de valider avec un trou entre deux relevés', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this, ref: 'S1', de: '2026-10-01', a: '2026-10-31', date: '2026-10-05', cloture: 1000, montant: '10.00', libelle: 'VIR OCTOBRE');
    bkReleve($this, ref: 'S2', ouverture: 5000, cloture: 75000);
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    B::envoyer($this, 'POST', B::url($this->org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $this->org, $this->compte), 'lock_version' => $ligne['lock_version']])->assertCreated();
    $etat = bkEtat($this)->assertCreated();

    expect($etat->json('data.has_gap'))->toBeTrue();
    B::envoyer($this, 'POST', B::url($this->org, '/reconciliations/'.$etat->json('data.id').'/validate'))->assertStatus(409);
    expect(DB::table('bank_reconciliations')->where('status', 'validated')->count())->toBe(0);
});

it('exige le solde saisi quand aucun relevé ne le porte', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    bkPointerLoyer($this);

    bkEtat($this)->assertStatus(422)->assertJsonPath('code', 'bank_reconciliation_balance_required');
    $ok = bkEtatAvecPreuve($this, 70000)->assertCreated();

    expect($ok->json('data.bank_balance_source'))->toBe('entered')->and($ok->json('data.unexplained_difference.amount'))->toBe(0)->and($ok->json('data.has_balance_proof'))->toBeTrue();
});

it('refuse un solde saisi sans la pièce qui le justifie, puis la sert par la route sensible seule', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    bkPointerLoyer($this);

    bkEtat($this, solde: 70000)->assertStatus(422)->assertJsonPath('code', 'bank_reconciliation_proof_required');
    expect(DB::table('bank_reconciliations')->count())->toBe(0);

    $id = bkEtatAvecPreuve($this, 70000)->assertCreated()->json('data.id');
    $fichier = DB::table('bank_reconciliations')->where('id', $id)->value('balance_proof_file_id');
    $this->get(B::url($this->org, "/reconciliations/{$id}/proof"))->assertOk();
    $this->getJson("/api/v1/org/{$this->org->id}/documents/files/{$fichier}/download")->assertNotFound();
    expect(DB::table('audit_logs')->where('action', 'banking.reconciliation.proof_downloaded')->count())->toBe(1);

    B::envoyer($this, 'POST', B::url($this->org, "/reconciliations/{$id}/validate"))->assertOk();
});

it('n\'exige pas de pièce quand un relevé porte le solde', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    bkPointerLoyer($this);

    $etat = bkEtat($this, solde: 12345)->assertCreated();

    expect($etat->json('data.bank_balance_source'))->not->toBe('entered')->and($etat->json('data.has_balance_proof'))->toBeFalse();
    $this->getJson(B::url($this->org, '/reconciliations/'.$etat->json('data.id').'/proof'))->assertNotFound();
});

it('fige l\'état validé et verrouille le pointage', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    $match = bkPointerLoyer($this);
    $id = bkEtat($this)->assertCreated()->json('data.id');
    B::envoyer($this, 'POST', B::url($this->org, "/reconciliations/{$id}/validate"))->assertOk();

    expect(fn () => DB::table('bank_reconciliations')->where('id', $id)->update(['bank_balance' => 1]))->toThrow(QueryException::class);
    expect(fn () => DB::table('bank_reconciliations')->where('id', $id)->delete())->toThrow(QueryException::class);
    B::envoyer($this, 'POST', B::url($this->org, "/matches/{$match}/undo"), ['reason' => 'Je me suis trompé'])->assertStatus(409)->assertJsonPath('code', 'bank_match_locked');
});

it('remplace un état validé devenu périmé après un nouveau mouvement', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    bkPointerLoyer($this);
    $premier = bkEtat($this)->assertCreated()->json('data.id');
    B::envoyer($this, 'POST', B::url($this->org, "/reconciliations/{$premier}/validate"))->assertOk();

    C::payer($this, $this->org, $this->bail, 1000)->assertCreated();
    $second = bkEtat($this)->assertCreated();

    expect($second->json('data.supersedes_id'))->toBe($premier)->and($second->json('data.unmatched_entries_total.amount'))->toBe(1000);
    expect(DB::table('bank_reconciliations')->where('id', $premier)->value('status'))->toBe('validated');
});

it('interdit d\'annuler un relevé dont une ligne est pointée', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    bkPointerLoyer($this);
    $statement = DB::table('bank_statements')->value('id');

    B::envoyer($this, 'POST', B::url($this->org, "/statements/{$statement}/void"), ['reason' => 'Erreur'])->assertStatus(409)->assertJsonPath('code', 'bank_statement_void_forbidden');
});

it('bloque la clôture du mois sans état validé, puis l\'autorise une fois validé', function (): void {
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    bkReleve($this);
    bkPointerLoyer($this);
    $blocages = fn (): array => L::dans($this->org, fn (): array => app(BankReconciliationStatus::class)->closingBlockers(CarbonImmutable::parse('2026-11-01')));

    expect($blocages())->toBe(['bank_reconciliation_missing']);

    $id = bkEtat($this)->assertCreated()->json('data.id');
    B::envoyer($this, 'POST', B::url($this->org, "/reconciliations/{$id}/validate"))->assertOk();

    expect($blocages())->toBe([]);

    C::payer($this, $this->org, $this->bail, 1000)->assertCreated();

    expect($blocages())->toBe(['bank_reconciliation_stale']);
});

it('calcule le décalage sur les éléments pointés par lots, avec le même résultat quelle que soit la taille du lot', function (): void {
    C::payer($this, $this->org, $this->bail, 30000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 40000)->assertCreated();
    B::importer($this, $this->org, $this->compte, B::csv([['02/12/2026', 'VIR A', '300,00'], ['03/12/2026', 'VIR B', '400,00']]))->assertCreated();
    $lignes = B::lignes($this, $this->org);
    $ecritures = B::ecritures($this, $this->org, $this->compte);

    foreach (['VIR A' => 0, 'VIR B' => 1] as $libelle => $i) {
        B::envoyer($this, 'POST', B::url($this->org, "/lines/{$lignes[$libelle]['id']}/match"), ['journal_line_ids' => [$ecritures[$i]], 'lock_version' => $lignes[$libelle]['lock_version']])->assertCreated();
    }

    $mesures = [];

    foreach ([1000, 1] as $taille) {
        config(['banking.timing_chunk' => $taille]);
        $mesures[] = bkEtatAvecPreuve($this, 0)->assertCreated()->json('data.timing_difference.amount');
    }

    expect($mesures[0])->not->toBe(0)->and($mesures[1])->toBe($mesures[0]);
});
