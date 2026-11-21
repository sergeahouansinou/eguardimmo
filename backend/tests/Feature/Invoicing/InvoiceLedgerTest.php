<?php

declare(strict_types=1);

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Invoicing\Models\Invoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Leases\LeasesReadContext;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
    $this->statut = fn (Invoice $f): string => L::dans($this->org, fn () => Invoice::query()->find($f->id)->status->value);
});

it('émission : écriture équilibrée, créance Clients et TVA différée', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    expect(C::desequilibrees())->toBe(0)
        ->and(C::solde($this->org, AccountRole::CustomerReceivable))->toBe(12000)
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(2000)
        ->and(C::solde($this->org, AccountRole::VatCollected))->toBe(0)
        ->and(C::solde($this->org, AccountRole::FeeRevenue))->toBe(10000)
        ->and(C::reste($this->org, $facture))->toBe(12000);
});

it('option pour les débits : la TVA est collectée dès l\'émission', function (): void {
    C::identite($this->org, debits: true);
    $facture = C::emettre($this, $this->org, $this->partie);

    expect(C::solde($this->org, AccountRole::VatDeferred))->toBe(0)
        ->and(C::solde($this->org, AccountRole::VatCollected))->toBe(2000)
        ->and(C::desequilibrees())->toBe(0)
        ->and($facture->vat_on_debits)->toBeTrue();

    C::regler($this, $this->org, $facture, 12000)->assertCreated();
    expect(C::solde($this->org, AccountRole::VatCollected))->toBe(2000);
});

it('règlement : la TVA différée passe en TVA collectée au prorata, le dernier règlement solde', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie, [C::ligne(10001)]);

    C::regler($this, $this->org, $facture, 4000)->assertCreated();
    expect(C::solde($this->org, AccountRole::VatCollected))->toBe(667)
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(1333)
        ->and(($this->statut)($facture))->toBe('partially_paid');

    C::regler($this, $this->org, $facture, 8001)->assertCreated();
    expect(C::solde($this->org, AccountRole::VatCollected))->toBe(2000)
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(0)
        ->and(C::solde($this->org, AccountRole::Bank))->toBe(12001)
        ->and(C::solde($this->org, AccountRole::CustomerReceivable))->toBe(0)
        ->and(C::desequilibrees())->toBe(0)
        ->and(($this->statut)($facture))->toBe('paid');
});

it('un règlement en espèces va en caisse', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    C::regler($this, $this->org, $facture, 12000, ['method' => 'cash'])->assertCreated();
    expect(C::solde($this->org, AccountRole::Cash))->toBe(12000)->and(C::solde($this->org, AccountRole::Bank))->toBe(0);
});

it('annuler un règlement contrepasse l\'écriture, rétablit la TVA différée et relit le statut', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $id = C::regler($this, $this->org, $facture, 12000)->assertCreated()->json('data.id');
    expect(($this->statut)($facture))->toBe('paid')->and(C::solde($this->org, AccountRole::VatCollected))->toBe(2000);

    $this->postJson("/api/v1/org/{$this->org->id}/invoice-payments/{$id}/cancel")->assertOk()->assertJsonPath('data.cancelled_at', fn ($v) => $v !== null);

    expect(($this->statut)($facture))->toBe('issued')
        ->and(C::reste($this->org, $facture))->toBe(12000)
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(2000)
        ->and(C::solde($this->org, AccountRole::VatCollected))->toBe(0)
        ->and(C::desequilibrees())->toBe(0);

    $this->postJson("/api/v1/org/{$this->org->id}/invoice-payments/{$id}/cancel")->assertOk();
    expect(DB::table('journal_entries')->count())->toBe(3);
});

it('le règlement ne dépasse jamais le reste dû', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    C::regler($this, $this->org, $facture, 12001)->assertUnprocessable()->assertJsonPath('code', 'invoice_payment_exceeds_outstanding');
    C::regler($this, $this->org, $facture, 12000)->assertCreated();
    C::regler($this, $this->org, $facture, 1)->assertUnprocessable()->assertJsonPath('code', 'invoice_payment_exceeds_outstanding');
    expect(C::reste($this->org, $facture))->toBe(0);
});

it('refuse un règlement daté avant l\'émission de la facture', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    C::regler($this, $this->org, $facture, 100, ['paid_on' => '2026-11-17'])->assertUnprocessable()->assertJsonPath('code', 'invoice_payment_invalid');
    C::regler($this, $this->org, $facture, 100, ['paid_on' => '2026-11-18'])->assertCreated();
    expect(C::reste($this->org, $facture))->toBe(11900);
});

it('refuse un règlement invalide ou sur un brouillon', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $brouillon = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    C::regler($this, $this->org, $facture, 0)->assertUnprocessable();
    C::regler($this, $this->org, $facture, 100, ['paid_on' => '2026-11-19'])->assertUnprocessable();
    C::regler($this, $this->org, $facture, 100, ['method' => 'bitcoin'])->assertUnprocessable();
    $this->postJson(C::url($this->org, "/{$brouillon}/payments"), ['amount' => 100, 'method' => 'cash', 'paid_on' => '2026-11-18', 'idempotency_key' => 'sur-brouillon-1'])->assertStatus(409)->assertJsonPath('code', 'invoice_not_payable');
});

