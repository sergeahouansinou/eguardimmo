<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Banking\BankingContext as B;
use Tests\Feature\Invoicing\InvoicingContext as I;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    config(['invoicing.gotenberg.url' => 'http://gotenberg.test']);
    ['org' => $this->org, 'bail' => $this->bail, 'compte' => $this->compte] = B::loyers($this);
    I::identite($this->org);
});

function bkRegler(object $test, array $ligne, array $corps, ?string $cle = null): TestResponse
{
    return B::envoyer($test, 'POST', B::url($test->org, "/lines/{$ligne['id']}/settle"), ['lock_version' => $ligne['lock_version'], ...$corps], $cle);
}

it('crée l\'encaissement du bail depuis une ligne de relevé et la pointe', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $du = C::du($this->org, $this->bail);

    $r = bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 70000]]]);

    expect($r->status())->toBeIn([200, 201])->and(DB::table('rent_payments')->count())->toBe(1);
    expect(C::du($this->org, $this->bail))->toBe($du - 70000)->and(I::solde($this->org, AccountRole::Bank))->toBe(70000)->and(I::desequilibrees())->toBe(0);
    expect(B::lignes($this, $this->org)['VIR LOYER']['state'])->toBe('matched');
    expect(DB::table('journal_entries')->where('source_type', 'payment')->count())->toBeGreaterThan(0);
});

it('rejoue le même règlement sans second encaissement', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $corps = ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 70000]]];

    $a = bkRegler($this, $ligne, $corps, 'cle-reglement');
    $b = bkRegler($this, $ligne, $corps, 'cle-reglement');

    expect($b->json('data.id'))->toBe($a->json('data.id'))->and(DB::table('rent_payments')->count())->toBe(1)->and(I::solde($this->org, AccountRole::Bank))->toBe(70000);
});

it('refuse une répartition qui ne fait pas le montant de la ligne et ne laisse rien derrière', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', '700,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];

    $r = bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 30000]]]);

    expect($r->status())->toBeGreaterThanOrEqual(400)->and(DB::table('rent_payments')->count())->toBe(0)->and(DB::table('bank_matches')->count())->toBe(0);
    expect(B::lignes($this, $this->org)['VIR LOYER']['state'])->toBe('unmatched');
});

it('répartit un virement entre deux baux', function (): void {
    ['bail' => $second] = C::bail($this->org);
    C::emises($this->org, $second, $this);
    B::reauthentifier($this);
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR DEUX BAUX', '1000,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR DEUX BAUX'];

    $r = bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 60000], ['lease_id' => $second->id, 'amount' => 40000]]]);

    expect($r->status())->toBeIn([200, 201])->and(DB::table('rent_payments')->count())->toBe(2)->and(I::solde($this->org, AccountRole::Bank))->toBe(100000);
});

it('enregistre les frais bancaires d\'une ligne débitrice', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'FRAIS TENUE COMPTE', '-12,50']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['FRAIS TENUE COMPTE'];

    $r = bkRegler($this, $ligne, ['action' => 'bank_charges']);

    expect($r->status())->toBeIn([200, 201]);
    expect(I::solde($this->org, AccountRole::Bank))->toBe(-1250)->and(I::solde($this->org, AccountRole::BankCharges))->toBe(1250)->and(I::desequilibrees())->toBe(0);
    expect(DB::table('journal_entries')->where('source_type', 'bank_line')->count())->toBe(1);
});

it('règle une facture émise, dans la limite de son reste dû', function (): void {
    $destinataire = I::destinataire($this->org);
    $facture = I::emettre($this, $this->org, $destinataire);
    $reste = I::reste($this->org, $facture);
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR FACTURE', number_format(($reste + 5000) / 100, 2, ',', '')]]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR FACTURE'];

    $r = bkRegler($this, $ligne, ['action' => 'settle_invoice', 'invoice_id' => $facture->id, 'amount' => $reste + 5000]);

    expect($r->status())->toBeGreaterThanOrEqual(400);
    expect(I::reste($this->org, $facture))->toBe($reste);

    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR SOLDE FACTURE', number_format($reste / 100, 2, ',', '')]], 'F'))->assertCreated();
    $ok = bkRegler($this, B::lignes($this, $this->org)['VIR SOLDE FACTURE'], ['action' => 'settle_invoice', 'invoice_id' => $facture->id]);

    expect($ok->status())->toBeIn([200, 201])->and(I::reste($this->org, $facture))->toBe(0)->and(I::desequilibrees())->toBe(0);
});

it('refuse de régler une ligne déjà pointée ou débitrice comme un encaissement', function (): void {
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'PRLV', '-50,00']]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['PRLV'];

    $r = bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => 5000]]]);

    expect($r->status())->toBeGreaterThanOrEqual(400)->and(DB::table('rent_payments')->count())->toBe(0);
});

function bkAppelsGotenberg(): int
{
    return Http::recorded()->filter(fn (array $paire): bool => str_contains($paire[0]->url(), 'gotenberg.test'))->count();
}

it('émet la quittance des échéances soldées après la transaction du règlement', function (): void {
    $du = C::du($this->org, $this->bail);
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', number_format($du / 100, 2, ',', '')]]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $avant = bkAppelsGotenberg();

    bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => $du]]])->assertSuccessful();

    expect(bkAppelsGotenberg())->toBeGreaterThan($avant)->and(DB::table('rent_receipts')->count())->toBeGreaterThan(0);
});

it('ne génère aucune quittance quand le règlement est annulé, même si une première répartition avait soldé une échéance', function (): void {
    $du = C::du($this->org, $this->bail);
    B::importer($this, $this->org, $this->compte, B::csv([['16/11/2026', 'VIR LOYER', number_format(($du + 1000) / 100, 2, ',', '')]]))->assertCreated();
    $ligne = B::lignes($this, $this->org)['VIR LOYER'];
    $avant = bkAppelsGotenberg();

    $r = bkRegler($this, $ligne, ['action' => 'settle_lease', 'allocations' => [['lease_id' => $this->bail->id, 'amount' => $du], ['lease_id' => (string) Str::uuid(), 'amount' => 1000]]]);

    expect($r->status())->toBeGreaterThanOrEqual(400)->and(bkAppelsGotenberg())->toBe($avant)->and(DB::table('rent_receipts')->count())->toBe(0)->and(DB::table('rent_payments')->count())->toBe(0);
});
