<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Rent\Models\Installment;
use App\Modules\Rent\Models\RentReceipt;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\Documents\DocumentsContext;
use Tests\Feature\Leases\LeasesContext as L;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;
use Tests\Feature\Tenant\TenantRentContext as R;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = T::organisation();
    $this->moi = R::facture($this, $this->org);
    $this->echeance = $this->moi['installment'];
});

it('liste mes échéances appelées avec reste dû, avis et sans donnée interne', function (): void {
    $reponse = T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $this->echeance->id)
        ->assertJsonPath('data.0.lease.id', $this->moi['lease']->id)
        ->assertJsonPath('data.0.lease.reference', $this->moi['lease']->reference)
        ->assertJsonPath('data.0.status', 'issued')
        ->assertJsonPath('data.0.amounts.total', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.amounts.rent', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.outstanding', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.is_overdue', true)
        ->assertJsonPath('data.0.notice.number', 'AV-2026-0001')
        ->assertJsonPath('data.0.receipt', null)
        ->assertJsonPath('data.0.period.start', $this->echeance->period_start->toDateString());

    R::absents($reponse, [$this->moi['party']->id, 'party_id', 'unit_id', 'fingerprint', 'ledger', 'cancellation_reason', 'receipt_state', 'organization_id']);
});

it('montre le détail d\'une échéance avec ses lignes', function (): void {
    $reponse = T::comme($this, $this->moi['user'])->getJson(R::URL."/installments/{$this->echeance->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $this->echeance->id)
        ->assertJsonPath('data.due_date', $this->echeance->due_date->toDateString())
        ->assertJsonPath('data.lines.0.amount.currency', 'EUR');

    expect($reponse->json('data.lines'))->not->toBeEmpty();
    R::absents($reponse, ['component_key', 'semantic', 'fingerprint', 'party_id', 'unit_id']);
});

it('filtre mes échéances par bail et par statut, et refuse un statut non appelé', function (): void {
    $moi = T::comme($this, $this->moi['user']);

    $moi->getJson(R::URL."/installments?lease={$this->moi['lease']->id}&status=issued")->assertOk()->assertJsonCount(1, 'data');
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments?status=paid')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments?status=upcoming')->assertUnprocessable();
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments?status=cancelled')->assertUnprocessable();
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments?lease='.Str::uuid7())->assertOk()->assertJsonCount(0, 'data');
});

it('n\'expose jamais une échéance à venir ni annulée', function (): void {
    $avenir = L::dans($this->org, fn (): Installment => Installment::query()->whereKey($this->echeance->id)->firstOrFail()->replicate()->forceFill([
        'period_start' => '2027-01-01', 'period_end' => '2027-01-31', 'due_date' => '2027-01-05', 'status' => 'upcoming', 'issued_on' => null, 'ledger_entry_id' => null,
    ]));
    L::dans($this->org, fn () => $avenir->save());
    $annulee = L::dans($this->org, fn (): Installment => Installment::query()->whereKey($this->echeance->id)->firstOrFail()->replicate()->forceFill([
        'period_start' => '2027-02-01', 'period_end' => '2027-02-28', 'due_date' => '2027-02-05', 'status' => 'cancelled', 'cancelled_on' => '2026-11-16', 'cancellation_reason' => 'Erreur de saisie', 'ledger_entry_id' => null,
    ]));
    L::dans($this->org, fn () => $annulee->save());

    $liste = T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments?per_page=100')->assertOk();

    expect(collect($liste->json('data'))->pluck('id')->all())->toBe([$this->echeance->id]);
    R::absents($liste, ['Erreur de saisie']);

    foreach ([$avenir->id, $annulee->id] as $id) {
        T::comme($this, $this->moi['user'])->getJson(R::URL."/installments/{$id}")->assertNotFound()->assertJsonPath('code', 'rent_installment_not_found');
    }
});