it('avoir total : écriture miroir, TVA différée libérée, facture annulée', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);

    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Erreur de facturation', 'full' => true, 'idempotency_key' => 'avoir-total-1'])
        ->assertCreated()->assertJsonPath('data.kind', 'credit_note')->assertJsonPath('data.number', 'AF-2026-0001')->assertJsonPath('data.credited_invoice_id', $facture->id)->assertJsonPath('data.total_gross.amount', 12000);

    expect(($this->statut)($facture))->toBe('cancelled')
        ->and(C::reste($this->org, $facture))->toBe(0)
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(0)
        ->and(C::solde($this->org, AccountRole::VatCollected))->toBe(0)
        ->and(C::solde($this->org, AccountRole::FeeRevenue))->toBe(0)
        ->and(C::solde($this->org, AccountRole::CustomerReceivable))->toBe(0)
        ->and(C::desequilibrees())->toBe(0);
});

it('avoir partiel après règlement partiel : TVA différée recalculée au prorata du reste', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    C::regler($this, $this->org, $facture, 6000)->assertCreated();
    $ligne = L::dans($this->org, fn () => Invoice::query()->find($facture->id)->lines()->first()->id);

    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Remise commerciale', 'full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 500]], 'idempotency_key' => 'avoir-partiel-1'])
        ->assertCreated()->assertJsonPath('data.total_net.amount', 5000)->assertJsonPath('data.total_tax.amount', 1000)->assertJsonPath('data.total_gross.amount', 6000);

    expect(C::reste($this->org, $facture))->toBe(0)
        ->and(($this->statut)($facture))->toBe('paid')
        ->and(C::solde($this->org, AccountRole::VatDeferred))->toBe(0)
        ->and(C::solde($this->org, AccountRole::VatCollected))->toBe(1000)
        ->and(C::desequilibrees())->toBe(0);
});

it('l\'avoir ne dépasse ni le reste dû ni la quantité facturée', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    C::regler($this, $this->org, $facture, 8000)->assertCreated();
    $ligne = L::dans($this->org, fn () => Invoice::query()->find($facture->id)->lines()->first()->id);
    $avoir = fn (array $corps) => $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Motif', ...$corps]);

    $avoir(['full' => true, 'idempotency_key' => 'avoir-trop-1'])->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_outstanding');
    $avoir(['full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 500]], 'idempotency_key' => 'avoir-trop-2'])->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_outstanding');
    $avoir(['full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 1500]], 'idempotency_key' => 'avoir-trop-3'])->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_line');
    $avoir(['full' => false, 'lines' => [['line_id' => (string) Str::uuid7(), 'quantity_milli' => 100]], 'idempotency_key' => 'avoir-trop-4'])->assertUnprocessable()->assertJsonPath('code', 'invoice_lines_invalid');
    $avoir(['full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 300]], 'idempotency_key' => 'avoir-ok-5'])->assertCreated();

    $avoir(['full' => false, 'lines' => [['line_id' => $ligne, 'quantity_milli' => 300]], 'idempotency_key' => 'avoir-trop-6'])->assertUnprocessable()->assertJsonPath('code', 'invoice_credit_exceeds_outstanding');
    expect(C::reste($this->org, $facture))->toBe(400);
});

it('un avoir ne se crédite pas lui-même et exige un motif', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $avoirId = $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['reason' => 'Motif', 'full' => true, 'idempotency_key' => 'avoir-base-1'])->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$avoirId}/credit-notes"), ['reason' => 'Motif', 'full' => true, 'idempotency_key' => 'avoir-sur-avoir'])->assertStatus(409)->assertJsonPath('code', 'invoice_not_creditable');
    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), ['full' => true, 'idempotency_key' => 'avoir-sans-motif'])->assertUnprocessable();
    $this->postJson(C::url($this->org, "/{$avoirId}/issue"))->assertStatus(409);
    C::regler($this, $this->org, Invoice::query()->withoutGlobalScopes()->findOrFail($avoirId), 100)->assertStatus(409);
});

it('un brouillon n\'a pas d\'avoir', function (): void {
    $brouillon = $this->postJson(C::url($this->org), C::brouillon($this->partie))->assertCreated()->json('data.id');

    $this->postJson(C::url($this->org, "/{$brouillon}/credit-notes"), ['reason' => 'Motif', 'full' => true, 'idempotency_key' => 'avoir-brouillon'])->assertStatus(409)->assertJsonPath('code', 'invoice_not_creditable');
});

it('une facture sur un bail, destinataire partie au bail, suit le compte locataire', function (): void {
    ['bail' => $bail, 'locataire' => $locataire] = (function (): array {
        $bail = L::bail($this->org);
        $locataire = L::partie($this->org);
        LeasesReadContext::lier($this->org, $bail, $locataire, ['valid_from' => $bail->starts_on->toDateString()]);

        return ['bail' => $bail, 'locataire' => $locataire];
    })->call($this);
    $id = $this->postJson(C::url($this->org), C::brouillon($locataire, null, ['lease_id' => $bail->id]))->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$id}/issue"))->assertCreated();

    expect(C::solde($this->org, AccountRole::TenantReceivable))->toBe(12000)
        ->and(C::solde($this->org, AccountRole::CustomerReceivable))->toBe(0)
        ->and(C::desequilibrees())->toBe(0);
});
