<?php

declare(strict_types=1);

use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\Payment;
use App\Modules\Rent\Models\RentReceipt;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    ['bail' => $this->bail] = C::bail($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('impute un paiement partiel : échéance partiellement payée, reste dû lu au grand livre, pas de quittance', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);

    C::payer($this, $this->org, $this->bail, 30000, ['reference' => 'VIR-123'])
        ->assertCreated()
        ->assertJsonPath('data.status', 'recorded')
        ->assertJsonPath('data.amount.amount', 30000)
        ->assertJsonPath('data.allocations.0.installment_id', $echeance->id)
        ->assertJsonPath('data.allocations.0.amount.amount', 30000)
        ->assertJsonPath('data.advance.amount', 0)
        ->assertJsonPath('data.replayed', false);

    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))
        ->assertOk()->assertJsonPath('data.status', 'partially_paid')->assertJsonPath('data.outstanding.amount', 40000)->assertJsonPath('data.receipt_state', 'not_due');
    expect(C::du($this->org, $this->bail))->toBe(40000)
        ->and(L::dans($this->org, fn () => RentReceipt::query()->count()))->toBe(0);
});

it('solde l\'échéance et émet la quittance au solde : numéro, PDF, loyer et charges distingués, mention légale', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);

    $this->travelTo('2026-11-16 12:00:00');
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->assertJsonPath('data.receipts.'.$echeance->id, 'issued');

    $quittance = L::dans($this->org, fn () => RentReceipt::query()->firstOrFail());

    expect($quittance->number)->toBe('QT-2026-0001')
        ->and($quittance->rent_amount->getAmount())->toBe('65000')
        ->and($quittance->charges_amount->getAmount())->toBe('5000')
        ->and($quittance->total_amount->getAmount())->toBe('70000')
        ->and(json_encode($quittance->snapshot, JSON_THROW_ON_ERROR))->toContain('article 21');

    $this->getJson(C::url($this->org, "/receipts/{$quittance->id}"))
        ->assertOk()->assertJsonPath('data.number', 'QT-2026-0001')->assertJsonPath('data.amounts.rent.amount', 65000)->assertJsonPath('data.amounts.charges.amount', 5000);
    $this->get(C::url($this->org, "/receipts/{$quittance->id}/download"))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))->assertJsonPath('data.status', 'paid')->assertJsonPath('data.receipt_state', 'issued');
    expect(C::du($this->org, $this->bail))->toBe(0);
});

it('impute du plus ancien au plus récent et garde le trop-perçu en avance', function (): void {
    [$a, $b] = C::emises($this->org, $this->bail, $this, '2026-11-25');

    $reponse = C::payer($this, $this->org, $this->bail, 160000)->assertCreated();

    $reponse->assertJsonPath('data.allocations.0.installment_id', $a->id)->assertJsonPath('data.allocations.0.amount.amount', 70000)
        ->assertJsonPath('data.allocations.1.installment_id', $b->id)->assertJsonPath('data.allocations.1.amount.amount', 70000)
        ->assertJsonPath('data.advance.amount', 20000);
    expect(C::du($this->org, $this->bail))->toBe(-20000)
        ->and(L::dans($this->org, fn () => RentReceipt::query()->count()))->toBe(2);
    $this->getJson(C::url($this->org, "/leases/{$this->bail->id}/balance"))
        ->assertOk()->assertJsonPath('data.advance.amount', 20000)->assertJsonPath('data.balance.amount', -20000)->assertJsonPath('data.unpaid_count', 0);
});

it('une avance est imputée à l\'émission de l\'avis suivant, la quittance suit', function (): void {
    C::generer($this->org, $this->bail);
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->assertJsonPath('data.advance.amount', 70000);
    [$echeance] = C::echeances($this->org, $this->bail);

    $this->postJson(C::url($this->org, "/installments/{$echeance->id}/issue"))
        ->assertOk()->assertJsonPath('data.status', 'paid')->assertJsonPath('data.receipt.number', 'QT-2026-0001')->assertJsonPath('data.outstanding.amount', 0);
    expect(C::du($this->org, $this->bail))->toBe(0);
});

it('est idempotent : même clé et même contenu rejouent, un contenu différent est refusé', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);
    $corps = ['lease_id' => $this->bail->id, 'amount' => 30000, 'method' => 'transfer', 'received_on' => '2026-11-16', 'idempotency_key' => 'cle-unique-1'];

    $premier = $this->postJson(C::url($this->org, '/payments'), $corps)->assertCreated();
    $rejeu = $this->postJson(C::url($this->org, '/payments'), $corps)->assertOk()->assertJsonPath('data.replayed', true);
    $this->postJson(C::url($this->org, '/payments'), [...$corps, 'amount' => 30001])->assertStatus(409)->assertJsonPath('code', 'rent_idempotency_key_reused');

    expect($rejeu->json('data.id'))->toBe($premier->json('data.id'))
        ->and(L::dans($this->org, fn () => Payment::query()->count()))->toBe(1)
        ->and(C::du($this->org, $this->bail))->toBe(40000)
        ->and($echeance->id)->not->toBeEmpty();
});

