<?php

declare(strict_types=1);

use App\Shared\Audit\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Investments\InvestmentsContext as I;

beforeEach(function (): void {
    I::preparer($this);
    $this->b = I::bailleur();
    I::comme($this, $this->b['owner']);
});

it('crée un prêt : le serveur calcule l\'échéancier, la devise et le restant dû selon l\'échéancier', function (): void {
    $r = I::pret($this, $this->b)->assertCreated();
    $id = $r->json('data.id');

    $r->assertJsonPath('data.principal', ['amount' => 1200000, 'currency' => 'EUR'])
        ->assertJsonPath('data.schedule_source', 'computed')->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.outstanding.basis', 'schedule')->assertJsonPath('data.outstanding.as_of', '2026-11-16')
        ->assertJsonPath('data.outstanding.amount.amount', 105558)->assertJsonPath('data.lock_version', 1);

    $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertOk()
        ->assertJsonPath('data.currency', 'EUR')->assertJsonCount(12, 'data.lines')
        ->assertJsonPath('data.lines.0.payment.amount', 106619)->assertJsonPath('data.lines.0.interest.amount', 12000)
        ->assertJsonPath('data.lines.0.principal.amount', 94619)->assertJsonPath('data.lines.0.outstanding_after.amount', 1105381)
        ->assertJsonPath('data.lines.11.payment.amount', 106614)->assertJsonPath('data.lines.11.outstanding_after.amount', 0)
        ->assertJsonPath('data.totals.principal.amount', 1200000)->assertJsonPath('data.totals.interest.amount', 79423);
});

it('refuse tout montant calculé envoyé par le client et toute condition incohérente', function (): void {
    foreach ([['monthly_payment' => 1], ['interest' => 5], ['outstanding' => 5], ['currency' => 'XOF'], ['status' => 'repaid'], ['schedule_source' => 'imported']] as $extra) {
        I::pret($this, $this->b, $extra)->assertUnprocessable();
    }

    I::pret($this, $this->b, ['deferral_kind' => 'partial', 'deferral_months' => 0])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    I::pret($this, $this->b, ['deferral_kind' => 'total', 'deferral_months' => 12])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    I::pret($this, $this->b, ['insurance_mode' => 'fixed'])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    I::pret($this, $this->b, ['insurance_mode' => 'initial_capital'])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    I::pret($this, $this->b, ['term_months' => 601])->assertUnprocessable();
    I::pret($this, $this->b, ['principal' => 100000000001])->assertUnprocessable();
    I::pret($this, $this->b, ['nominal_rate' => '3.123456'])->assertUnprocessable();
    I::pret($this, $this->b, ['nominal_rate' => '31'])->assertUnprocessable();
    I::pret($this, $this->b, ['unit_id' => '0199f5d2-0000-7000-8000-000000000009'])->assertNotFound();
    expect(DB::table('loans')->count())->toBe(0);
});

it('Idempotency-Key : obligatoire, rejeu identique sans doublon, contenu différent 409', function (): void {
    $this->postJson(I::url($this->b['org'], '/loans'), ['property_id' => $this->b['property'], 'lender_label' => 'Banque', 'purpose' => 'works', 'principal' => 1000, 'nominal_rate' => '1', 'first_due_on' => '2026-01-05', 'term_months' => 12])->assertUnprocessable()->assertJsonPath('code', 'investments_idempotency_key_required');

    $premier = I::pret($this, $this->b, [], 'cle-rejeu-0001')->assertCreated();
    $rejeu = I::pret($this, $this->b, [], 'cle-rejeu-0001')->assertOk();
    I::pret($this, $this->b, ['principal' => 1200001], 'cle-rejeu-0001')->assertConflict()->assertJsonPath('code', 'investments_idempotency_key_reused');

    expect($rejeu->json('data.id'))->toBe($premier->json('data.id'))->and(DB::table('loans')->count())->toBe(1)->and(DB::table('loan_schedules')->count())->toBe(1);
});

