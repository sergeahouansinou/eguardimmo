<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('brouillon : même clé et même contenu rejoue (200), contenu différent est refusé (409)', function (): void {
    $corps = C::brouillon($this->partie);

    $premier = $this->postJson(C::url($this->org), $corps)->assertCreated()->assertJsonPath('data.replayed', false)->json('data.id');
    $this->postJson(C::url($this->org), $corps)->assertOk()->assertJsonPath('data.id', $premier)->assertJsonPath('data.replayed', true);
    $this->postJson(C::url($this->org), [...$corps, 'lines' => [C::ligne(99999)]])->assertStatus(409)->assertJsonPath('code', 'invoice_idempotency_key_reused');

    expect(DB::table('invoices')->count())->toBe(1);
});

it('règlement : rejoué sans second encaissement, refusé si le contenu change', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $corps = ['amount' => 5000, 'method' => 'transfer', 'paid_on' => '2026-11-18', 'reference' => 'VIR-1', 'idempotency_key' => 'reglement-rejeu-1'];

    $premier = $this->postJson(C::url($this->org, "/{$facture->id}/payments"), $corps)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$facture->id}/payments"), $corps)->assertOk()->assertJsonPath('data.id', $premier)->assertJsonPath('data.replayed', true);
    $this->postJson(C::url($this->org, "/{$facture->id}/payments"), [...$corps, 'amount' => 6000])->assertStatus(409)->assertJsonPath('code', 'invoice_idempotency_key_reused');

    expect(DB::table('invoice_payments')->count())->toBe(1)->and(C::reste($this->org, $facture))->toBe(7000);
});

it('avoir : rejoué sans second avoir, refusé si le contenu change', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $corps = ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-rejeu-1'];

    $premier = $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), $corps)->assertCreated()->json('data.id');
    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), $corps)->assertOk()->assertJsonPath('data.id', $premier)->assertJsonPath('data.replayed', true);
    $this->postJson(C::url($this->org, "/{$facture->id}/credit-notes"), [...$corps, 'reason' => 'Autre motif'])->assertStatus(409)->assertJsonPath('code', 'invoice_idempotency_key_reused');

    expect(DB::table('invoices')->where('kind', 'credit_note')->count())->toBe(1);
});

it('une clé de règlement d\'une autre organisation n\'entre pas en collision', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    $autre = C::organisation(nom: 'Autre agence');
    $partie = C::destinataire($autre);
    C::basculer($this, $autre);
    $etrangere = C::emettre($this, $autre, $partie);

    C::basculer($this, $this->org);
    $this->postJson(C::url($this->org, "/{$facture->id}/payments"), ['amount' => 100, 'method' => 'cash', 'paid_on' => '2026-11-18', 'idempotency_key' => 'cle-commune-1'])->assertCreated();
    C::basculer($this, $autre);
    $this->postJson(C::url($autre, "/{$etrangere->id}/payments"), ['amount' => 100, 'method' => 'cash', 'paid_on' => '2026-11-18', 'idempotency_key' => 'cle-commune-1'])->assertCreated();
});