it('refuse un montant décimal, nul, une date future et ignore toute devise du client', function (): void {
    C::emises($this->org, $this->bail, $this);

    C::payer($this, $this->org, $this->bail, 0)->assertStatus(422);
    $this->postJson(C::url($this->org, '/payments'), ['lease_id' => $this->bail->id, 'amount' => 100.5, 'method' => 'transfer', 'received_on' => '2026-11-16', 'idempotency_key' => 'cle-decimale-1'])->assertStatus(422);
    $this->postJson(C::url($this->org, '/payments'), ['lease_id' => $this->bail->id, 'amount' => '1e3', 'method' => 'transfer', 'received_on' => '2026-11-16', 'idempotency_key' => 'cle-decimale-2'])->assertStatus(422);
    C::payer($this, $this->org, $this->bail, 1000, ['received_on' => '2026-11-17'])->assertStatus(422);
    C::payer($this, $this->org, $this->bail, 1000, ['currency' => 'XOF'])->assertCreated()->assertJsonPath('data.amount.currency', 'EUR');
});

it('un chèque ne déclenche pas la quittance : elle se demande, puis le rejeu la renvoie', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);

    C::payer($this, $this->org, $this->bail, 70000, ['method' => 'cheque', 'reference' => 'CHQ-9'])
        ->assertCreated()->assertJsonPath('data.receipts.'.$echeance->id, 'on_demand');
    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))->assertJsonPath('data.status', 'paid')->assertJsonPath('data.receipt_state', 'on_demand');
    $this->postJson(C::url($this->org, '/receipts/issue-pending'))->assertOk()->assertJsonPath('data.issued', 0);

    $premiere = $this->postJson(C::url($this->org, "/installments/{$echeance->id}/receipt"))->assertCreated()->assertJsonPath('data.number', 'QT-2026-0001');
    $this->postJson(C::url($this->org, "/installments/{$echeance->id}/receipt"))->assertOk()->assertJsonPath('data.id', $premiere->json('data.id'));

    expect(L::dans($this->org, fn () => RentReceipt::query()->count()))->toBe(1);
});

it('une quittance demandée avant le solde est refusée', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);

    $this->postJson(C::url($this->org, "/installments/{$echeance->id}/receipt"))->assertStatus(409)->assertJsonPath('code', 'rent_installment_not_paid');
});

it('PDF indisponible au solde : l\'encaissement reste enregistré, la quittance en attente est reprise ensuite', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);
    C::$panneGotenberg = true;

    C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->assertJsonPath('data.receipts.'.$echeance->id, 'pending');
    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))->assertJsonPath('data.status', 'paid')->assertJsonPath('data.receipt_state', 'pending');
    expect(L::dans($this->org, fn () => RentReceipt::query()->count()))->toBe(0);

    C::$panneGotenberg = false;
    $this->postJson(C::url($this->org, '/receipts/issue-pending'))->assertOk()->assertJsonPath('data.issued', 1);
    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))->assertJsonPath('data.receipt_state', 'issued');
});

it('annule un encaissement par contrepassation : rien n\'est supprimé, l\'échéance se rouvre, la quittance est annulée', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);
    $id = C::payer($this, $this->org, $this->bail, 70000)->assertCreated()->json('data.id');
    $ecrituresAvant = L::dans($this->org, fn () => JournalEntry::query()->count());

    $this->postJson(C::url($this->org, "/payments/{$id}/cancel"), ['reason' => 'Chèque rejeté'])
        ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancellation_reason', 'Chèque rejeté')->assertJsonPath('data.allocations', []);

    expect(C::du($this->org, $this->bail))->toBe(70000)
        ->and(L::dans($this->org, fn () => JournalEntry::query()->count()))->toBeGreaterThan($ecrituresAvant)
        ->and(L::dans($this->org, fn () => Payment::query()->count()))->toBe(1)
        ->and(L::dans($this->org, fn () => RentReceipt::query()->whereNull('voided_at')->count()))->toBe(0)
        ->and(L::dans($this->org, fn () => RentReceipt::query()->whereNotNull('voided_at')->count()))->toBe(1);
    $this->getJson(C::url($this->org, "/installments/{$echeance->id}"))->assertJsonPath('data.status', 'issued')->assertJsonPath('data.outstanding.amount', 70000)->assertJsonPath('data.receipt_state', 'not_due');
    $this->postJson(C::url($this->org, "/payments/{$id}/cancel"), ['reason' => 'Chèque rejeté'])->assertOk();
    expect(C::du($this->org, $this->bail))->toBe(70000);
});

it('une échéance encaissée ne s\'annule qu\'après l\'annulation de l\'encaissement', function (): void {
    [$echeance] = C::emises($this->org, $this->bail, $this);
    C::payer($this, $this->org, $this->bail, 10000)->assertCreated();

    $this->postJson(C::url($this->org, "/installments/{$echeance->id}/cancel"), ['reason' => 'Erreur'])
        ->assertStatus(409)->assertJsonPath('code', 'rent_installment_has_payments');
    expect(L::dans($this->org, fn () => Installment::query()->findOrFail($echeance->id)->status->value))->toBe('partially_paid');
});

it('liste les encaissements et les quittances par curseur', function (): void {
    C::emises($this->org, $this->bail, $this, '2026-11-25');
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();
    C::payer($this, $this->org, $this->bail, 70000)->assertCreated();

    $page = $this->getJson(C::url($this->org, '/payments?per_page=1'))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '/payments?per_page=1&cursor='.$page->json('meta.next_cursor')))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '/receipts'))->assertOk()->assertJsonCount(2, 'data');
    $this->getJson(C::url($this->org, '/installments?status=paid&lease='.$this->bail->id))->assertOk()->assertJsonCount(2, 'data');
    $this->getJson(C::url($this->org, '/installments?cursor=abc'))->assertStatus(422);
});