it('masque la référence du contrat hors de la fiche et ne trace aucun montant ni libellé au journal', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');

    $this->getJson(I::url($this->b['org'], '/loans'))->assertOk()->assertJsonPath('data.0.contract_reference', '…0042');
    $this->getJson(I::url($this->b['org'], "/loans/{$id}"))->assertOk()->assertJsonPath('data.contract_reference', 'PRET-2026-0042')->assertJsonPath('data.fees', []);

    $journal = json_encode(AuditLog::query()->get()->map(fn (AuditLog $l): array => ['a' => $l->action, 'c' => $l->changes, 'm' => $l->metadata])->all());
    expect($journal)->toContain('investments.loan.created')->not->toContain('PRET-2026')->not->toContain('Banque du Nord')->not->toContain('1200000');
});

it('importe le tableau de la banque : il remplace le calcul après vérification', function (): void {
    $id = I::pret($this, $this->b, ['principal' => 300000, 'nominal_rate' => '0', 'term_months' => 3])->assertCreated()->json('data.id');
    $csv = "date;mensualité;intérêts;capital;assurance;restant dû\n05/01/2026;1000,00;0;1000,00;2,50;2000,00\n05/02/2026;1000,00;0;1000,00;2,50;1000,00\n05/03/2026;1000,00;0;1000,00;2,50;0,00\n";

    $this->post(I::url($this->b['org'], "/loans/{$id}/schedule/import"), ['lock_version' => 1, 'file' => UploadedFile::fake()->createWithContent('banque.csv', $csv)], ['Accept' => 'application/json'])
        ->assertOk()->assertJsonPath('data.schedule_source', 'imported')->assertJsonPath('data.lock_version', 2);

    $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertOk()->assertJsonPath('data.source', 'imported')
        ->assertJsonPath('data.lines.0.insurance.amount', 250)->assertJsonPath('data.lines.0.principal.amount', 100000)->assertJsonPath('data.totals.insurance.amount', 750);
    expect(DB::table('loan_schedules')->where('loan_id', $id)->orderBy('version')->pluck('reason')->all())->toBe(['initial', 'import']);
});

it('un tableau importé incohérent est refusé en 422 loan_schedule_inconsistent et rien n\'est écrit', function (): void {
    $id = I::pret($this, $this->b, ['principal' => 300000, 'nominal_rate' => '0', 'term_months' => 3])->assertCreated()->json('data.id');
    $envoyer = fn (string $csv) => $this->post(I::url($this->b['org'], "/loans/{$id}/schedule/import"), ['lock_version' => 1, 'file' => UploadedFile::fake()->createWithContent('banque.csv', $csv)], ['Accept' => 'application/json']);

    foreach ([
        "05/01/2026;1000,00;0;1000,00;0;1999,00\n",
        "05/01/2026;1000,00;0;1000,00;0;2000,00\n05/03/2026;1000,00;0;1000,00;0;1000,00\n",
        "05/01/2026;1000,00;0;1000,00;0;2000,00\n05/02/2026;1000,00;0;1000,00;0;1000,00\n",
        "05/01/2026;999,00;0;1000,00;0;2000,00\n",
        "05/01/2026;1000,00;0;3000,00;0;0,00\n05/02/2026;0;0;0;0;0\n",
        "xx;1;1;1;1;1\n",
        "05/01/2026;1000,005;0;1000,00;0;2000,00\n",
    ] as $csv) {
        $envoyer($csv)->assertUnprocessable()->assertJsonPath('code', 'loan_schedule_inconsistent');
    }

    expect(DB::table('loan_schedules')->where('loan_id', $id)->count())->toBe(1)
        ->and(DB::table('loans')->where('id', $id)->value('schedule_source'))->toBe('computed');
});

