<?php

declare(strict_types=1);

use Carbon\CarbonImmutable;
use Tests\Feature\Invoicing\InvoicingContext as C;
use Tests\Feature\Leases\LeasesContext as L;

beforeEach(function (): void {
    C::preparer($this);
    $this->org = C::organisation();
    $this->partie = C::destinataire($this->org);
    $this->actingAs(L::titulaire($this->org));
});

it('liste, filtre par nature, statut, année, recherche et retard, et pagine par curseur', function (): void {
    $premiere = C::emettre($this, $this->org, $this->partie);
    $seconde = C::emettre($this, $this->org, $this->partie);
    $this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-11-19']))->assertCreated();
    C::regler($this, $this->org, $premiere, 12000)->assertCreated();
    $this->postJson(C::url($this->org, "/{$seconde->id}/credit-notes"), ['reason' => 'Erreur', 'full' => true, 'idempotency_key' => 'avoir-liste-1'])->assertCreated();

    $this->getJson(C::url($this->org))->assertOk()->assertJsonCount(4, 'data');
    $this->getJson(C::url($this->org, '?kind=credit_note'))->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '?status=paid'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $premiere->id)->assertJsonPath('data.0.outstanding.amount', 0);
    $this->getJson(C::url($this->org, '?status=draft'))->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '?year=2026&kind=invoice&status=cancelled'))->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $seconde->id);
    $this->getJson(C::url($this->org, '?year=2025'))->assertJsonCount(0, 'data');
    $this->getJson(C::url($this->org, '?search=AF-2026'))->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '?search=%25'))->assertJsonCount(0, 'data');
    $this->getJson(C::url($this->org, '?party='.$this->partie->id))->assertJsonCount(4, 'data');

    $page = $this->getJson(C::url($this->org, '?per_page=3'))->assertOk()->assertJsonCount(3, 'data');
    $this->getJson(C::url($this->org, '?per_page=3&cursor='.$page->json('meta.next_cursor')))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(C::url($this->org, '?cursor=pas-un-curseur'))->assertUnprocessable();
});

it('le filtre « en retard » ne retient que les factures échues avec un reste dû', function (): void {
    $this->postJson(C::url($this->org, '/'.$this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-11-20']))->json('data.id').'/issue'))->assertCreated();
    $this->postJson(C::url($this->org, '/'.$this->postJson(C::url($this->org), C::brouillon($this->partie, null, ['due_on' => '2026-12-30']))->json('data.id').'/issue'))->assertCreated();

    $this->getJson(C::url($this->org, '?overdue=1'))->assertJsonCount(0, 'data');
    $this->travelTo(CarbonImmutable::parse('2026-11-25 08:00:00'));
    $this->getJson(C::url($this->org, '?overdue=1'))->assertJsonCount(1, 'data');
});

it('le détail expose les lignes, les taxes, les règlements et le reste dû lu au grand livre', function (): void {
    $facture = C::emettre($this, $this->org, $this->partie);
    C::regler($this, $this->org, $facture, 5000)->assertCreated();

    $this->getJson(C::url($this->org, "/{$facture->id}"))->assertOk()
        ->assertJsonPath('data.outstanding.amount', 7000)->assertJsonPath('data.status', 'partially_paid')
        ->assertJsonCount(1, 'data.lines')->assertJsonCount(1, 'data.taxes')->assertJsonCount(1, 'data.payments')
        ->assertJsonMissingPath('data.snapshot')->assertJsonMissingPath('data.organization_id');
    $this->getJson(C::url($this->org, '/pas-un-uuid'))->assertNotFound();
});
