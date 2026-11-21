<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Mandates\MandatesSecurityContext as X;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    config(['invoicing.gotenberg.url' => 'http://gotenberg.test']);
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
    I::identite($this->org);
    $this->titulaire = auth()->user();
});

function bkRevenir(object $test): void
{
    X::changer();
    $test->actingAs($test->titulaire);
    B::reauthentifier($test);
}

it('404 sur les pointages, états et fichiers d\'une autre organisation', function (): void {
    [$org, $bail, $compte] = [$this->org, $this->bail, $this->compte];
    C::payer($this, $org, $bail, 70000)->assertCreated();
    B::importer($this, $org, $compte, B::camt([['2026-11-16', 'CRDT', '700.00', 'VIR LOYER']], ouverture: 0, cloture: 70000), 'camt053', nom: 'r.xml')->assertCreated();
    $releve = DB::table('bank_statements')->value('id');
    $ligne = B::lignes($this, $org)['VIR LOYER'];
    $pointage = B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => B::ecritures($this, $org, $compte), 'lock_version' => $ligne['lock_version']])->assertCreated()->json('data.id');
    $etat = B::envoyer($this, 'POST', B::url($org, '/reconciliations'), ['bank_account_id' => $compte, 'month' => '2026-11'])->assertCreated()->json('data.id');

    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);

    $this->getJson(B::url($autre, "/matches/{$pointage}"))->assertNotFound()->assertJsonPath('code', 'bank_match_not_found');
    $this->getJson(B::url($autre, "/reconciliations/{$etat}"))->assertNotFound()->assertJsonPath('code', 'bank_reconciliation_not_found');
    $this->getJson(B::url($autre, "/statements/{$releve}/file"))->assertNotFound()->assertJsonPath('code', 'bank_statement_not_found');
    $this->getJson(B::url($autre, "/reconciliations/{$etat}/proof"))->assertNotFound();
    B::envoyer($this, 'POST', B::url($autre, "/matches/{$pointage}/undo"), ['reason' => 'Intrusion'])->assertNotFound();
    B::envoyer($this, 'POST', B::url($autre, "/reconciliations/{$etat}/validate"))->assertNotFound();
    B::envoyer($this, 'POST', B::url($autre, "/statements/{$releve}/void"), ['reason' => 'Intrusion'])->assertNotFound();
    B::envoyer($this, 'POST', B::url($autre, '/reconciliations'), ['bank_account_id' => $compte, 'month' => '2026-11'])->assertNotFound();

    bkRevenir($this);
    $this->getJson(B::url($org, "/matches/{$pointage}"))->assertOk();
    expect(DB::table('bank_matches')->whereNull('undone_at')->count())->toBe(1);
});

it('404 sur une ligne d\'écriture d\'une autre organisation lors d\'un pointage', function (): void {
    [$org, $bail, $compte] = [$this->org, $this->bail, $this->compte];
    C::payer($this, $org, $bail, 70000)->assertCreated();
    B::importer($this, $org, $compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $org)['VIR LOYER'];

    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);
    $bailAutre = C::bail($autre)['bail'];
    I::identite($autre);
    B::reauthentifier($this);
    $compteAutre = B::compte($this, $autre, 'bank', B::AUTRE_IBAN);
    C::payer($this, $autre, $bailAutre, 70000)->assertCreated();
    $ecritureEtrangere = B::ecritures($this, $autre, $compteAutre);

    bkRevenir($this);

    B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/match"), ['journal_line_ids' => $ecritureEtrangere, 'lock_version' => $ligne['lock_version']])
        ->assertStatus(404);
    expect(DB::table('bank_matches')->count())->toBe(0);
});

it('refuse de régler un bail ou une facture d\'une autre organisation', function (): void {
    [$org, $bail, $compte] = [$this->org, $this->bail, $this->compte];
    B::importer($this, $org, $compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $org)['VIR LOYER'];

    $autre = C::organisation(nom: 'Autre agence');
    X::changer();
    $this->actingAs(L::titulaire($autre));
    B::reauthentifier($this);
    $bailAutre = C::bail($autre)['bail'];
    I::identite($autre);
    $factureAutre = I::emettre($this, $autre, I::destinataire($autre));
    B::reauthentifier($this);

    bkRevenir($this);
    $regler = fn (array $corps) => B::envoyer($this, 'POST', B::url($org, "/lines/{$ligne['id']}/settle"), ['lock_version' => $ligne['lock_version'], ...$corps]);

    $regler(['action' => 'settle_lease', 'allocations' => [['lease_id' => $bailAutre->id, 'amount' => 70000]]])->assertStatus(404);
    $regler(['action' => 'settle_invoice', 'invoice_id' => $factureAutre->id, 'amount' => 70000])->assertStatus(404);
    expect(DB::table('rent_payments')->count())->toBe(0)->and(DB::table('bank_matches')->count())->toBe(0);
});