it('plafonne le tableau importé à 600 lignes', function (): void {
    $id = I::pret($this, $this->b, ['term_months' => 600, 'nominal_rate' => '0', 'principal' => 600000])->assertCreated()->json('data.id');
    $lignes = '';
    for ($i = 0; $i < 601; $i++) {
        $lignes .= '2026-01-05;1;0;1;0;0'."\n";
    }

    $this->post(I::url($this->b['org'], "/loans/{$id}/schedule/import"), ['lock_version' => 1, 'file' => UploadedFile::fake()->createWithContent('b.csv', $lignes)], ['Accept' => 'application/json'])
        ->assertUnprocessable()->assertJsonPath('code', 'loan_schedule_inconsistent');
});

it('remboursement anticipé, durée réduite : nouvelle version, mensualité conservée, indemnité enregistrée en frais', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');

    $this->postJson(I::url($this->b['org'], "/loans/{$id}/prepayments"), ['date' => '2026-04-05', 'amount' => 200000, 'option' => 'reduce_term', 'penalty' => 4000, 'lock_version' => 1])
        ->assertOk()->assertJsonPath('data.lock_version', 2)->assertJsonPath('data.status', 'active')->assertJsonPath('data.fees.0.kind', 'prepayment_penalty')->assertJsonPath('data.fees.0.amount.amount', 4000);

    $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertOk()->assertJsonCount(10, 'data.lines')
        ->assertJsonPath('data.lines.3.principal.amount', 97486 + 200000)->assertJsonPath('data.lines.3.outstanding_after.amount', 615809)
        ->assertJsonPath('data.lines.4.payment.amount', 106619)->assertJsonPath('data.lines.4.interest.amount', 6158)->assertJsonPath('data.lines.9.outstanding_after.amount', 0)
        ->assertJsonPath('data.totals.principal.amount', 1200000);
    expect(DB::table('loan_schedules')->where('loan_id', $id)->orderBy('version')->pluck('reason')->all())->toBe(['initial', 'prepayment']);
});

it('remboursement anticipé, mensualité réduite : références calculées à part', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');

    $this->postJson(I::url($this->b['org'], "/loans/{$id}/prepayments"), ['date' => '2026-04-05', 'amount' => 200000, 'option' => 'reduce_payment', 'lock_version' => 1])->assertOk();
    $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertOk()->assertJsonCount(12, 'data.lines')
        ->assertJsonPath('data.lines.4.payment.amount', 80480)->assertJsonPath('data.lines.11.payment.amount', 80482)->assertJsonPath('data.lines.11.outstanding_after.amount', 0);
});