it('télécharge l\'avis d\'échéance en PDF privé, sans cache', function (): void {
    $reponse = T::comme($this, $this->moi['user'])->get(R::URL."/installments/{$this->echeance->id}/notice/download")
        ->assertOk()
        ->assertHeader('Content-Type', 'application/pdf')
        ->assertHeader('X-Content-Type-Options', 'nosniff');

    expect($reponse->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')->not->toContain('public')
        ->and($reponse->streamedContent())->toBe(DocumentsContext::PDF);
});

it('répond 404 pour l\'avis d\'une échéance sans avis', function (): void {
    $sans = L::dans($this->org, fn (): Installment => Installment::query()->whereKey($this->echeance->id)->firstOrFail()->replicate()->forceFill([
        'period_start' => '2027-01-01', 'period_end' => '2027-01-31', 'due_date' => '2027-01-05', 'ledger_entry_id' => null,
    ]));
    L::dans($this->org, fn () => $sans->save());

    T::comme($this, $this->moi['user'])->getJson(R::URL."/installments/{$sans->id}/notice/download")->assertNotFound()->assertJsonPath('code', 'rent_notice_not_found');
});

it('liste mes encaissements sans référence, note, clé d\'idempotence ni fiche', function (): void {
    R::encaisser($this, $this->org, $this->moi['lease'], 30000, ['reference' => 'VIR-CONFIDENTIEL-77', 'note' => 'Note interne de l\'agence']);

    $reponse = T::comme($this, $this->moi['user'])->getJson(R::URL.'/payments')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.status', 'recorded')
        ->assertJsonPath('data.0.method', 'transfer')
        ->assertJsonPath('data.0.amount', ['amount' => 30000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.received_on', '2026-11-16')
        ->assertJsonPath('data.0.lease.reference', $this->moi['lease']->reference)
        ->assertJsonPath('data.0.allocations.0.installment_id', $this->echeance->id)
        ->assertJsonPath('data.0.allocations.0.amount.amount', 30000);

    R::absents($reponse, ['VIR-CONFIDENTIEL-77', 'Note interne', '"note"', 'idempotency', 'fingerprint', 'ledger', 'party_id', 'recorded_by', $this->moi['party']->id]);

    $id = $reponse->json('data.0.id');
    $detail = T::comme($this, $this->moi['user'])->getJson(R::URL."/payments/{$id}")->assertOk()->assertJsonPath('data.id', $id);
    R::absents($detail, ['VIR-CONFIDENTIEL-77', 'Note interne', 'idempotency', 'fingerprint']);
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/payments?status=cancelled')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi['user'])->getJson(R::URL."/installments/{$this->echeance->id}")->assertJsonPath('data.status', 'partially_paid')->assertJsonPath('data.outstanding.amount', 35000);
});

it('montre mes quittances et les télécharge ; une quittance annulée se signale et ne se délivre plus', function (): void {
    $paiement = R::encaisser($this, $this->org, $this->moi['lease'], 65000);
    $quittance = L::dans($this->org, fn (): RentReceipt => RentReceipt::query()->firstOrFail());

    $liste = T::comme($this, $this->moi['user'])->getJson(R::URL.'/receipts')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $quittance->id)
        ->assertJsonPath('data.0.number', 'QT-2026-0001')
        ->assertJsonPath('data.0.installment_id', $this->echeance->id)
        ->assertJsonPath('data.0.amounts.total', ['amount' => 65000, 'currency' => 'EUR'])
        ->assertJsonPath('data.0.is_void', false);
    R::absents($liste, ['fingerprint', 'void_reason', 'snapshot', 'party_id', 'organization_id']);

    T::comme($this, $this->moi['user'])->getJson(R::URL."/receipts/{$quittance->id}")
        ->assertOk()
        ->assertJsonPath('data.issuer', 'Agence du Port')
        ->assertJsonPath('data.paid_on', '2026-11-16')
        ->assertJsonPath('data.lease.reference', $this->moi['lease']->reference)
        ->assertJsonPath('data.tenants.0', $this->moi['party']->display_name);

    $pdf = T::comme($this, $this->moi['user'])->get(R::URL."/receipts/{$quittance->id}/download")->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($pdf->headers->get('Cache-Control'))->toContain('private')->toContain('no-store')->and($pdf->streamedContent())->toBe(DocumentsContext::PDF);

    $this->actingAs(L::titulaire($this->org))->postJson(C::url($this->org, "/payments/{$paiement->json('data.id')}/cancel"), ['reason' => 'Chèque rejeté'])->assertOk();

    $annulee = T::comme($this, $this->moi['user'])->getJson(R::URL."/receipts/{$quittance->id}")->assertOk()->assertJsonPath('data.is_void', true);
    R::absents($annulee, ['Chèque rejeté']);
    T::comme($this, $this->moi['user'])->get(R::URL."/receipts/{$quittance->id}/download")->assertStatus(409)->assertJsonPath('code', 'rent_receipt_void');
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/payments')->assertJsonPath('data.0.status', 'cancelled');
    R::absents(T::comme($this, $this->moi['user'])->getJson(R::URL.'/payments'), ['Chèque rejeté']);
});

it('montre échéances, quittances et encaissements du même bail à un colocataire, jamais à un garant', function (): void {
    R::encaisser($this, $this->org, $this->moi['lease'], 65000);
    $colocataire = User::factory()->create();
    $garant = User::factory()->create();
    R::rattacher($this->org, T::colocataire($this->org, $this->moi['lease']), $colocataire);
    R::rattacher($this->org, T::colocataire($this->org, $this->moi['lease'], role: LeasePartyRole::Guarantor), $garant);

    foreach (['installments', 'receipts', 'payments'] as $ressource) {
        T::comme($this, $colocataire)->getJson(R::URL."/{$ressource}")->assertOk()->assertJsonCount(1, 'data');
    }

    T::comme($this, $garant)->getJson(R::URL.'/installments')->assertOk()->assertJsonCount(0, 'data');
});

it('masque les échéances dues à partir de la sortie de ma propre ligne, sans toucher à celles d\'un colocataire resté', function (): void {
    $due = $this->echeance->due_date->toDateString();
    $reste = T::colocataire($this->org, $this->moi['lease']);
    $compteReste = User::factory()->create();
    R::rattacher($this->org, $reste, $compteReste);
    $sortie = fn (string $jour) => DB::table('lease_parties')->where('lease_id', $this->moi['lease']->id)->where('party_id', $this->moi['party']->id)->update(['valid_to' => $jour]);

    $sortie(CarbonImmutable::parse($due)->addDay()->toDateString());
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments')->assertOk()->assertJsonCount(1, 'data');

    $sortie($due);
    T::comme($this, $this->moi['user'])->getJson(R::URL.'/installments')->assertOk()->assertJsonCount(0, 'data');
    T::comme($this, $this->moi['user'])->getJson(R::URL."/installments/{$this->echeance->id}")->assertNotFound();
    T::comme($this, $this->moi['user'])->get(R::URL."/installments/{$this->echeance->id}/notice/download")->assertNotFound();
    T::comme($this, $compteReste)->getJson(R::URL.'/installments')->assertOk()->assertJsonCount(1, 'data');
});