it('remboursement anticipé total : statut repaid, plus aucune échéance après', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');

    $this->postJson(I::url($this->b['org'], "/loans/{$id}/prepayments"), ['date' => '2026-04-05', 'amount' => 815809, 'option' => 'reduce_term', 'lock_version' => 1])
        ->assertOk()->assertJsonPath('data.status', 'repaid')->assertJsonPath('data.repaid_on', '2026-04-05');
    $this->getJson(I::url($this->b['org'], "/loans/{$id}/schedule"))->assertJsonCount(4, 'data.lines');
    $this->postJson(I::url($this->b['org'], "/loans/{$id}/prepayments"), ['date' => '2026-03-05', 'amount' => 10, 'option' => 'reduce_term', 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');
});

it('remboursement anticipé : date hors échéance, excédent, conflit de version et prêt importé refusés', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');
    $url = I::url($this->b['org'], "/loans/{$id}/prepayments");

    $this->postJson($url, ['date' => '2026-04-06', 'amount' => 1000, 'option' => 'reduce_term', 'lock_version' => 1])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    $this->postJson($url, ['date' => '2026-04-05', 'amount' => 815810, 'option' => 'reduce_term', 'lock_version' => 1])->assertUnprocessable()->assertJsonPath('code', 'loan_terms_invalid');
    $this->postJson($url, ['date' => '2026-04-05', 'amount' => 1000, 'option' => 'reduce_term', 'lock_version' => 7])->assertConflict()->assertJsonPath('code', 'loan_version_conflict');
    $this->postJson($url, ['date' => '2026-04-05', 'amount' => 1000, 'option' => 'reduce_term', 'lock_version' => 1, 'outstanding' => 5])->assertUnprocessable();
    expect(DB::table('loan_schedules')->where('loan_id', $id)->count())->toBe(1);

    $autre = I::pret($this, $this->b, ['principal' => 300000, 'nominal_rate' => '0', 'term_months' => 3])->assertCreated()->json('data.id');
    $csv = "05/01/2026;1000,00;0;1000,00;0;2000,00\n05/02/2026;1000,00;0;1000,00;0;1000,00\n05/03/2026;1000,00;0;1000,00;0;0,00\n";
    $this->post(I::url($this->b['org'], "/loans/{$autre}/schedule/import"), ['lock_version' => 1, 'file' => UploadedFile::fake()->createWithContent('b.csv', $csv)], ['Accept' => 'application/json'])->assertOk();
    $this->postJson(I::url($this->b['org'], "/loans/{$autre}/prepayments"), ['date' => '2026-01-05', 'amount' => 1000, 'option' => 'reduce_term', 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');
});

it('frais et attestation : pièce obligatoire, une attestation par année, devise du serveur', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');

    $this->post(I::url($this->b['org'], "/loans/{$id}/fees"), ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 15000, 'currency' => 'USD'], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post(I::url($this->b['org'], "/loans/{$id}/fees"), ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 15000], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.amount', ['amount' => 15000, 'currency' => 'EUR']);

    $url = I::url($this->b['org'], "/loans/{$id}/attestations");
    $this->post($url, ['income_year' => 2025, 'interest' => 70000], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post($url, ['income_year' => 2025, 'interest' => 70000, 'insurance' => 3000, 'document' => I::pdf('attestation.pdf')], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.interest.amount', 70000);
    $this->post($url, ['income_year' => 2025, 'interest' => 1, 'document' => I::pdf('attestation.pdf')], ['Accept' => 'application/json'])->assertConflict()->assertJsonPath('code', 'loan_attestation_exists');

    $this->getJson(I::url($this->b['org'], "/loans/{$id}"))->assertJsonCount(1, 'data.fees')->assertJsonCount(1, 'data.attestations');
});

it('annule la saisie : refusé si une synthèse fiscale figée l\'utilise ; un prêt annulé sort des lectures de coût', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');
    $utilise = I::pret($this, $this->b)->assertCreated()->json('data.id');
    DB::table('loan_usages')->insert(['id' => (string) Str::uuid7(), 'organization_id' => $this->b['org']->id, 'loan_id' => $utilise, 'income_year' => 2025, 'created_at' => now(), 'updated_at' => now()]);

    $this->postJson(I::url($this->b['org'], "/loans/{$utilise}/void"), ['reason' => 'Erreur de saisie', 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'loan_in_use');
    $this->postJson(I::url($this->b['org'], "/loans/{$id}/void"), ['reason' => 'Erreur de saisie', 'lock_version' => 9])->assertConflict()->assertJsonPath('code', 'loan_version_conflict');
    $this->postJson(I::url($this->b['org'], "/loans/{$id}/void"), ['reason' => 'Erreur de saisie', 'lock_version' => 1])->assertOk()->assertJsonPath('data.status', 'voided')->assertJsonPath('data.void_reason', 'Erreur de saisie');
    $this->postJson(I::url($this->b['org'], "/loans/{$id}/void"), ['reason' => 'Encore', 'lock_version' => 2])->assertConflict()->assertJsonPath('code', 'loan_state_invalid');
    expect(DB::table('loans')->where('id', $utilise)->value('status'))->toBe('active');
});

it('coût de revient : un bien en entier ou lot par lot, nouvelle version par lock_version, rejeu idempotent', function (): void {
    $url = I::url($this->b['org'], '/acquisitions');
    $corps = ['property_id' => $this->b['property'], 'acquired_on' => '2020-05-01', 'price' => 20000000, 'acquisition_costs' => 1500000, 'agency_fees' => 500000, 'initial_works' => 1000000];

    $cree = $this->postJson($url, $corps, ['Idempotency-Key' => 'acq-nominale-01'])->assertCreated()->assertJsonPath('data.cost', ['amount' => 23000000, 'currency' => 'EUR'])->assertJsonPath('data.lock_version', 1);
    $this->postJson($url, $corps, ['Idempotency-Key' => 'acq-nominale-01'])->assertOk()->assertJsonPath('data.id', $cree->json('data.id'));
    $this->postJson($url, [...$corps, 'price' => 1], ['Idempotency-Key' => 'acq-nominale-01'])->assertConflict()->assertJsonPath('code', 'investments_idempotency_key_reused');
    $this->postJson($url, $corps, ['Idempotency-Key' => 'acq-nominale-02'])->assertConflict()->assertJsonPath('code', 'acquisition_exists');
    $this->postJson($url, [...$corps, 'unit_id' => $this->b['unit']->id], ['Idempotency-Key' => 'acq-nominale-03'])->assertUnprocessable()->assertJsonPath('code', 'acquisition_scope_mixed');
    $this->postJson($url, [...$corps, 'currency' => 'XOF'], ['Idempotency-Key' => 'acq-nominale-04'])->assertUnprocessable();

    $this->patchJson("{$url}/{$cree->json('data.id')}", ['acquired_on' => '2020-05-02', 'price' => 21000000, 'lock_version' => 1])->assertOk()->assertJsonPath('data.lock_version', 2)->assertJsonPath('data.cost.amount', 21000000);
    $this->patchJson("{$url}/{$cree->json('data.id')}", ['acquired_on' => '2020-05-02', 'price' => 22000000, 'lock_version' => 1])->assertConflict()->assertJsonPath('code', 'loan_version_conflict');
});

it('coût de revient par lot : puis le bien entier est refusé', function (): void {
    $url = I::url($this->b['org'], '/acquisitions');
    $this->postJson($url, ['property_id' => $this->b['property'], 'unit_id' => $this->b['unit']->id, 'acquired_on' => '2021-01-10', 'price' => 9000000], ['Idempotency-Key' => 'acq-lot-0001'])->assertCreated();
    $this->postJson($url, ['property_id' => $this->b['property'], 'acquired_on' => '2021-01-10', 'price' => 9000000], ['Idempotency-Key' => 'acq-lot-0002'])->assertUnprocessable()->assertJsonPath('code', 'acquisition_scope_mixed');
});

it('les échéanciers, frais, attestations et prêts ne se modifient ni ne se suppriment en base (déclencheurs)', function (): void {
    $id = I::pret($this, $this->b)->assertCreated()->json('data.id');
    $this->post(I::url($this->b['org'], "/loans/{$id}/fees"), ['kind' => 'dossier', 'paid_on' => '2026-01-02', 'amount' => 15000], ['Accept' => 'application/json'])->assertCreated();

    foreach ([
        fn () => DB::table('loan_schedule_lines')->update(['interest' => 1]),
        fn () => DB::table('loan_schedule_lines')->delete(),
        fn () => DB::table('loan_schedules')->update(['reason' => 'import']),
        fn () => DB::table('loan_fees')->update(['kind' => 'other']),
        fn () => DB::table('loans')->update(['principal' => 1]),
        fn () => DB::table('loans')->delete(),
    ] as $ecriture) {
        expect($ecriture)->toThrow(QueryException::class);
    }

    expect(DB::table('loans')->where('id', $id)->value('principal'))->toBe(1200000);
});
